import { hd } from '@cmdcode/crypto-utils'

import {
  HashConfig,
  SigHash,
  TxData,
  TxTemplate,
  Tx
} from '@scrow/tapscript'

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
  WalletInfo
} from '../types/index.js'

const { segwit, taproot } = SigHash

const SAT_MULTI = 100_000_000

const DEFAULT_SORTER   = () => Math.random() > 0.5 ? 1 : -1

export class CoreWallet {
  readonly _client : CoreClient
  readonly _name   : string
  
  _init : boolean

  constructor (
    client : CoreClient,
    wallet_name = 'test_wallet'
  ) {
    this._client = client
    this._name   = wallet_name
    this._init   = false
  }

  get client () {
    return this._client
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

  get newaddress () : Promise<AddressInfo> {
    return new Promise(async res => {
      const addr = await this.cmd<string>('getnewaddress')
      const data = await this.parse_address(addr)
      res(data)
    })
  }

  get utxos () {
    return this.cmd<UTXO[]>('listunspent')
      .then(e => e.map(x => { return { ...x, sats : Math.round(x.amount * SAT_MULTI) }}))
  }

  get xprvs () {
    return this.cmd<WalletInfo>('listdescriptors', 'true')
      .then(({ descriptors }) => descriptors.map(x => parse_descriptor(x)))
  }

  get xpubs () {
    return this.cmd<WalletInfo>('listdescriptors')
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

  async gen_address (config : AddressConfig = {}) {
    return this.cmd<string>('getnewaddress', config)
  }

  async get_address (label : string) : Promise<AddressInfo> {
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
      res(this.parse_address(address))
    })
  }

  async parse_address (address : string) {
    return this.cmd<AddressInfo>('getaddressinfo', [ address ])
  }

  async send_funds (address : string, amt : number) {
    const amount = Math.floor(amt / SAT_MULTI)
    const config = { address, amount, estimate_mode: 'economical' }
    return this.cmd('sendtoaddress', config)
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

  async generate_funds (
    blocks  ?: number,
    address ?: string
  ) : Promise<void> {
    if (address === undefined) {
      address = (await this.newaddress).address
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
    const { seckey, pubkey } = hd.derive(fullpath, master_key, code, true)
    assert.ok(seckey !== null)
    const signer  = (keytype === 'tr') ? taproot : segwit
    const sign_tx = (txdata : TxData, config : HashConfig) => {
      return signer.sign_tx(seckey, txdata, config)
    }
    return { pubkey, sign_tx }
  }

  async select_utxos (
    amount : number,
    coinsorter = DEFAULT_SORTER
  ) : Promise<UTXO[]> {
    const selected : UTXO[] = []

    let total = 0

    const utxos = await this.utxos
    utxos.sort(coinsorter)

    for (const utxo of utxos) {
      selected.push(utxo)
      total += utxo.sats
      if (total >= amount) return selected
    }

    throw new Error('Insufficient funds!')
  }

  async fund_tx (
    templ  : TxTemplate,
    config : HashConfig = {},
    txfee  : number = 1000
  ) {
    const txdata = Tx.create_tx(templ)
    const vamt   = txdata.vout.reduce((prev, curr) => Number(curr.value) + prev, 0)
    const utxos  = await this.select_utxos(vamt + txfee)
    const total  = utxos.reduce((prev, curr) => curr.sats + prev, 0)
    const change = total - vamt - txfee
    const change_addr  = await this.newaddress
    const changePubKey = change_addr.scriptPubKey

    txdata.vout.push({
      value: change, 
      scriptPubKey: changePubKey
    })

    for (let i = 0; i < utxos.length; i++) {
      const { desc, txid, vout, sats, scriptPubKey } = utxos[i]
      const { pubkey, sign_tx } = await this.get_signer(desc)
      const prevout   = { value: sats, scriptPubKey }
      const txinput   = Tx.create_vin({ txid, vout, prevout })
      const txconfig  = { sigflag: 0x81, pubkey, txinput }
      const signature = sign_tx(txdata, { ...txconfig, ...config })
      const witness   = [ signature ]
      if (desc.startsWith('wpkh')) witness.push(pubkey)
      txdata.vin.push({ ...txinput, witness })
    }
    return txdata
  }
}