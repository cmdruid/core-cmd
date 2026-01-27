import * as BTC from '@vbyte/btc-dev'
import { Buff } from '@vbyte/buff'
import { create_core_debug } from '../util/debug.js'
import { now, deep_copy } from '@vbyte/util'
import { CoreDaemon } from './core.js'
import { CoreWallet } from './wallet.js'
import { CommandError } from './errors.js'

// Type assertion for namespace exports (library types don't match JS exports)
const { parse_script } = (BTC as any).SCRIPT
const { encode_tx } = (BTC as any).TX

type TxData = BTC.TxData
type TxBytes = string | Uint8Array | Buff

const debug = create_core_debug('client')

import {
  parse_args,
  run_cmd
} from '../lib/cmd.js'

import {
  cmd_config,
  core_config
} from '../config.js'

import {
  convert_value,
  convert_vout
} from '../lib/util.js'

import {
  BlockQuery,
  ClientConfig,
  MethodArgs,
  ScanAction,
  ScanObject,
  ScanResults,
  WalletList,
  CoreConfig,
  CmdConfig,
  BlockData,
  BlockHeader,
  ScanOptions,
  TxOutpoint,
  TxResult,
  TxStatus,
} from '../types/index.js'

export class CoreClient {
  _core: CoreDaemon
  readonly _opt: CoreConfig

  params: string[]

  _cache: [string, unknown]
  _faucet: CoreWallet | null

  constructor(
    core: CoreDaemon | null,
    config?: Partial<ClientConfig>
  ) {
    const opt = core_config(config)

    this._cache = ['null', null]

    this.params = [
      `-chain=${opt.network}`,
      ...opt.params,
      ...opt.cli_params
    ]

    if (opt.rpc_user !== undefined) {
      this.params.push(`-rpcuser=${opt.rpc_user}`)
    }

    if (opt.rpc_pass !== undefined) {
      this.params.push(`-rpcpassword=${opt.rpc_pass}`)
    }

    if (opt.rpc_port !== undefined) {
      this.params.push(`-rpcport=${opt.rpc_port}`)
    }

    if (opt.confpath !== undefined) {
      this.params.push(`-conf=${opt.confpath}`)
    }

    if (opt.datapath !== undefined) {
      this.params.push(`-datadir=${opt.datapath}`)
    }

    if (opt.cookiepath !== undefined) {
      this.params.push(`-rpccookiefile=${opt.cookiepath}`)
    }

    this._opt = opt
    this._core = core!
    this._faucet = null

    debug('initializing with params: %s', this.params.join(' '))
  }

  // ============================================================
  // Synchronous getters (these are fine as getters)
  // ============================================================

  get opt(): CoreConfig {
    return this._opt
  }

  get core() {
    return this._core
  }

  get network(): string {
    return this._opt.network
  }

  // ============================================================
  // Async methods (snake_case API)
  // ============================================================

  /**
   * Get the current block count
   */
  async get_block_count(): Promise<number> {
    return this.cmd<number>('getblockcount')
  }

  /**
   * Get blockchain info
   */
  async get_chain_info(): Promise<Record<string, any>> {
    return this.cmd<Record<string, any>>('getblockchaininfo')
  }

  /**
   * Get list of loaded wallets
   */
  async get_loaded_wallets(): Promise<string[]> {
    return this.cmd<string[]>('listwallets', null, { cache: true })
  }

  /**
   * Get list of created wallets in wallet directory
   */
  async get_created_wallets(): Promise<string[]> {
    const list = await this.cmd<WalletList>('listwalletdir', null, { cache: true })
    return list.wallets.map(x => x.name)
  }

  // ============================================================
  // RPC Command execution
  // ============================================================

