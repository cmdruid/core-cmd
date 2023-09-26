import { derive_key } from '@cmdcode/crypto-tools/hd'

import {
  SigHashOptions,
  TxData,
  TxTemplate,
} from '@scrow/tapscript'

import {
  segwit,
  taproot
} from '@scrow/tapscript/sighash'

import {
  create_tx,
  create_vin
} from '@scrow/tapscript/tx'

import assert from 'assert'

import { CoreClient } from './client.js'

import {
  parse_desc,
  parse_descriptor
} from './descriptors.js'

import {
  AddressConfig,
  AddressInfo,
  MethodArgs,
  UTXO,
  WalletDescriptors,
  WalletInfo
} from '../types/index.js'

const DUST_LIMIT  = 1_000
    , MIN_TX_FEE  = 1_000
    , SAT_MULTI   = 100_000_000
    , RANDOM_SORT = () => Math.random() > 0.5 ? 1 : -1

export class CoreWallet {
  readonly _client : CoreClient
  readonly _name   : string
  readonly _txfee  : number

  _info ?: WalletInfo

  constructor (
    client : CoreClient,
    label  = 'test_wallet',
    txfee  = MIN_TX_FEE
  ) {
    this._client = client
    this._name   = label
    this._txfee  = txfee
  }

  get client () {
    return this._client
  }

  get info () {
    return this.get_info()
  }

  get name () : string {
    return this._name
  }

  get balance () {
    return this.cmd<string>('getbalance')
      .then(bal => Number(bal) * SAT_MULTI)
  }

  get network () {
    return this.client.opt.network
  }

  get newaddress () : Promise<string> {
    return this.cmd<string>('getnewaddress')
  }

  get utxos () {
    return this.cmd<UTXO[]>('listunspent')
      .then(e => e.map(x => { return { ...x, sats : Math.round(x.amount * SAT_MULTI) }}))
  }

  get xprvs () {
    return this.cmd<WalletDescriptors>('listdescriptors', 'true')
      .then(({ descriptors }) => descriptors.map(x => parse_descriptor(x)))
  }

  get xpubs () {
    return this.cmd<WalletDescriptors>('listdescriptors')
      .then(({ descriptors }) => descriptors.map(x => parse_descriptor(x)))
  }

  async cmd <T = Record<string, string>> (
    method : string,
    args   : MethodArgs = [],
    params : string[]   = []
  ) : Promise<T> {
    const p = [ `-rpcwallet=${this.name}`, ...params ]
    return this.client.cmd(method, args, p)
  }

  async get_info (refresh = false) {
    if (refresh || this._info === undefined) {
      this._info = await this.cmd<WalletInfo>('getwalletinfo')
    }
    return this._info
  }

  async gen_address (config : AddressConfig = {}) {
    return this.cmd<string>('getnewaddress', config)
  }

  async get_address (label : string) : Promise<string> {
    return new Promise(async res => {
      let address : string
      try {
        const res   = await this.cmd('getaddressesbylabel', [ label ])
        const addrs = Object.keys(res)
        address = (addrs.length !== 0)
          ? addrs[0]
          : await this.gen_address({ label })
      } catch (err) {
        address = await this.gen_address({ label })
      }
      assert.ok(typeof address === 'string')
      res(address)
    })
  }

  async parse_address (address : string) {
    return this.cmd<AddressInfo>('getaddressinfo', [ address ])
  }

  async send_funds (address : string, amt : number) {
    await this.ensure_txfee_config()
    const amount  = amt / SAT_MULTI
    const config  = { address, amount, estimate_mode: 'economical' }
    return this.cmd<string>('sendtoaddress', config)
  }

  async ensure_funds (
    min_bal : number,
    blocks  = 110
  ) : Promise<void> {
    if (this.network === 'regtest') {
      const bal = await this.balance
      if (bal <= min_bal) {
        await this.generate_funds(blocks)
        return this.ensure_funds(min_bal, blocks)
      }
    }
  }

  async ensure_txfee_config () {
    const { paytxfee } = await this.info
    const wallet_txfee = this._txfee / SAT_MULTI
    if (paytxfee !== wallet_txfee) {
      this.cmd<boolean>('settxfee', [ wallet_txfee  ])
      this.get_info(true)
    }
  }

  async generate_funds (
    blocks  ?: number,
    address ?: string
  ) : Promise<void> {
    if (address === undefined) {
      address = await this.newaddress
    }
    return this._client.cmd('generatetoaddress', [ blocks ?? 110, address ])
  }

  async get_xprv (label : string) {
    const xprvs = await this.xprvs
    return xprvs.find(e => label === e.label)
  }

  async get_signer (
    desc : string
  ) {
    const { parent_label, fullpath, keytype } = parse_desc(desc)
    const xprv = await this.get_xprv(parent_label)
    assert.ok(xprv?.extkey?.seckey !== undefined)
    const { seckey: master_key, code } = xprv.extkey
    const { seckey, pubkey } = derive_key(fullpath, master_key, code, true)
    assert.ok(seckey !== null)
    const signer  = (keytype === 'tr') ? taproot : segwit
    const sign_tx = (txdata : TxData, config : SigHashOptions) => {
      return signer.sign_tx(seckey, txdata, config)
    }
    return { pubkey, sign_tx }
  }

  async create_vout (
    amount   : number | bigint,
    address ?: string,
  ) {
    if (typeof address !== 'string') {
      address = await this.newaddress
    }
    const { scriptPubKey } = await this.parse_address(address)
    return { value : BigInt(amount), scriptPubKey }
  }

  async select_utxos (
    amount : number,
    sorter = RANDOM_SORT
  ) : Promise<UTXO[]> {
    const selected : UTXO[] = []

    let total = 0

    const utxos = await this.utxos
    utxos.sort(sorter)

    for (const utxo of utxos) {
      selected.push(utxo)
      total += utxo.sats
      if (
        total === amount ||
        total > amount + DUST_LIMIT
      ) {
        return selected
      }
    }

    throw new Error('Insufficient funds!')
  }

  async fund_tx (
    templ  : TxTemplate,
    config : SigHashOptions = {},
    txfee  : number = 1000
  ) {
    const txdata = create_tx(templ)
    const vamt   = txdata.vout.reduce((prev, curr) => Number(curr.value) + prev, 0)
    const utxos  = await this.select_utxos(vamt + txfee)
    const total  = utxos.reduce((prev, curr) => curr.sats + prev, 0)

    const change_sats = BigInt(total - vamt - txfee)
    const change_addr = await this.newaddress
    const change_data = await this.parse_address(change_addr)

    txdata.vout.push({
      value        : change_sats,
      scriptPubKey : change_data.scriptPubKey
    })

    for (let i = 0; i < utxos.length; i++) {
      const { desc, txid, vout, sats, scriptPubKey } = utxos[i]
      const { pubkey, sign_tx } = await this.get_signer(desc)
      const prevout   = { value: sats, scriptPubKey }
      const txinput   = create_vin({ txid, vout, prevout })
      const txconfig  = { sigflag: 0x81, pubkey, txinput }
      const signature = sign_tx(txdata, { ...txconfig, ...config })
      const witness   = [ signature.hex ]
      if (desc.startsWith('wpkh')) witness.push(pubkey.hex)
      txdata.vin.push({ ...txinput, witness })
    }
    return txdata
  }
}