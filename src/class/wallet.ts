// External dependencies
import * as BTC           from '@vbyte/btc-dev'
import { Buff }           from '@vbyte/buff'
import { Assert }         from '@vbyte/util'
import { HDKey }          from '@scure/bip32'
import { Transaction }    from '@scure/btc-signer'

// Internal modules
import { CoreClient }                              from '@/class/client.js'
import { WalletError, ConfigError }                from '@/class/errors.js'
import { cmd_config }                              from '@/config.js'
import { parse_descriptor, parse_desc_item }       from '@/lib/descriptors.js'
import { assert_valid_address, assert_valid_amount } from '@/lib/validation.js'
import { create_safe_debug }                       from '@/util/safe-debug.js'
import {
  DUST_LIMIT,
  MIN_TX_FEE,
  SAT_MULTI,
  RANDOM_SORT,
  TXIN_SIZE,
  WIT_VSIZE,
  TXO_SIZE,
  BIP32_HARDENED_FLAG,
  TAPROOT_VERSION
} from '@/const.js'

// Type imports
import type {
  AddressConfig,
  AddressInfo,
  AddressType,
  CmdConfig,
  FundingOptions,
  MethodArgs,
  TxPrevout,
  UTXO,
  WalletConfig,
  WalletDescriptors,
  WalletInfo,
  WalletResponse
} from '@/types/index.js'

const debug = create_safe_debug('wallet')

// Extract needed functions from BTC modules (type assertion for namespace exports)
const { encode_script }               = (BTC as any).SCRIPT
const { P2TR, P2WPKH, parse_address } = (BTC as any).ADDRESS
const { encode_taptweak }             = (BTC as any).TAPROOT

// Type aliases
type Network    = BTC.ChainNetwork
type ScriptWord = string | number | Uint8Array

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

/**
 * Key types for Bitcoin addresses
 */
export type KeyType = 'taproot' | 'segwit'

/**
 * Extracted private key (child key only, no master)
 *
 * @security This contains sensitive private key material.
 * Handle with extreme care - see extract_private_key() documentation.
 */
export interface ExtractedKey {
  /** Bitcoin address this key controls */
  address     : string
  /** Key type: 'taproot' (32-byte x-only) or 'segwit' (33-byte compressed) */
  type        : KeyType
  /** Public key in hex */
  pubkey      : string
  /** Private key in hex (32 bytes) - SENSITIVE */
  seckey      : string
  /** BIP32 derivation path from master */
  path        : string
  /** Master key fingerprint */
  fingerprint : string
}

/**
 * PSBT creation options
 */
export interface PsbtOptions {
  /** Fee rate in sat/vB (default: 1) */
  fee_rate?       : number
  /** Include change output (default: true) */
  include_change? : boolean
  /** Lock unspent outputs used (default: false) */
  lock_unspents?  : boolean
  /** Confirmation target in blocks for fee estimation */
  conf_target?    : number
  /** Fee estimation mode: 'economical' | 'conservative' */
  estimate_mode?  : 'economical' | 'conservative'
}

/**
 * Result from PSBT creation
 */
