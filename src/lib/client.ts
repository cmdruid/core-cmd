import { TxBytes, TxData }      from '@scrow/tapscript'
import { buffer_tx, decode_tx } from '@scrow/tapscript/tx'

import { get_config } from '../config.js'
import { CoreWallet } from './wallet.js'

import {
  parse_args,
  run_cmd
} from './cmd.js'

import {
  ensure_file_exists
} from './util.js'

import {
  CLIConfig,
  MethodArgs,
  ScanAction,
  ScanObject,
  ScanResults,
  WalletConfig,
  WalletResponse,
  WalletList,
  TxResult,
  CoreConfig
} from '../types/index.js'

export class CoreClient {
  readonly _opt : CoreConfig

  params : string[]

  constructor (config : Partial<CLIConfig> = {}) {
    const opt = get_config(config)

    const { debug } = opt

    if (
      opt.datapath   !== undefined &&
      opt.cookiepath === undefined
    ) {
      opt.cookiepath = `${opt.datapath}/${opt.network}/.cookie`
    }

    this.params = [
      `-chain=${opt.network}`,
      `-rpcport=${opt.rpc_port}`,
      ...opt.params,
      ...opt.cli_params
    ]

    if (opt.cookiepath !== undefined) {
      this.params.push(`-rpccookiefile=${opt.cookiepath}`)
    }

    if (opt.confpath !== undefined) {
      ensure_file_exists(opt.confpath)
      this.params.push(`-conf=${opt.confpath}`)
    }

    this._opt = opt

    if (debug) console.log('[debug] Initializing CLI with params:', this.params.join(' '))
  }

  get opt () : CoreConfig {
    return this._opt
  }

  get chain_info () {
    return this.cmd<Record<string, any>>('getblockchaininfo')
  }

  get wallets () {
    return this.cmd<string[]>('listwallets')
  }

  get wallet_dirs () {
    return this.cmd<WalletList>('listwalletdir')
  }

  async cmd <T = Record<string, string>> (
    method : string,
    args   : MethodArgs = [],
    params : string[]   = []
  ) : Promise<T> {
    const { clipath = 'bitcoin-cli', debug } = this.opt
    const witness = [
      ...this.params, 
      ...params, 
      ...parse_args(method, args)
    ]
    if (debug) {
      const offset = this.params.length
      console.log('[client] cmd:', witness.slice(offset).join(' '))
    }
    return run_cmd(clipath, witness)
  }

  async scan_txout (
    action  : ScanAction,
    ...desc : (string | ScanObject)[]
  ) {
    return this.cmd<ScanResults>('scantxoutset', [ action, JSON.stringify(desc) ])
  }

  async scan_addr (addr : string) {
    return this.scan_txout('start', `addr(${addr})`).then(res => {
      const { success, unspents } = res
      return (success) ? unspents : []
    })
  }

  async mine_blocks (count = 1, addr ?: string) {
    if (this.opt.network !== 'regtest') {
      throw new Error('You can only generate funds on regtest network!')
    }
    if (addr === undefined) {
      const wallet = await this.get_wallet('faucet')
      addr = await wallet.get_address('faucet')
    }
    return this.cmd('generatetoaddress', [ count, addr ])
  }

  async get_tx (txid : string) {
    const { hex, ...meta } = await this.cmd<TxResult>('getrawtransaction', [ txid, true ])
    return { hex, meta, txdata : decode_tx(hex) }
  }

  async get_wallet (name : string) {
    if (!await this.is_wallet_loaded(name)) {
      if (!await this.is_wallet_created(name)) {
        await this.create_wallet(name)
      } else {
        await this.load_wallet(name)
      }
    }
    return new CoreWallet(this, name)
  }

  async is_wallet_loaded (name : string) {
    return this.wallets
      .then((wallets) => Array.isArray(wallets) && wallets.includes(name))
  }

  async is_wallet_created (name : string) {
    return this.wallet_dirs
      .then((res) => res.wallets.find(e => e.name === name))
  }

  async load_wallet (name : string) {
    const res = await this.cmd<WalletResponse>('loadwallet', name)
    if (res.warning !== undefined || res.name !== name) {
      // If there was a problem with loading, throw error.
      throw new Error(`Wallet failed to load cleanly: ${JSON.stringify(res, null, 2)}`)
    }
  }

  async create_wallet (
    name   : string,
    config : WalletConfig = {}
  ) {
    const payload = { wallet_name: name, ...config }
    const res = await this.cmd<WalletResponse>('createwallet', payload)
    if (
      (res.warning !== undefined && res.warning !== '') ||
      res.name !== name
    ) {
      // If there was a problem with loading, throw error.
      throw new Error(`Wallet failed to create: ${JSON.stringify(res, null, 2)}`)
    }
  }

  async publish_tx (txdata : TxBytes | TxData) {
    const txhex = buffer_tx(txdata).hex
    return this.cmd<string>('sendrawtransaction', [ txhex ])
  }
}
