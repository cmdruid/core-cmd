import { parse_args, run_cmd } from './cmd.js'

import {
  CLIConfig,
  MethodArgs,
  WalletConfig,
  WalletResponse,
  WalletList
} from '../types/index.js'

import { CoreWallet } from './wallet.js'
import { ROOT_PATH }  from '../config.js'

const DEFAULT_CONFIG = {
  cmdpath  : `${ROOT_PATH}/bin/bitcoin-cli`,
  datapath : `${process.cwd()}/coredata`,
  network  : 'regtest',
  params   : []
}

export class CoreClient {
  cmdpath : string
  network : string
  params  : string[]

  constructor (config : Partial<CLIConfig> = {}) {
    const opt = { ...DEFAULT_CONFIG, ...config }
    this.cmdpath = opt.cmdpath
    this.network = opt.network
    this.params  = [
      `-rpccookiefile=${opt.datapath}/${opt.network}/.cookie`,
      `-chain=${this.network}`,
      ...opt.params
    ]
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
    return run_cmd(this.cmdpath, p)
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
}