  async cmd<T = Record<string, string>>(
    method: string,
    args?: MethodArgs,
    config?: Partial<CmdConfig>
  ): Promise<T> {
    const { clipath = 'bitcoin-cli', use_cache } = this.opt
    const { cache, params } = cmd_config(config)
    const parsed = parse_args(method, args)
    const witness = [...this.params, ...params, ...parsed]
    const label = witness.join('')
    debug('cmd: %s', parsed.join(' '))
    if (cache && use_cache && this._cache[0] === label) {
      debug('using cache for method: %s', method)
      return deep_copy(this._cache[1]) as T
    }
    const data = await run_cmd<T>(clipath, witness)
    this._cache = [label, data]
    return deep_copy(data) as T
  }

  // ============================================================
  // Block operations
  // ============================================================

  async _get_block_data(
    query: BlockQuery,
    txdata = false
  ) {
    let { height, hash } = query
    if (height === undefined && hash === undefined) {
      height = await this.cmd<number>('getblockcount')
    }
    if (typeof height === 'number') {
      hash = await this.cmd<string>('getblockhash', height)
    }
    if (typeof hash !== 'string') {
      throw new Error('Unable to fetch any blocks!')
    }
    return (txdata === true)
      ? this.cmd<BlockData>('getblock', hash)
      : this.cmd<BlockHeader>('getblockheader', hash)
  }

  /**
   * Get block data by height or hash
   */
  async get_block(query: BlockQuery): Promise<BlockData> {
    return this._get_block_data(query, true) as Promise<BlockData>
  }

  /**
   * Get block header by height or hash
   */
  async get_header(query: BlockQuery): Promise<BlockHeader> {
    return this._get_block_data(query, false) as Promise<BlockHeader>
  }

  // ============================================================
  // UTXO Scanning
  // ============================================================

  /**
   * Scan the UTXO set
   */
  async scan_txout(
    action: ScanAction,
    ...desc: (string | ScanObject)[]
  ): Promise<ScanResults> {
    return this.cmd<ScanResults>('scantxoutset', [action, JSON.stringify(desc)])
  }

  // ============================================================
  // Mining (regtest only)
  // ============================================================

  /**
   * Mine blocks on regtest network
   * @param count Number of blocks to mine
   * @param addr Address to receive coinbase (optional)
   */
  async mine_blocks(count = 1, addr?: string): Promise<string[]> {
    if (this.opt.network !== 'regtest') {
      throw new Error('You can only generate funds on regtest network!')
    }
    if (addr === undefined) {
      addr = await this.core.faucet.get_address('faucet')
    }
    debug('mining %d blocks to %s', count, addr)
    return this.cmd<string[]>('generatetoaddress', [count, addr])
  }

  // ============================================================
  // Transaction operations
  // ============================================================

  /**
   * Get transaction by txid
   * @returns Transaction data or null if not found
   */
  async get_tx(txid: string): Promise<TxResult | null> {
    try {
      const res = await this.cmd<TxResult>('getrawtransaction', [txid, 2])
      res.vout = convert_vout(res.vout)
      return res
    } catch (err) {
      // Only return null for "not found" errors (code -5)
      if (err instanceof CommandError && err.stderr.includes('error code: -5')) {
        return null
      }
      // Rethrow unexpected errors
      throw err
    }
  }

  /**
   * Get transaction status (confirmations, block info)
   */
  async get_tx_status(txid: string): Promise<TxStatus | null> {
    const tx = await this.get_tx(txid)
    if (tx === null) return null
    const blocks = await this.get_block_count()
    return get_tx_status(blocks, tx)
  }

  /**
   * Get transaction output
   */
  async get_txout(
    txid: string,
    vout: number
  ): Promise<TxOutpoint | null> {
    const res = await this.cmd<TxOutpoint | null>('gettxout', [txid, vout])
    if (res === null) return null
    const value = convert_value(res.value)
    return { ...res, value }
  }

  /**
   * Get UTXOs by address, pubkey, or script
   */
  async get_utxos(opt: ScanOptions): Promise<ScanResults['unspents']> {
    const desc = get_scan_desc(opt)
    const res = await this.scan_txout('start', desc)
    const { success, unspents } = res
    if (!success) return []
    return unspents.map(e => {
      return { ...e, amount: convert_value(e.amount) }
    })
  }