export interface PsbtResult {
  /** Base64-encoded PSBT */
  psbt      : string
  /** Fee in satoshis */
  fee       : number
  /** Change position (-1 if no change) */
  changepos : number
}

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
  // Synchronous getters
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

  /**
   * Check if private key export is enabled for this wallet
   */
  get key_export_enabled(): boolean {
    return this._config.allow_key_export === true
  }

  // ============================================================
  // Wallet Info Methods
  // ============================================================

  /**
   * Get wallet info
   */
  async get_info(): Promise<WalletInfo> {
    return this.cmd<WalletInfo>('getwalletinfo')
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
    const bal = await this.cmd<string>('getbalance')
    return Math.floor(Number(bal) * SAT_MULTI)
  }

  // ============================================================
  // Address Methods
  // ============================================================

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
   * Get or create an address with the given label
   */
  async get_address(label: string, type: AddressType = 'bech32'): Promise<string> {
    let addr = this._addrs.get(label)
    if (addr !== undefined) {
      debug('using saved address: %s', addr)
      return addr
    }
    try {
      const addr_book = await this.cmd('getaddressesbylabel', label)
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
    return this.cmd<AddressInfo>('getaddressinfo', address)
  }

  /**
   * Get public key from address (safe - no private key exposure)
   */
  async get_pubkey(address: string): Promise<string> {
    const desc = await this.parse_address(address)
    return parse_descriptor(desc.desc).keystr
  }

  /**
   * Generate a new address and return its public key (safe - no private key exposure)
   */
  async generate_pubkey(config?: AddressConfig): Promise<string> {
    const address = await this.generate_address(config)
    return this.get_pubkey(address)
  }

  // ============================================================
  // UTXO Methods
  // ============================================================

  /**
   * List unspent transaction outputs
   */
  async list_utxos(): Promise<UTXO[]> {
    const utxos = await this.cmd<UTXO[]>('listunspent', 0)
    return utxos.map(x => ({ ...x, sats: Math.round(x.amount * SAT_MULTI) }))
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
      if (total === amount || total > amount + DUST_LIMIT) {
        return selected
      }
    }

    throw new WalletError('Insufficient funds', this.label, 'select_utxos')
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

  // ============================================================
  // Transaction Methods (RPC-based, no internal signing)
  // ============================================================

  /**
   * Send funds to an address
   *
   * Uses Bitcoin Core's sendtoaddress RPC - signing happens in Core.
   *
   * @param amount Amount in satoshis (must be positive, max 21M BTC)
   * @param address Destination address (validated for network)
   * @param mine_block Whether to mine a block after sending (regtest only)
   */
  async send_funds(
    amount: number,
    address: string,
    mine_block = false
  ): Promise<string> {
    assert_valid_amount(amount)
    assert_valid_address(address, this.network)

    const amt = amount / SAT_MULTI
    const config = { address, amount: amt, estimate_mode: 'economical' }
    debug('sending %d sats to %s', amount, address)
    const txid = await this.cmd<string>('sendtoaddress', config)
    if (mine_block) await this.client.mine_blocks(1)
    return txid
  }

  /**
   * Create a funded PSBT
   *
   * Uses Bitcoin Core's walletcreatefundedpsbt RPC.
   * The PSBT will include inputs from this wallet but NO signatures.
   *
   * @param outputs Map of address to amount in BTC (e.g., { "bc1q...": 0.001 })
   * @param options PSBT creation options
   * @returns PSBT result with base64-encoded PSBT
   */
  async create_psbt(
    outputs: Record<string, number>,
    options: PsbtOptions = {}
  ): Promise<PsbtResult> {
    const {
      fee_rate = 1,
      include_change = true,
      lock_unspents = false,
      conf_target,
      estimate_mode = 'economical'
    } = options

    // Build options object for RPC
    const rpc_options: Record<string, unknown> = {
      includeWatching: false,
      lockUnspents: lock_unspents,
      fee_rate,
      estimate_mode
    }

    if (!include_change) {
      rpc_options.changePosition = -1
    }

    if (conf_target !== undefined) {
      rpc_options.conf_target = conf_target
    }

    // walletcreatefundedpsbt [inputs] [outputs] locktime options
    const result = await this.cmd<PsbtResult>(
      'walletcreatefundedpsbt',
      [[], [outputs], 0, rpc_options]
    )

    return result
  }

  /**
   * Sign a PSBT using Bitcoin Core's wallet
   *
   * Uses walletprocesspsbt RPC - signing happens securely in Core.
   *
   * @param psbt Base64-encoded PSBT
   * @returns Signed PSBT (base64)
   */
  async sign_psbt(psbt: string): Promise<string> {
    const ret = await this.cmd<{ psbt: string; complete: boolean }>(
      'walletprocesspsbt',
      [psbt, true]
    )
    return ret.psbt
  }

  /**
   * Finalize a PSBT and extract the transaction
   *
   * @param psbt Base64-encoded signed PSBT
   * @returns Finalized transaction hex
   */
  async finalize_psbt(psbt: string): Promise<{ hex: string; complete: boolean }> {
    return this.cmd<{ hex: string; complete: boolean }>(
      'finalizepsbt',
      [psbt, true]
    )
  }

  /**
   * Create, sign, and finalize a PSBT in one call
   *
   * Convenience method that combines create_psbt + sign_psbt + finalize_psbt.
   * All signing happens securely in Bitcoin Core.
   *
   * @param outputs Map of address to amount in BTC
   * @param options PSBT creation options
   * @returns Transaction hex ready for broadcast
   */
  async create_and_sign_tx(
    outputs: Record<string, number>,
    options: PsbtOptions = {}
  ): Promise<string> {
    const { psbt } = await this.create_psbt(outputs, options)
    const signed = await this.sign_psbt(psbt)
    const { hex, complete } = await this.finalize_psbt(signed)

    if (!complete) {
      throw new WalletError('Transaction signing incomplete - missing signatures', this.label, 'create_and_sign_tx')
    }

    return hex
  }

  /**
   * Fund an existing PSBT with wallet UTXOs
   *
   * Adds inputs from this wallet to fund the PSBT's outputs.
   * Does NOT sign - use sign_psbt() after.
   */
  async fund_psbt(
    psbt: string,
    options: FundingOptions = {}
  ): Promise<string> {
    const pdata = Transaction.fromPSBT(Buffer.from(psbt, 'base64'))
    const { decode_tx } = (BTC as any).TX
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
      const pubkey = d.extkey?.publicKey
        ? new Buff(d.extkey.publicKey).hex
        : d.keystr

      if (d.keytype === 'wpkh') {
        Assert.ok(pubkey.length === 66, `Invalid wpkh pubkey size: ${pubkey.length / 2} bytes`)
        pdata.updateInput(vin_idx, {
          bip32Derivation: [
            [
              new Buff(pubkey),
              { fingerprint: Buff.hex(d.parent_label).num, path: bip32Path(`m${d.fullpath}`) }
            ]
          ]
        })
      } else if (d.keytype === 'tr') {
        Assert.ok(pubkey.length === 64, `Invalid taproot pubkey size: ${pubkey.length / 2} bytes`)
        pdata.updateInput(vin_idx, {
          tapBip32Derivation: [
            [
              new Buff(pubkey),
              {
                hashes: [],
                der: {
                  fingerprint: Buff.hex(d.parent_label).num,
                  path: bip32Path(`m${d.fullpath}`)
                }
              }
            ]
          ]
        })
      } else {
        throw new ConfigError('Unknown key type', 'key_type', d.keytype)
      }
    }

    return Buffer.from(pdata.toPSBT(0)).toString('base64')
  }

  // ============================================================
  // Descriptor Methods (public info only)
  // ============================================================

  /**
   * List wallet descriptors (public keys only by default)
   *
   * @param includePrivate Whether to include private key data (requires allow_key_export)
   */
  async list_descriptors(includePrivate = false) {
    if (includePrivate && !this.key_export_enabled) {
      throw new ConfigError(
        'Private descriptor export disabled. Set allow_key_export: true in wallet config.',
        'allow_key_export',
        false
      )
    }
    const result = await this.cmd<WalletDescriptors>('listdescriptors', includePrivate)
    return result.descriptors.map(x => parse_desc_item(x))
  }

  // ============================================================
  // Private Key Export (GATED)
  // ============================================================

  /**
   * Extract private key for an address
   *
   * @security WARNING: This method returns sensitive private key material.
   *
   * This method is GATED and requires explicit opt-in:
   * ```typescript
   * const wallet = new CoreWallet(client, 'name', { allow_key_export: true })
   * ```
   *
   * Security requirements:
   * - Never log, print, or persist the returned seckey
   * - Clear from memory immediately after use
   * - Do not transmit over network or store in databases
   * - Use only for authorized external signing protocols
   *
   * Intended use cases:
   * - FROST threshold signatures
   * - MuSig2 multi-signatures
   * - DLCs (Discreet Log Contracts)
   * - Adaptor signatures
   * - Other cryptographic protocols requiring raw key access
   *
   * For standard transactions, use the RPC-based methods instead:
   * - send_funds() - Simple sends
   * - create_psbt() + sign_psbt() - PSBT workflow
   * - create_and_sign_tx() - One-shot transaction creation
   *
   * @param address Bitcoin address to extract key for
   * @returns ExtractedKey with public key and SENSITIVE private key
   * @throws Error if allow_key_export is not enabled
   * @throws Error if address is not in this wallet
   */
  async extract_private_key(address: string): Promise<ExtractedKey> {
    // Security gate
    if (!this.key_export_enabled) {
      throw new ConfigError(
        'Private key export disabled. ' +
        'Set allow_key_export: true in wallet config to enable. ' +
        'This is a security-sensitive operation - only enable if you need ' +
        'raw key access for external signing protocols (FROST, MuSig2, etc.).',
        'allow_key_export',
        false
      )
    }

    debug('extracting private key for address (export enabled)')

    // Get address info
    const addr_data = await this.parse_address(address)
    const addr_desc = parse_descriptor(addr_data.desc)

    // Get private descriptors (we've already checked the gate)
    const result = await this.cmd<WalletDescriptors>('listdescriptors', true)
    const wall_xprvs = result.descriptors.map(x => parse_desc_item(x))
    const addr_xprv = wall_xprvs.find(e => e.label === addr_desc.parent_label)

    if (!addr_xprv) {
      throw new WalletError(`Address ${address} not found`, this.label, 'extract_private_key')
    }

    // Derive the child key (NOT the master)
    const hd_mst = HDKey.fromExtendedKey(addr_xprv.keystr, { private: 70615956, public: 70617039 })
    const hd_chd = hd_mst.derive(`m${addr_desc.fullpath}`)

    Assert.exists(hd_chd.privateKey, 'Failed to derive private key')
    Assert.exists(hd_chd.publicKey, 'Failed to derive public key')

    // Determine key type
    const is_taproot = addr_desc.keytype.includes('tr')
    const key_type: KeyType = is_taproot ? 'taproot' : 'segwit'

    // Format keys appropriately
    const seckey = new Buff(hd_chd.privateKey).hex
    const pubkey = is_taproot
      ? new Buff(hd_chd.publicKey).slice(1).hex  // 32-byte x-only for taproot
      : new Buff(hd_chd.publicKey).hex           // 33-byte compressed for segwit

    return {
      address,
      type        : key_type,
      pubkey,
      seckey,
      path        : addr_desc.fullpath,
      fingerprint : addr_data.hdmasterfingerprint
    }
  }

  /**
   * Generate a new address and extract its private key
   *
   * Convenience method combining generate_address + extract_private_key.
   * Requires allow_key_export: true in wallet config.
   *
   * @param config Address generation config
   * @returns Object with address and extracted key
   */
  async generate_and_extract_key(
    config?: AddressConfig
  ): Promise<{ address: string; key: ExtractedKey }> {
    const address = await this.generate_address(config)
    const key = await this.extract_private_key(address)
    return { address, key }
  }

  // ============================================================
  // Funding helpers
  // ============================================================

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
    if (!this.client.core?.faucet) {
      throw new WalletError('No faucet available', this.label, 'drain_faucet')
    }
    const faucet = this.client.core.faucet
    const balance = await faucet.get_balance()
    if (balance <= amount + 10000) {
      if (this.network !== 'regtest') {
        throw new WalletError('Faucet has insufficient funds', 'faucet', 'drain_faucet')
      } else {
        const mine_addr = await faucet.get_address('faucet')
        await this.client.mine_blocks(100, mine_addr)
      }
    }

    return faucet.send_funds(amount, address, true)
  }

  // ============================================================
  // PSBT Helpers (for advanced PSBT manipulation)
  // ============================================================

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
    const { encode_tapscript } = (BTC as any).TAPROOT
    const tweak_result = encode_taptweak(pubkey)
    const tapkey = tweak_result.slice(1).hex
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

  // ============================================================
  // Internal methods
  // ============================================================

  async _create() {
    const payload = { wallet_name: this.label, ...this._config }
    debug('creating wallet: %s', this.label)
    const res = await this.client.cmd<WalletResponse>('createwallet', payload)
    const err = (res.warning !== undefined && res.warning !== '')
    if (err || res.name !== this.label) {
      throw new WalletError('Wallet creation failed', this.label, '_create')
    }
  }

  async _load() {
    debug('loading wallet: %s', this.label)
    const res = await this.client.cmd<WalletResponse>('loadwallet', this.label)
    if (res.warning !== undefined || res.name !== this.label) {
      throw new WalletError('Wallet load failed', this.label, '_load')
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
