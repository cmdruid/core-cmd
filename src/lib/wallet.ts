import { hd } from '@cmdcode/crypto-utils'

import {
  Address,
  HashConfig,
  SigHash,
  TxBytes,
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

  get name () : string {
    return this._name
  }

  get balance () {
    return this._client.cmd<string>('getbalance')
      .then(bal => Number(bal) * SAT_MULTI)
  }

  get network () {
    return this._client.network
  }

  get newaddress () {
    return this._call<string>('getnewaddress')
  }

  get utxos () {
    return this._call<UTXO[]>('listunspent')
      .then(e => e.map(x => { return { ...x, sats : x.amount * SAT_MULTI }}))
  }

  get xprvs () {
    return this._call<WalletInfo>('listdescriptors', 'true')
      .then(({ descriptors }) => descriptors.map(x => parse_descriptor(x)))
  }

  get xpubs () {
    return this._call<WalletInfo>('listdescriptors')
      .then(({ descriptors }) => descriptors.map(x => parse_descriptor(x)))
  }

  async _call <T = Record<string, string>> (
    method : string,
    args   : MethodArgs = [],
    params : string[]   = []
  ) : Promise<T> {
    const p = [ `-rpcwallet=${this.name}`, ...params ]
    return this._client.cmd(method, args, p)
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

  async get_xprv (label : string) {
    const xprvs = await this.xprvs
    return xprvs.find(e => label === e.label)
  }

  async generate_funds (
    blocks   : number,
    address ?: string
  ) : Promise<void> {
    if (this.network !== 'regtest') {
      throw new Error('You can only generate funds on regtest network!')
    }
    if (address === undefined) {
      address = await this.newaddress
    }
    return this._client.cmd('generatetoaddress', [ blocks, address ])
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
    templ : TxTemplate,
    txfee : number = 1000
  ) {
    const txdata = Tx.create_tx(templ)
    const vamt   = txdata.vout.reduce((prev, curr) => Number(curr.value) + prev, 0)
    const utxos  = await this.select_utxos(vamt + txfee)
    const total  = utxos.reduce((prev, curr) => curr.sats + prev, 0)
    const change = total - vamt - txfee
    const change_addr  = await this.newaddress
    const changePubKey = Address.parse(change_addr).script

    txdata.vout.push({
      value: change, 
      scriptPubKey: changePubKey
    })

    for (let i = 0; i < utxos.length; i++) {
      const { desc, txid, vout, sats, scriptPubKey } = utxos[i]
      const { pubkey, sign_tx } = await this.get_signer(desc)
      const prevout   = { value: sats, scriptPubKey }
      const txinput   = Tx.create_vin({ txid, vout, prevout })
      const signature = sign_tx(txdata, { sigflag: 0x81, pubkey, txinput })
      const witness   = [ signature ]
      if (desc.startsWith('wpkh')) witness.push(pubkey)
      txdata.vin.push({ ...txinput, witness })
    }
    return txdata
  }

  async publish_tx (txdata : TxBytes | TxData) {
    const txhex = Tx.to_bytes(txdata).hex
    return this._client.cmd<string>('sendrawtransaction', [ txhex ])
  }
}