  /**
   * Get transaction output spent status
   */
  async get_txout_status(txid: string, vout: number): Promise<{ spent: boolean } | null> {
    const txout = await this.get_txout(txid, vout)
    if (txout === null) return null
    const address = txout.scriptPubKey?.address
    if (address === undefined) return null
    if (txout.confirmations === 0) {
      return { spent: false }
    }
    const utxos = await this.get_utxos({ address })
    const utxo = utxos.find(e => e.txid === txid && e.vout === vout)
    if (utxo === undefined) {
      return { spent: true }
    } else {
      return { spent: false }
    }
  }

  /**
   * Get transaction input with prevout data
   */
  async get_tx_input(txid: string, vout: number) {
    const tx = await this.get_tx(txid)
    if (tx === null) return null
    const txout = tx.vout.at(vout)
    if (txout === undefined) return null

    const blocks = await this.get_block_count()
    const status = get_tx_status(blocks, tx)

    const { value, scriptPubKey } = txout
    const script = parse_script(scriptPubKey.hex)
    const prevout = { value, scriptPubKey: script.asm }
    const txinput = {
      txid,
      vout,
      prevout
    }
    return { txinput, status }
  }

  // ============================================================
  // Wallet operations
  // ============================================================

  /**
   * Load or create a wallet
   */
  async load_wallet(name: string): Promise<CoreWallet> {
    const wallet = new CoreWallet(this, name)
    await wallet.load()
    await wallet.init()
    return wallet
  }

  /**
   * Load multiple wallets
   */
  async load_wallets(...labels: string[]): Promise<Record<string, CoreWallet>> {
    const wallets: Record<string, CoreWallet> = {}
    const files = await this.get_created_wallets()
    const names = await this.get_loaded_wallets()
    for (const label of labels) {
      const wallet = new CoreWallet(this, label)
      if (!names.includes(label)) {
        if (!files.includes(label)) {
          await wallet._create()
        } else {
          await wallet._load()
        }
      }
      wallets[label] = wallet
    }
    return wallets
  }

  // ============================================================
  // Transaction publishing
  // ============================================================

  /**
   * Publish a transaction to the network
   * @param txdata Transaction as hex string, bytes, or TxData object
   * @param confirm Whether to mine a block after publishing (regtest only)
   */
  async publish_tx(
    txdata: TxBytes | TxData,
    confirm = false
  ): Promise<string> {
    // Convert transaction to hex
    let txhex: string
    if (typeof txdata === 'string') {
      txhex = txdata
    } else if (txdata instanceof Uint8Array || txdata instanceof Buff) {
      txhex = new Buff(txdata).hex
    } else {
      txhex = encode_tx(txdata as TxData).hex
    }
    const txid = await this.cmd<string>('sendrawtransaction', [txhex])
    if (confirm) await this.mine_blocks(1)
    return txid
  }

  // ============================================================
  // Time manipulation (regtest only)
  // ============================================================

  /**
   * Set mock time on regtest
   */
  async set_time(timestamp?: number): Promise<void> {
    if (this.opt.network !== 'regtest') {
      throw new Error('You can only manipulate time on regtest network!')
    }
    const ts = timestamp ?? now()
    await this.cmd<string>('setmocktime', [ts])
  }
}

// ============================================================
// Helper functions
// ============================================================

function get_scan_desc(opt: ScanOptions): string {
  if (opt.address !== undefined) {
    return `addr(${opt.address})`
  } else if (opt.pubkey !== undefined) {
    return `combo(${opt.pubkey})`
  } else if (opt.script) {
    return `raw(${opt.script})`
  }
  throw new Error('No scan option specified!')
}

function get_tx_status(
  blocks: number,
  tx: TxResult
): TxStatus {
  if (tx.confirmations !== undefined && tx.confirmations > 0) {
    const block_hash = tx.blockhash as string
    const block_time = tx.blocktime as number
    const block_height = blocks - tx.confirmations
    return { confirmed: true, block_height, block_hash, block_time }
  } else {
    return { confirmed: false }
  }
}
