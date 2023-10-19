import { buffer_tx }  from '@scrow/tapscript/tx'
import { CoreDaemon } from './core.js'
import { CoreWallet } from './wallet.js'

import {
  parse_args,
  run_cmd
} from './cmd.js'

import {
  cmd_config,
  core_config
} from '../config.js'

import {
  TxBytes,
  TxData
} from '@scrow/tapscript'

import {
  BlockQuery,
  ClientConfig,
  MethodArgs,
  ScanAction,
  ScanObject,
  ScanResults,
  WalletList,
  CoreTx,
  CoreConfig,
  CmdConfig,
  TxStatus,
  BlockData,
  BlockHeader
} from '../types/index.js'

export class CoreClient {
  readonly _core : CoreDaemon
  readonly _opt  : CoreConfig
  
  params  : string[]

  _cache  : [ string, unknown ]
  _faucet : CoreWallet | null

  constructor (
    core    : CoreDaemon,
    config ?: Partial<ClientConfig>
  ) {
    const opt = core_config(config)

    const { debug } = opt

    this._cache = [ 'null', null ]

    this.params = [
      `-chain=${opt.network}`,
      `-rpcport=${opt.rpc_port}`,
      ...opt.params,
      ...opt.cli_params
    ]

    if (opt.confpath !== undefined) {
      this.params.push(`-conf=${opt.confpath}`)
    }

    if (opt.datapath !== undefined) {
      this.params.push(`-datadir=${opt.datapath}`)
    }

    if (opt.cookiepath !== undefined) {
      this.params.push(`-rpccookiefile=${opt.cookiepath}`)
    }

    this._opt    = opt
    this._core   = core
    this._faucet = null

    if (debug) console.log('[debug] Initializing CLI with params:', this.params.join(' '))
  }

  get opt () : CoreConfig {
    return this._opt
  }

  get chain_info () {
    return this.cmd<Record<string, any>>('getblockchaininfo')
  }

  get core () {
    return this._core
  }

  get wallets_loaded () {
    return this.cmd<string[]>('listwallets', null, { cache : true })
  }

  get wallets_created () {
    return this.cmd<WalletList>('listwalletdir', null, { cache : true })
      .then(e => e.wallets.map(x => x.name))
  }

  async cmd <T = Record<string, string>> (
    method  : string,
    args   ?: MethodArgs,
    config ?: Partial<CmdConfig>
  ) : Promise<T> {
    const { clipath = 'bitcoin-cli', debug } = this.opt
    const { cache, params } = cmd_config(config)
    const parsed  = parse_args(method, args)
    const witness = [ ...this.params, ...params, ...parsed ]
    const label   = witness.join('')
    if (debug) {
      const offset = this.params.length
      console.log('[client] cmd:', witness.slice(offset).join(' '))
    }
    if (cache && this._cache[0] === label) {
      if (debug) console.log('[client] using cache for method:', method)
      return this._cache[1] as T
    } 
    const data  = await run_cmd<T>(clipath, witness)
    this._cache = [ label, data ]
    return data
  }

  async _get_block_data (
    query : BlockQuery, 
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

  async get_block (query : BlockQuery) {
    return this._get_block_data(query, true) as Promise<BlockData>
  }

  async get_header (query : BlockQuery) {
    return this._get_block_data(query, false) as Promise<BlockHeader>
  }

  async scan_txout (
    action  : ScanAction,
    ...desc : (string | ScanObject)[]
  ) {
    return this.cmd<ScanResults>('scantxoutset', [ action, JSON.stringify(desc) ])
  }

  async mine_blocks (count = 1, addr ?: string) {
    if (this.opt.network !== 'regtest') {
      throw new Error('You can only generate funds on regtest network!')
    }
    if (addr === undefined) {
      addr = await this.core.faucet.get_address('faucet')
    }
    return this.cmd('generatetoaddress', [ count, addr ])
  }

  async get_tx (txid : string) {
    let txdata : CoreTx,
        status : TxStatus = { confirmed : false }
    try {
      txdata = await this.cmd<CoreTx>('getrawtransaction', [ txid, true ], { cache : true })
    } catch (err) {
      return null
    }
    const { hex, ...data } = txdata
    const block_hash = txdata.blockhash
    const block_time = txdata.blocktime
    if (block_hash !== undefined && block_time !== undefined) {
      const { height } = await this.get_header({ hash : block_hash })
      status = { confirmed : true, block_height : height, block_hash, block_time }
    }
    return { data, hex, status }
  }

  async get_utxos (addr : string) {
    return this.scan_txout('start', `addr(${addr})`).then(res => {
      const { success, unspents } = res
      return (success) ? unspents : null
    })
  }

  async load_wallet (name : string) {
    const wallet = new CoreWallet(this, name)
    await wallet.load()
    await wallet.init()
    return wallet
  }

  async load_wallets (...labels : string[]) {
    const wallets : Record<string, CoreWallet> = {}
    const files = await this.wallets_created
    const names = await this.wallets_loaded
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

  async publish_tx (
    txdata : TxBytes | TxData,
    confirm = false
  ) {
    const txhex = buffer_tx(txdata).hex
    const txid  = await this.cmd<string>('sendrawtransaction', [ txhex ])
    if (confirm) await this.mine_blocks(1)
    return txid
  }
}
