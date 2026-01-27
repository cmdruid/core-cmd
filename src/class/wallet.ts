import { Buff } from '@vbyte/buff'
import * as BTC from '@vbyte/btc-dev'
import { create_core_debug } from '../util/debug.js'
import { Assert } from '@vbyte/util'
import { CoreClient } from './client.js'
import { SigningContext } from './signing.js'
import { cmd_config } from '../config.js'
import { HDKey } from '@scure/bip32'
import { Transaction } from '@scure/btc-signer'
import { sign_message } from '../util/crypto.js'

const debug = create_core_debug('wallet')

// Helper function for BIP32 path parsing
function bip32Path(path: string): number[] {
  const parts = path.split('/')
  if (parts[0] === 'm') parts.shift()
  return parts.map(p => {
    const hardened = p.endsWith("'") || p.endsWith('h')
    const num = parseInt(p.replace(/[h']/, ''), 10)
    return hardened ? num + BIP32_HARDENED_FLAG : num
  })
}

// Extract needed functions from BTC modules (type assertion for namespace exports)
const { encode_script, parse_script } = (BTC as any).SCRIPT
const { P2TR, P2WPKH, parse_address } = (BTC as any).ADDRESS
const { encode_tapscript, encode_taptweak } = (BTC as any).TAPROOT
const { create_tx, decode_tx } = (BTC as any).TX

// Type imports
type Network = BTC.ChainNetwork
type ScriptWord = string | number | Uint8Array
type SigHashOptions = BTC.SigHashOptions
type TxData = BTC.TxData
type TxTemplate = BTC.TxTemplate

import {
  parse_descriptor,
  parse_desc_item
} from '../lib/descriptors.js'

import {
  AddressConfig,
  AddressInfo,
  AddressType,
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

import type {
  BuildTxOptions,
  ExternalSignature,
  InputSighash,
  KeyPair,
  KeyType,
  UnsignedTx
} from '../types/signing.js'

import {
  DUST_LIMIT,
  MIN_TX_FEE,
  SAT_MULTI,
  RANDOM_SORT,
  TXIN_SIZE,
  WIT_VSIZE,
  TXO_SIZE,
  BIP32_HARDENED_FLAG,
  RBF_SEQUENCE,
  TAPROOT_VERSION
} from '../const.js'

export class CoreWallet {
  readonly _addrs: Map<string, string>
  readonly _client: CoreClient
  readonly _config: WalletConfig
  readonly _label: string

  _txfee?: number | null

  constructor(
    client: CoreClient,
    label: string,
    config: WalletConfig = {}
  ) {
    this._addrs = new Map()
    this._config = config
    this._client = client
    this._label = label
    this._txfee = null
  }

  // ============================================================
  // Synchronous getters (these are fine)
  // ============================================================

  get client() {
    return this._client
  }

  get label(): string {
    return this._label
  }

  get network() {
    return this.client.opt.network
  }

  // ============================================================
  // Async methods (snake_case API)
  // ============================================================

  /**
   * Get wallet info
   */
  async get_info(): Promise<WalletInfo> {
    return this.cmd<WalletInfo>('getwalletinfo', null, { cache: true })
  }

  /**
   * Check if wallet is created in the wallet directory
   */
  async is_created_check(): Promise<boolean> {
    const wallets = await this.client.get_created_wallets()
    return Array.isArray(wallets) && wallets.includes(this.label)
  }

  /**
   * Check if wallet is loaded
   */
  async is_loaded_check(): Promise<boolean> {
    const wallets = await this.client.get_loaded_wallets()
    return Array.isArray(wallets) && wallets.includes(this.label)
  }

  /**
   * Get wallet balance in satoshis
   */
  async get_balance(): Promise<number> {
    const bal = await this.cmd<string>('getbalance', null, { cache: true })
    return Math.floor(Number(bal) * SAT_MULTI)
  }

  /**
   * Generate a new address
   */
  async generate_address(config?: AddressConfig): Promise<string> {
    return this.cmd<string>('getnewaddress', config)
  }

  /**
   * Generate a new scriptkey (for use in transactions)
   */
  async generate_script_key(): Promise<ScriptWord[]> {
    const address = await this.generate_address()
    const addr_info = parse_address(address)
    return addr_info.script.asm
  }

  /**
   * List unspent transaction outputs
   */
  async list_utxos(): Promise<UTXO[]> {
    const utxos = await this.cmd<UTXO[]>('listunspent', 0, { cache: true })
    return utxos.map(x => ({ ...x, sats: Math.round(x.amount * SAT_MULTI) }))
  }

  /**
   * List wallet descriptors
   * @param includePrivate Whether to include private key data
   */
  async list_descriptors(includePrivate = false) {
    const result = await this.cmd<WalletDescriptors>('listdescriptors', includePrivate, { cache: true })
    return result.descriptors.map(x => parse_desc_item(x))
  }

  /**
   * Get the wpkh xprv descriptor key string
   */
  async get_wpkh_xprv(): Promise<string> {
    const xprvs = await this.list_descriptors(true)
    const wpkh = xprvs.find(e => e.keytype === 'wpkh')
    if (wpkh === undefined) {
      throw new Error('unable to locate wpkh descriptor')
    }
    return wpkh.keystr
  }

  /**
   * Get the wpkh xpub descriptor key string
   */
  async get_wpkh_xpub(): Promise<string> {
    const xpubs = await this.list_descriptors(false)
    const wpkh = xpubs.find(e => e.keytype === 'wpkh')
    if (wpkh === undefined) {
      throw new Error('unable to locate wpkh descriptor')
    }
    return wpkh.keystr
  }

  /**
   * Get or create an address with the given label
   */
  async get_address(label: string, type: AddressType = 'bech32'): Promise<string> {
    let addr = this._addrs.get(label)
    if (addr !== undefined) {
      debug('using saved address: %s', addr)
      return addr
    }
    try {
      const addr_book = await this.cmd('getaddressesbylabel', label, { cache: true })
      const addr_list = Object.keys(addr_book)
      addr = addr_list[0]
    } catch {
      addr = await this.generate_address({ label, address_type: type })
    }
    this._addrs.set(label, addr)
    return addr
  }

  /**
   * Parse address information
   */
  async parse_address(address: string): Promise<AddressInfo> {
    return this.cmd<AddressInfo>('getaddressinfo', address, { cache: true })
  }

  /**
   * Get public key from address
   */
  async get_pubkey(address: string): Promise<string> {
    const desc = await this.parse_address(address)
    return parse_descriptor(desc.desc).keystr
  }

  /**
   * Generate a new address and return its public key
   */
  async generate_pubkey(config: AddressConfig): Promise<string> {
    const address = await this.generate_address(config)
    return this.get_pubkey(address)
  }

  /**
   * Get descriptor key pair from address
   */
  async get_descriptor(address: string): Promise<DescriptorKeyPair> {
    const addr_data = await this.parse_address(address)
    const addr_desc = parse_descriptor(addr_data.desc)
    const wall_xprvs = await this.list_descriptors(true)
    const addr_xprv = wall_xprvs.find(e => e.label === addr_desc.parent_label)
    Assert.exists(addr_xprv)
    const hd_mst = HDKey.fromExtendedKey(addr_xprv.keystr, { private: 70615956, public: 70617039 })
    const hd_chd = hd_mst.derive('m' + addr_desc.fullpath)
    const is_p2tr = addr_desc.keytype.includes('tr')
    Assert.exists(hd_chd.privateKey)
    Assert.exists(hd_chd.publicKey)
    const seckey = new Buff(hd_chd.privateKey).hex
    const pubkey = is_p2tr
      ? new Buff(hd_chd.publicKey).slice(1).hex  // Remove prefix for taproot
      : new Buff(hd_chd.publicKey).hex
    return {
      pubkey,
      seckey,
      desc: addr_data.desc,
      master: addr_xprv.keystr,
      mprint: addr_data.hdmasterfingerprint,
      path: addr_desc.fullpath
    }
  }

  /**
   * Generate address and get its descriptor
   */
  async generate_descriptor(config: AddressConfig): Promise<DescriptorKeyPair> {
    const address = await this.generate_address(config)
    return this.get_descriptor(address)
  }

  /**
   * Send funds to an address
   * @param amount Amount in satoshis
   * @param address Destination address
   * @param mineBlock Whether to mine a block after sending (regtest only)
   */
  async send_funds(
    amount: number,
    address: string,
    mine_block = false
  ): Promise<string> {
    const amt = amount / SAT_MULTI
    const config = { address, amount: amt, estimate_mode: 'economical' }
    debug('sending %d sats to %s', amount, address)
    const txid = await this.cmd<string>('sendtoaddress', config)
    if (mine_block) await this.client.mine_blocks(1)
    return txid
  }

  /**
   * Ensure wallet has at least the specified balance
   */
  async ensure_funds(min_bal: number): Promise<void> {
    const bal = await this.get_balance()
    if (bal <= min_bal && this.label !== 'faucet') {
      await this.drain_faucet(min_bal)
      if (this.network === 'regtest') {
        await this.client.mine_blocks(1)
      }
    }
  }

  /**
   * Get funds from the faucet wallet
   */
  async drain_faucet(
    amount: number,
    address?: string
  ): Promise<string> {
    if (address === undefined) {
      address = await this.generate_address()
    }
    const faucet = this.client.core.faucet
    const balance = await faucet.get_balance()
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

  /**
   * Get xprv descriptor by label
   */
  async get_xprv(label: string) {
    const xprvs = await this.list_descriptors(true)
    return xprvs.find(e => label === e.label)
  }

  /**
   * Get signer for descriptor
   */
  async get_signer(desc: string) {
    const { parent_label, fullpath } = parse_descriptor(desc)
    const xprv = await this.get_xprv(parent_label)
    Assert.ok(xprv?.extkey !== undefined)
    const hdkey = xprv.extkey
    const derived = hdkey.derive('m' + fullpath)
    Assert.ok(derived.privateKey !== null)
    const pubkey = derived.publicKey ? new Buff(derived.publicKey).hex : ''
    const privateKey = derived.privateKey

    // Create a sign_tx function based on keytype
    const sign_tx = (txdata: TxData, config: SigHashOptions) => {
      if (!privateKey) {
        throw new Error('Private key not available')
      }

      // Create sighash using BTC library based on descriptor type
      const { hash_segwit_tx, hash_taproot_tx } = (BTC as any).SIGHASH

      // Use segwit hash for wpkh descriptors, taproot for tr descriptors
      let sighash: Uint8Array
      try {
        sighash = desc.startsWith('tr')
          ? hash_taproot_tx(txdata, config)
          : hash_segwit_tx(txdata, config)
      } catch (err) {
        debug('sighash computation failed: %O', err)
        throw err
      }

      // Sign using secp256k1
      const signature = sign_message(privateKey, sighash)

      // Add sighash flag byte for Bitcoin signatures
      const sigWithFlag = new Uint8Array(signature.length + 1)
      sigWithFlag.set(signature)
      sigWithFlag[signature.length] = config.sigflag || 0x01

      return sigWithFlag
    }
    return { pubkey, sign_tx }
  }

  /**
   * Create a UTXO by sending funds to an address
   */
  async create_utxo(
    amount: number,
    address: string,
    mine_block?: boolean
  ): Promise<TxPrevout> {
    const value = BigInt(amount)
    const script = parse_address(address).script.hex
    const txid = await this.send_funds(amount, address, mine_block)
    const txdata = await this.client.get_tx(txid)
    Assert.exists(txdata)
    const vout = txdata.vout.findIndex(e => {
      return (
        e.value === amount &&
        e.scriptPubKey.hex === script
      )
    })
    Assert.ok(vout !== -1, 'matching output not found in transaction')
    return { txid, vout, prevout: { value, scriptPubKey: script } }
  }

  /**
   * Select UTXOs to fund a transaction
   */
  async select_utxos(
    amount: number,
    sorter = RANDOM_SORT
  ): Promise<UTXO[]> {
    const selected: UTXO[] = []

    let total = 0

    const utxos = await this.list_utxos()
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

  /**
   * Fund a transaction template
   */
  async fund_tx(
    template: TxTemplate,
    config: SigHashOptions = {},
    txfee: number = 1000
  ) {
    const txdata = create_tx(template)
    const vamt = txdata.vout.reduce((prev: number, curr: any) => Number(curr.value) + prev, 0)
    const utxos = await this.select_utxos(vamt + txfee)
    const total = utxos.reduce((prev, curr) => curr.sats + prev, 0)

    const change_out: BTC.TxOutput = {
      value: BigInt(total - vamt - txfee),
      script_pk: encode_script(await this.generate_script_key()).hex
    }

    const last_utxo = txdata.vout.at(-1)

    if (
      last_utxo !== undefined &&
      parse_script(last_utxo.script_pk).asm.at(0) === 'OP_RETURN'
    ) {
      const idx = txdata.vout.length - 1
      txdata.vout[idx] = change_out
      txdata.vout.push(last_utxo)
    } else {
      txdata.vout.push(change_out)
    }

    for (let i = 0; i < utxos.length; i++) {
      const { desc, txid, vout, sats, scriptPubKey } = utxos[i]
      const { pubkey, sign_tx } = await this.get_signer(desc)
      // Convert scriptPubKey to script_pk format for BTC library
      const prevout = { value: BigInt(sats), script_pk: scriptPubKey }
      const txinput = {
        txid,
        vout,
        prevout,
        coinbase: null,
        script_sig: null,
        sequence: RBF_SEQUENCE,
        witness: []
      }
      const txconfig = { sigflag: 0x81, pubkey, txinput }
      const signature = sign_tx(txdata, { ...txconfig, ...config })
      // Convert Uint8Array directly to hex without going through Buff
      const sigHex = Buffer.from(signature).toString('hex')
      const witness = [sigHex]
      if (desc.startsWith('wpkh')) witness.push(pubkey)

      txdata.vin.push({ ...txinput, witness })
    }
    return txdata
  }

  /**
   * Add segwit descriptor to PSBT input
   */
  async add_segwit_desc(
    psbt: string,
    pubkey: string,
    index: number
  ): Promise<string> {
    const addr = P2WPKH.create_address(pubkey, this.network as Network)
    const desc = await this.parse_address(addr)
    const pdata = Transaction.fromPSBT(Buffer.from(psbt, 'base64'))
    const der = {
      fingerprint: Buff.hex(desc.hdmasterfingerprint).num,
      path: bip32Path(desc.hdkeypath.replace(/h/g, '\''))
    }
    pdata.updateInput(index, { bip32Derivation: [[new Buff(pubkey), der]] })
    return Buffer.from(pdata.toPSBT(0)).toString('base64')
  }

  /**
   * Add taproot descriptor to PSBT input
   */
  async add_taproot_desc(
    psbt: string,
    pubkey: string,
    index: number,
    scripts: string[] = [],
    version = TAPROOT_VERSION
  ): Promise<string> {
    // Use encode_taptweak to compute the tweaked public key
    const tweak_result = encode_taptweak(pubkey)
    const tapkey = tweak_result.slice(1).hex  // Remove prefix byte
    const addr = P2TR.create_address(tapkey, this.network as Network)
    const desc = await this.parse_address(addr)
    const pdata = Transaction.fromPSBT(Buffer.from(psbt, 'base64'))
    const hashes = scripts.map(e => encode_tapscript(e, version).uint)
    const der = {
      fingerprint: Buff.hex(desc.hdmasterfingerprint).num,
      path: bip32Path(desc.hdkeypath.replace(/h/g, '\''))
    }
    pdata.updateInput(index, { tapBip32Derivation: [[new Buff(pubkey), { hashes, der }]] })
    return Buffer.from(pdata.toPSBT(0)).toString('base64')
  }

  /**
   * Fund a PSBT
   */
  async fund_psbt(
    psbt: string,
    options: FundingOptions = {}
  ): Promise<string> {
    const pdata = Transaction.fromPSBT(Buffer.from(psbt, 'base64'))
    const txdata = decode_tx(pdata.unsignedTx, false)

    let { amount, feerate = 1, vsize = pdata.vsize } = options

    if (amount === undefined) {
      const txin_amt = txdata.vin.reduce((p: bigint, n: any) => {
        return (n.prevout !== null && n.prevout !== undefined)
          ? p + n.prevout.value
          : p + 0n
      }, 0n)

      const txout_amt = txdata.vout.reduce((p: bigint, n: any) => {
        return p + n.value
      }, 0n)

      amount = Number(txout_amt - txin_amt)
    }

    const utxos = await this.select_utxos(amount)
    const total = utxos.reduce((prev, curr) => curr.sats + prev, 0)
    const tsize = vsize + (utxos.length * (TXIN_SIZE + WIT_VSIZE)) + TXO_SIZE
    const txfees = tsize * feerate
    const change = BigInt(total - (amount + txfees))
    const script = await this.generate_script_key()

    pdata.addOutput({
      amount: change,
      script: encode_script(script, false)
    })

    for (let i = 0; i < utxos.length; i++) {
      const { desc, txid, vout, sats, scriptPubKey } = utxos[i]

      const vin_idx = i + pdata.inputsLength

      pdata.addInput({
        txid,
        index: vout,
        witnessUtxo: { amount: BigInt(sats), script: new Buff(scriptPubKey) },
      })

      const d = parse_descriptor(desc)
      const pubkey = (d.extkey !== undefined && d.extkey.publicKey)
        ? new Buff(d.extkey.publicKey).hex
        : d.keystr

      if (d.keytype === 'wpkh') {
        // wpkh pubkey should be 33 bytes (66 hex chars)
        Assert.ok(pubkey.length === 66, `Invalid wpkh pubkey size: ${pubkey.length / 2} bytes`)
        pdata.updateInput(vin_idx, {
          bip32Derivation: [
            [
              new Buff(pubkey),
              { fingerprint: Buff.hex(d.parent_label).num, path: bip32Path('m' + d.fullpath) }
            ]
          ]
        })
      } else if (d.keytype === 'tr') {
        // taproot pubkey should be 32 bytes (64 hex chars)
        Assert.ok(pubkey.length === 64, `Invalid taproot pubkey size: ${pubkey.length / 2} bytes`)
        pdata.updateInput(vin_idx, {
          tapBip32Derivation: [
            [
              new Buff(pubkey),
              {
                hashes: [],
                der: {
                  fingerprint: Buff.hex(d.parent_label).num,
                  path: bip32Path('m' + d.fullpath)
                }
              }
            ]
          ]
        })
      } else {
        throw new Error('unknown key type: ' + d.keytype)
      }
    }

    return Buffer.from(pdata.toPSBT(0)).toString('base64')
  }

  /**
   * Sign a PSBT
   */
  async sign_psbt(psbt: string): Promise<string> {
    const ret = await this.cmd('walletprocesspsbt', [psbt, true])
    return ret['psbt']
  }

  // ============================================================
  // External Signing API
  // ============================================================

  /**
   * Export keypair for an address
   *
   * @example
   * const keypair = await wallet.export_keypair(address)
   * // keypair.type === 'taproot' | 'segwit'
   * // keypair.seckey - 32-byte private key (hex)
   * // keypair.pubkey - 32 or 33 byte public key (hex)
   */
  async export_keypair(address: string): Promise<KeyPair> {
    const desc_pair = await this.get_descriptor(address)
    const addr_data = await this.parse_address(address)
    const parsed = parse_descriptor(addr_data.desc)

    const key_type: KeyType = parsed.keytype.includes('tr') ? 'taproot' : 'segwit'

    return {
      type        : key_type,
      pubkey      : desc_pair.pubkey,
      seckey      : desc_pair.seckey,
      path        : desc_pair.path,
      fingerprint : desc_pair.mprint,
      descriptor  : desc_pair.desc
    }
  }

  /**
   * Generate new address and export its keypair
   */
  async generate_keypair(
    config?: AddressConfig
  ): Promise<{ address: string; keypair: KeyPair }> {
    const address = await this.generate_address(config)
    const keypair = await this.export_keypair(address)
    return { address, keypair }
  }

  /**
   * Build unsigned transaction with pre-computed sighashes
   *
   * @example
   * const unsigned = await wallet.build_tx(template)
   * // unsigned.sighashes[0].sighash - ready for external signing
   * // unsigned.sighashes[0].key_type - 'taproot' or 'segwit'
   */
  async build_tx(
    template : TxTemplate,
    options  : BuildTxOptions = {}
  ): Promise<UnsignedTx> {
    const { fee = 1000, sigflag = 0x81, change = true } = options

    const txdata = create_tx(template)
    const vamt = txdata.vout.reduce((prev: number, curr: any) => Number(curr.value) + prev, 0)
    const utxos = await this.select_utxos(vamt + fee)
    const total = utxos.reduce((prev, curr) => curr.sats + prev, 0)

    // Add change output if needed
    if (change) {
      const change_amt = total - vamt - fee
      if (change_amt > DUST_LIMIT) {
        const change_script = encode_script(await this.generate_script_key())
        txdata.vout.push({
          value     : BigInt(change_amt),
          script_pk : change_script.hex
        })
      }
    }

    // Add inputs and compute sighashes (without signatures)
    const sighashes: InputSighash[] = []
    const { hash_segwit_tx, hash_taproot_tx } = (BTC as any).SIGHASH

    for (let i = 0; i < utxos.length; i++) {
      const { desc, txid, vout, sats, scriptPubKey } = utxos[i]
      const parsed = parse_descriptor(desc)

      // Determine key type
      const key_type: KeyType = desc.startsWith('tr') ? 'taproot' : 'segwit'

      // Get public key
      const xprv = await this.get_xprv(parsed.parent_label)
      Assert.ok(xprv?.extkey !== undefined)
      const derived = xprv.extkey.derive('m' + parsed.fullpath)
      Assert.ok(derived.publicKey !== null)

      const pubkey = key_type === 'taproot'
        ? new Buff(derived.publicKey).slice(1).hex  // 32-byte x-only
        : new Buff(derived.publicKey).hex           // 33-byte compressed

      // Add input to transaction
      const prevout = { value: BigInt(sats), script_pk: scriptPubKey }
      const txinput = {
        txid,
        vout,
        prevout,
        coinbase   : null,
        script_sig : null,
        sequence   : RBF_SEQUENCE,
        witness    : []
      }

      txdata.vin.push(txinput)

      // Compute sighash
      const sighash_config = { sigflag, pubkey, txinput }
      const sighash = key_type === 'taproot'
        ? hash_taproot_tx(txdata, sighash_config)
        : hash_segwit_tx(txdata, sighash_config)

      sighashes.push({
        index    : i,
        sighash,
        sigflag,
        key_type,
        pubkey
      })
    }

    // Serialize transaction (with empty witnesses)
    const { encode_tx } = (BTC as any).TX
    const tx_hex = encode_tx(txdata).hex

    // Estimate vsize
    const vsize = this._estimate_vsize(txdata)

    return {
      tx_hex,
      sighashes,
      fee,
      vsize
    }
  }

  /**
   * Add external signature to transaction
   */
  async add_signature(
    unsigned  : UnsignedTx,
    signature : ExternalSignature
  ): Promise<UnsignedTx> {
    const sighash = unsigned.sighashes.find(s => s.index === signature.index)
    if (!sighash) {
      throw new Error(`No input at index ${signature.index}`)
    }

    // Validate key type matches
    if (sighash.key_type !== signature.key_type) {
      throw new Error(`Key type mismatch: input ${signature.index} expects ${sighash.key_type}, got ${signature.key_type}`)
    }

    // Decode transaction
    const txdata = decode_tx(unsigned.tx_hex, false)

    // Build witness based on key type
    const sigflag = signature.sigflag ?? 0x01
    let sig_with_flag: string

    if (signature.key_type === 'taproot') {
      // Taproot: 64-byte Schnorr signature
      // Only append sighash flag if not SIGHASH_DEFAULT (0x00) or SIGHASH_ALL (0x01)
      if (sigflag === 0x00 || sigflag === 0x01) {
        sig_with_flag = Buffer.from(signature.signature).toString('hex')
      } else {
        const combined = new Uint8Array(signature.signature.length + 1)
        combined.set(signature.signature)
        combined[signature.signature.length] = sigflag
        sig_with_flag = Buffer.from(combined).toString('hex')
      }
      txdata.vin[signature.index].witness = [sig_with_flag]
    } else {
      // SegWit: DER signature + pubkey
      if (!signature.pubkey) {
        throw new Error('SegWit signatures require pubkey')
      }
      const combined = new Uint8Array(signature.signature.length + 1)
      combined.set(signature.signature)
      combined[signature.signature.length] = sigflag
      sig_with_flag = Buffer.from(combined).toString('hex')
      txdata.vin[signature.index].witness = [sig_with_flag, signature.pubkey]
    }

    const { encode_tx } = (BTC as any).TX
    return {
      ...unsigned,
      tx_hex: encode_tx(txdata).hex
    }
  }

  /**
   * Add multiple signatures at once
   */
  async add_signatures(
    unsigned   : UnsignedTx,
    signatures : ExternalSignature[]
  ): Promise<UnsignedTx> {
    let result = unsigned
    for (const sig of signatures) {
      result = await this.add_signature(result, sig)
    }
    return result
  }

  /**
   * Finalize transaction (returns hex ready for broadcast)
   */
  async finalize_tx(unsigned: UnsignedTx): Promise<string> {
    // Verify all inputs have witnesses
    const txdata = decode_tx(unsigned.tx_hex, false)
    for (let i = 0; i < txdata.vin.length; i++) {
      if (!txdata.vin[i].witness || txdata.vin[i].witness.length === 0) {
        throw new Error(`Input ${i} is missing signature`)
      }
    }
    return unsigned.tx_hex
  }

  /**
   * Create signing context for multi-step workflows
   *
   * @example
   * const ctx = await wallet.create_signing_context(template)
   * ctx.pending_inputs  // [0, 1, 2]
   * ctx.add_signature({ index: 0, key_type: 'taproot', signature: sig })
   * const txhex = await ctx.finalize()
   */
  async create_signing_context(
    template : TxTemplate,
    options? : BuildTxOptions
  ): Promise<SigningContext> {
    const unsigned = await this.build_tx(template, options)
    return new SigningContext(this, unsigned)
  }

  /**
   * Estimate transaction virtual size
   */
  private _estimate_vsize(txdata: TxData): number {
    // Base transaction size (version + locktime + input/output counts)
    const base = 10
    // Non-witness input size: 32 txid + 4 vout + 4 sequence + 1 script length
    const input_base = TXIN_SIZE * txdata.vin.length
    // Output size (approximation)
    const output_size = TXO_SIZE * txdata.vout.length
    // Witness size (approximation): ~26 vbytes per input
    const witness_size = WIT_VSIZE * txdata.vin.length

    return base + input_base + output_size + witness_size
  }

  // ============================================================
  // Private methods
  // ============================================================

  async _create() {
    const payload = { wallet_name: this.label, ...this._config }
    debug('creating wallet: %s', this.label)
    const res = await this.client.cmd<WalletResponse>('createwallet', payload)
    const err = (res.warning !== undefined && res.warning !== '')
    if (err || res.name !== this.label) {
      throw new Error(`Wallet failed to create: ${JSON.stringify(res, null, 2)}`)
    }
  }

  async _load() {
    debug('loading wallet: %s', this.label)
    const res = await this.client.cmd<WalletResponse>('loadwallet', this.label)
    if (res.warning !== undefined || res.name !== this.label) {
      throw new Error(`Wallet failed to load: ${JSON.stringify(res, null, 2)}`)
    }
  }

  async init() {
    const info = await this.get_info()
    if (info.paytxfee === 0) {
      const newtxfee = MIN_TX_FEE / SAT_MULTI
      await this.cmd<boolean>('settxfee', newtxfee)
    }
  }

  async load() {
    if (!await this.is_loaded_check()) {
      if (!await this.is_created_check()) {
        await this._create()
      } else {
        await this._load()
      }
    }
  }

  async cmd<T = Record<string, string>>(
    method: string,
    args: MethodArgs = [],
    config?: Partial<CmdConfig>
  ): Promise<T> {
    const conf = cmd_config(config)
    conf.params = [...conf.params, `-rpcwallet=${this.label}`]
    return this.client.cmd(method, args, conf)
  }
}
