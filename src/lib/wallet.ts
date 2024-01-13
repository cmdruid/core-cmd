import assert         from 'assert'
import { derive_key } from '@cmdcode/crypto-tools/hd'
import { parse_addr } from '@scrow/tapscript/address'
import { CoreClient } from './client.js'
import { cmd_config } from '../config.js'

import {
  ScriptWord,
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

import {
  parse_desc,
  parse_descriptor
} from './descriptors.js'

import {
  AddressConfig,
  AddressInfo,
  CmdConfig,
  MethodArgs,
  UTXO,
  WalletConfig,
  WalletDescriptors,
  WalletInfo,
  WalletResponse
} from '../types/index.js'

import * as CONST from './const.js'

const { DUST_LIMIT, MIN_TX_FEE, SAT_MULTI, RANDOM_SORT } = CONST

export class CoreWallet {
  readonly _addrs  : Map<string, string>
  readonly _client : CoreClient
  readonly _config : WalletConfig
  readonly _label  : string

  _txfee  ?: number | null

  constructor (
    client : CoreClient,
    label  : string,
    config : WalletConfig = {}
  ) {
    this._addrs  = new Map()
    this._config = config
    this._client = client
    this._label  = label
    this._txfee  = null
  }

  get client () {
    return this._client
  }

  get info () {
    return this.cmd<WalletInfo>('getwalletinfo', null, { cache : true })
  }

  get is_created () {
    return this.client.wallets_created
      .then(e => Array.isArray(e) && e.includes(this.label))
  }

  get is_loaded () {
    return this.client.wallets_loaded
      .then(e => Array.isArray(e) && e.includes(this.label))
  }

  get label () : string {
    return this._label
  }

  get balance () {
    return this.cmd<string>('getbalance', null, { cache : true })
      .then(bal => Number(bal) * SAT_MULTI)
  }

  get network () {
    return this.client.opt.network
  }

  get new_address () : Promise<string> {
    return this.gen_address()
  }

  get new_scriptkey () : Promise<ScriptWord[]> {
    return this.new_address.then(e => parse_addr(e).asm)
  }

  get utxos () {
    return this.cmd<UTXO[]>('listunspent', null, { cache : true })
      .then(e => e.map(x => { return { ...x, sats : Math.round(x.amount * SAT_MULTI) }}))
  }

  get xprvs () {
    return this.cmd<WalletDescriptors>('listdescriptors', true, { cache : true })
      .then(({ descriptors }) => descriptors.map(x => parse_descriptor(x)))
  }

  get xpubs () {
    return this.cmd<WalletDescriptors>('listdescriptors', null, { cache : true })
      .then(({ descriptors }) => descriptors.map(x => parse_descriptor(x)))
  }


  get xprv () : Promise<string> {
    return new Promise(async res => {
      const xprvs = await this.xprvs
      const wpkh  = xprvs.find(e => e.keytype === 'wpkh')
      if (wpkh === undefined) {
        throw new Error('unable to locate wpkh descriptor')
      }
      res(wpkh.keystr)
    })
  }

  get xpub () : Promise<string> {
    return new Promise(async res => {
      const xpubs = await this.xpubs
      const wpkh  = xpubs.find(e => e.keytype === 'wpkh')
      if (wpkh === undefined) {
        throw new Error('unable to locate wpkh descriptor')
      }
      res(wpkh.keystr)
    })
  }

  async _create () {
    const payload = { wallet_name: this.label, ...this._config }
    const res = await this.client.cmd<WalletResponse>('createwallet', payload)
    const err = (res.warning !== undefined && res.warning !== '')
    if (err || res.name !== this.label) {
      // If there was a problem with loading, throw error.
      throw new Error(`Wallet failed to create: ${JSON.stringify(res, null, 2)}`)
    }
  }

  async _load () {
    const res = await this.client.cmd<WalletResponse>('loadwallet', this.label)
    if (res.warning !== undefined || res.name !== this.label) {
      // If there was a problem with loading, throw error.
      throw new Error(`Wallet failed to load: ${JSON.stringify(res, null, 2)}`)
    }
  }

  async init () {
    const info = await this.info
    if (info.paytxfee === 0) {
      const newtxfee = MIN_TX_FEE / SAT_MULTI
      await this.cmd<boolean>('settxfee', newtxfee)
    }
  }

  async load () {
    if (!await this.is_loaded) {
      if (!await this.is_created) {
        await this._create()
      } else {
        await this._load()
      }
    }
  }

  async cmd <T = Record<string, string>> (
    method  : string,
    args    : MethodArgs = [],
    config ?: Partial<CmdConfig>
  ) : Promise<T> {
    const conf  = cmd_config(config)
    conf.params = [ ...conf.params, `-rpcwallet=${this.label}` ]
    return this.client.cmd(method, args, conf)
  }

  async gen_address (config ?: AddressConfig) {
    return this.cmd<string>('getnewaddress', config)
  }

  async get_address (label : string) : Promise<string> {
    const { debug } = this.client.opt
    let addr = this._addrs.get(label)
    if (addr !== undefined) {
      if (debug) console.log('[wallet] using cached address:', addr)
      return addr
    }
    try {
      const addr_book = await this.cmd('getaddressesbylabel', label, { cache : true })
      const addr_list = Object.keys(addr_book)
      addr = addr_list[0]
    } catch {
      addr = await this.gen_address({ label })
    }
    this._addrs.set(label, addr)
    return addr
  }

  async parse_address (address : string) {
    return this.cmd<AddressInfo>('getaddressinfo', address, { cache : true })
  }

  async send_funds (
    amount  : number,
    address : string,
    mine_block = false
  ) {
    const amt    = amount / SAT_MULTI
    const config = { address, amount: amt, estimate_mode: 'economical' }
    const txid   = await this.cmd<string>('sendtoaddress', config)
    if (mine_block) await this.client.mine_blocks(1)
    return txid
  }

  async ensure_funds (
    min_bal : number
  ) : Promise<void> {
    const bal = await this.balance
    if (bal <= min_bal) {
      await this.drain_faucet(min_bal)
      if (this.network === 'regtest') {
        await this.client.mine_blocks(1)
      }
    }
  }

  async drain_faucet (
    amount   : number,
    address ?: string
  ) : Promise<string> {
    if (address === undefined) {
      address = await this.new_address
    }
    const faucet = this.client.core.faucet
    const balance = await faucet.balance
    if (balance <= amount + 10000) {
      throw new Error('faucet is broke!')
    } else {
      return faucet.send_funds(amount, address)
    }
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

  async create_txout (
    amount   : number | bigint,
    address ?: string,
  ) {
    if (typeof address !== 'string') {
      address = await this.new_address
    }
    return {
      value : BigInt(amount),
      scriptPubKey : parse_addr(address).asm
    }
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

    txdata.vout.push({
      value        : change_sats,
      scriptPubKey : await this.new_scriptkey
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