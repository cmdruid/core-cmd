import { Buff }          from '@cmdcode/buff'
import { encode_script } from '@scrow/tapscript/script'
import { CoreClient }    from './client.js'
import { cmd_config }    from '../config.js'
import { get_pubkey }    from '@cmdcode/crypto-tools/keys'
import { HDKey }         from '@scure/bip32'

import { derive_key }               from '@cmdcode/crypto-tools/hd'
import { P2TR, P2WPKH, parse_addr } from '@scrow/tapscript/address'
import { Transaction, bip32Path }   from '@scure/btc-signer'

import {
  encode_tapscript,
  get_taptweak,
  tweak_pubkey
} from '@scrow/tapscript/tapkey'

import {
  Network,
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
  create_vin,
  decode_tx
} from '@scrow/tapscript/tx'

import {
  parse_descriptor,
  parse_desc_item
} from './descriptors.js'

import {
  AddressConfig,
  AddressInfo,
  CmdConfig,
  DescriptorKeyPair,
  FundingOptions,
  MethodArgs,
  TxPrevout,
  UTXO,
  WalletConfig,
  WalletDescriptors,
  WalletInfo,
  WalletResponse
} from '../types/index.js'

import * as assert from '../assert.js'
import * as CONST  from './const.js'

const TXIN_SIZE = 41 // 32 + 4 + 4 + 1
const WIT_VSIZE = 26 // Math.ceil((66 + 34 + 1) / 4)
const TXO_SIZE  = 30 // 8 + 1 + 1 + 20

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
      .then(bal => Math.floor(Number(bal) * SAT_MULTI))
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
    return this.cmd<UTXO[]>('listunspent', 0, { cache : true })
      .then(e => e.map(x => { return { ...x, sats : Math.round(x.amount * SAT_MULTI) }}))
  }

  get xprvs () {
    return this.cmd<WalletDescriptors>('listdescriptors', true, { cache : true })
      .then(({ descriptors }) => descriptors.map(x => parse_desc_item(x)))
  }

  get xpubs () {
    return this.cmd<WalletDescriptors>('listdescriptors', null, { cache : true })
      .then(({ descriptors }) => descriptors.map(x => parse_desc_item(x)))
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

  _debug (...msg : unknown[]) {
    if (this.client.opt.debug) {
      console.log('[wallet]', ...msg)
    }
  }

  _log (...msg : unknown[]) {
    if (this.client.opt.verbose) {
      console.log('[wallet]', ...msg)
    }
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
    let addr = this._addrs.get(label)
    if (addr !== undefined) {
      this._debug('[wallet] using saved address:', addr)
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

  async get_pubkey (address : string) : Promise<string> {
    const desc = await this.parse_address(address)
    return parse_descriptor(desc.desc).keystr
  }

  async gen_pubkey (address_type = 'bech32') : Promise<string> {
    const address = await this.gen_address({ address_type })
    return this.get_pubkey(address)
  }

  async get_descriptor (address : string) : Promise<DescriptorKeyPair> {
    const addr_data  = await this.parse_address(address)
    const addr_desc  = parse_descriptor(addr_data.desc)
    const wall_xprvs = await this.xprvs
    const addr_xprv  = wall_xprvs.find(e => e.label === addr_desc.parent_label)
    assert.exists(addr_xprv)
    const hd_mst  = HDKey.fromExtendedKey(addr_xprv.keystr, { private : 70615956, public : 70617039 })
    const hd_chd  = hd_mst.derive('m' + addr_desc.fullpath)
    const is_p2tr = addr_desc.keytype.includes('tr')
    assert.exists(hd_chd.privateKey)
    assert.exists(hd_chd.publicKey)
    const seckey = new Buff(hd_chd.privateKey).hex
    const pubkey = get_pubkey(seckey, is_p2tr).hex
    return {
      pubkey,
      seckey,
      desc   : addr_data.desc,
      master : addr_xprv.keystr,
      mprint : addr_data.hdmasterfingerprint,
      path   : addr_desc.fullpath
    }
  }

  async gen_descriptor (address_type : string) : Promise<DescriptorKeyPair> {
    const address = await this.gen_address({ address_type })
    return this.get_descriptor(address)
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
    if (bal <= min_bal && this.label !== 'faucet') {
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
      if (this.network !== 'regtest') {
        throw new Error('faucet is broke!')
      } else {
        const mine_addr = await faucet.get_address('faucet')
        await this.client.mine_blocks(100, mine_addr)
      }
    }

    return faucet.send_funds(amount, address, true)
  }

  async get_xprv (label : string) {
    const xprvs = await this.xprvs
    return xprvs.find(e => label === e.label)
  }

  async get_signer (
    desc : string
  ) {
    const { parent_label, fullpath, keytype } = parse_descriptor(desc)
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

  async create_utxo (
    amount  : number,
    address : string,
    mine_block ?: boolean
  ) : Promise<TxPrevout> {
    const value  = BigInt(amount)
    const script = parse_addr(address).hex
    const txid   = await this.send_funds(amount, address, mine_block)
    const txdata = await this.client.get_tx(txid)
    assert.exists(txdata)
    const vout   = txdata.vout.findIndex(e => {
      return (
        e.value === amount &&
        e.scriptPubKey.hex === script
      )
    })
    assert.ok(vout !== -1, 'matching output not found in transaction')
    return { txid, vout, prevout : { value, scriptPubKey : script } }
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
    template : TxTemplate,
    config   : SigHashOptions = {},
    txfee    : number = 1000
  ) {
    const txdata = create_tx(template)
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

  async add_segwit_desc (
    psbt   : string,
    pubkey : string,
    index  : number
  ) {
    const addr  = P2WPKH.create(pubkey, this.network as Network)
    const desc  = await this.parse_address(addr)
    const pdata = Transaction.fromPSBT(Buff.base64(psbt))
    const der   = {
      fingerprint : Buff.hex(desc.hdmasterfingerprint).num,
      path        : bip32Path(desc.hdkeypath.replace(/h/g, '\''))
    }
    pdata.updateInput(index, { bip32Derivation : [[ new Buff(pubkey), der ]] })
    return new Buff(pdata.toPSBT(0)).base64
  }

  async add_taproot_desc (
    psbt    : string,
    pubkey  : string,
    index   : number,
    scripts : string[] = [],
    version = 0xc0
  ) {
    const tweak  = get_taptweak(pubkey)
    const tapkey = tweak_pubkey(pubkey, tweak).slice(1)
    const addr   = P2TR.create(tapkey, this.network as Network)
    const desc   = await this.parse_address(addr)
    const pdata  = Transaction.fromPSBT(Buff.base64(psbt))
    const hashes = scripts.map(e => Buff.hex(encode_tapscript(e, version)))
    const der    = {
      fingerprint : Buff.hex(desc.hdmasterfingerprint).num,
      path        : bip32Path(desc.hdkeypath.replace(/h/g, '\''))
    }
    pdata.updateInput(index, { tapBip32Derivation : [[ new Buff(pubkey), { hashes, der } ]] })
    return new Buff(pdata.toPSBT(0)).base64
  }

  async fund_psbt (
    psbt    : string,
    options : FundingOptions = {}
  ) : Promise<string> {
    const pdata  = Transaction.fromPSBT(Buff.base64(psbt))
    const txdata = decode_tx(pdata.unsignedTx, false)

    let { amount, feerate = 1, vsize = pdata.vsize } = options

    if (amount === undefined) {
      const txin_amt = txdata.vin.reduce((p, n) => {
      return (n.prevout !== undefined)
        ? p + n.prevout.value
        : p + 0n
      }, 0n)

      const txout_amt = txdata.vout.reduce((p, n) => {
        return p + n.value
      }, 0n)
      
      amount = Number(txout_amt - txin_amt)
    }

    const utxos  = await this.select_utxos(amount)
    const total  = utxos.reduce((prev, curr) => curr.sats + prev, 0)
    const tsize  = vsize + (utxos.length * (TXIN_SIZE + WIT_VSIZE)) + TXO_SIZE
    const txfees = tsize * feerate
    const change = BigInt(total - (amount + txfees))
    const script = await this.new_scriptkey

    pdata.addOutput({
      amount : change,
      script : encode_script(script, false)
    })

    for (let i = 0; i < utxos.length; i++) {
      const { desc, txid, vout, sats, scriptPubKey } = utxos[i]

      const vin_idx = i + pdata.inputsLength

      pdata.addInput({
        txid,
        index           : vout,
        witnessUtxo     : { amount : BigInt(sats), script : new Buff(scriptPubKey) },
        // sighashType     : 0x81
      })

      const d      = parse_descriptor(desc)
      const pubkey = (d.extkey !== undefined) ? d.extkey.pubkey : d.keystr

      if (d.keytype === 'wpkh') {
        assert.size(pubkey, 33)
        pdata.updateInput(vin_idx, {
          bip32Derivation : [
            [
              new Buff(pubkey),
              { fingerprint: Buff.hex(d.parent_label).num, path: bip32Path('m' + d.fullpath) }
            ]
          ]
        })
      } else if (d.keytype === 'tr') {
        assert.size(pubkey, 32)
        pdata.updateInput(vin_idx, {
          tapBip32Derivation : [
            [
              new Buff(pubkey),
              {
                hashes : [],
                der    : {
                  fingerprint : Buff.hex(d.parent_label).num,
                  path        : bip32Path('m' + d.fullpath)
                }
              }
            ]
          ]
        })
      } else {
        throw new Error('unknown key type: ' + d.keytype)
      }
    }

    return new Buff(pdata.toPSBT(0)).base64
  }

  async sign_psbt (
    psbt : string,
  ) : Promise<string> {
    const ret = await this.cmd('walletprocesspsbt', [ psbt, true ])
    return ret['psbt']
  }
}
