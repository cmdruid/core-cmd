import { parse_args, run_cmd } from './cmd.js'
import { get_config } from '../config.js'

import {
  CLIConfig,
  MethodArgs,
  WalletConfig,
  WalletResponse,
  WalletList,
  TxResult,
  CoreConfig
} from '../types/index.js'

import { CoreWallet } from './wallet.js'

import { ensure_file_exists } from './util.js'
import { ScanAction, ScanObject, ScanResults } from '../types/scan.js'
import { Tx, TxBytes, TxData } from '@scrow/tapscript'

export class CoreClient {
  readonly _opt : CoreConfig

  params  : string[]

  constructor (config : Partial<CLIConfig> = {}) {
    const opt = get_config(config)

    if (opt.cookiepath === undefined) {
      opt.cookiepath = `${opt.datapath}/${opt.network}/.cookie`
    }

    this.params  = [
      `-rpccookiefile=${opt.cookiepath}`,
      `-chain=${opt.network}`,
      ...opt.params
    ]

    if (opt.confpath !== undefined) {
      ensure_file_exists(opt.confpath)
      this.params.push(`-conf=${opt.confpath}`)
    }

    if (opt.rpcport !== undefined) {
      this.params.push(`-rpcport=${opt.rpcport}`)
    }

    this._opt = opt
  }

  get opt () : CoreConfig {
    return this._opt
  }

  get get_info () {
    return this.cmd<Record<string, any>>('getblockchaininfo')
  }

  get list_wallets () {
    return this.cmd<string[]>('listwallets')
  }

  get list_wallet_dir () {
    return this.cmd<WalletList>('listwalletdir')
  }

  async cmd <T = Record<string, string>> (
    method : string,
    args   : MethodArgs = [],
    params : string[]   = []
  ) : Promise<T> {
    const p = [ ...this.params, ...params ]
    p.push(...parse_args(method, args))
    // console.log('params:', p)
    return run_cmd(this.opt.clipath, p)
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
      const { address } = await wallet.get_address('faucet')
      addr = address
    }
    return this.cmd('generatetoaddress', [ count, addr ])
  }

  async get_tx (txid : string) {
    return this.cmd<TxResult>('getrawtransaction', [ txid, true ])
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
    return this.list_wallets
      .then((wallets) => Array.isArray(wallets) && wallets.includes(name))
  }

  async is_wallet_created (name : string) {
    return this.list_wallet_dir
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
    const txhex = Tx.to_bytes(txdata).hex
    return this.cmd<string>('sendrawtransaction', [ txhex ])
  }
}
