import EventEmitter      from 'events'
import { ChildProcess }  from 'child_process'
import { CoreClient }    from './client.js'
import { core_config }   from '../config.js'
import { CoreWallet }    from './wallet.js'
import { check_process, spawn_process } from './cmd.js'

import {
  ensure_file,
  ensure_path,
  sleep
} from './util.js'

import {
  CoreConfig,
  CoreEvent,
  RunMethod
} from '../types/index.js'

import * as CONST from './const.js'

const { FALLBACK_FEE, FAUCET_MIN_BAL, INIT_BLOCK_CT, SAT_MULTI, RANDOM_PORT } = CONST

export class CoreDaemon extends EventEmitter {
  readonly _client : CoreClient
  readonly _opt    : CoreConfig
  readonly params  : string[]
  readonly tasks   : RunMethod[]

  _closing : boolean
  _faucet  : CoreWallet | null
  _proc   ?: ChildProcess
  _ready   : boolean

  constructor (config ?: Partial<CoreConfig>) {
    super()

    const opt = core_config(config)

    const { isolated, safemode } = opt

    if (isolated) {
      const port = RANDOM_PORT()
      opt.peer_port = port
      opt.rpc_port  = port + 1
    }

    if (opt.network === 'bitcoin') {
      opt.network = 'main'
    }

    if (opt.network === 'testnet') {
      opt.network = 'test'
    }

    this._client  = new CoreClient(this, opt)
    this._closing = false
    this._faucet  = null
    this._ready   = false
    this.tasks    = []

    this.params = [
      `-chain=${opt.network}`,
      `-fallbackfee=${FALLBACK_FEE / SAT_MULTI }`,
      ...opt.params,
      ...opt.core_params
    ]

    if (opt.peer_port !== undefined) {
      this.params.push(`-port=${opt.peer_port}`)
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

    if (safemode) {
      process.once('uncaughtException', async (err) => {
        console.log('[core] Daemon caught an error, exiting...')
        console.dir(err, { depth: null })
        await this.shutdown()
      })

      process.once('unhandledRejection', async (err) => {
        console.log('[core] Daemon caught a promise rejection, exiting...')
        console.dir(err, { depth: null })
        await this.shutdown()
      })
    }

    this._opt = opt
  }

  get client () : CoreClient {
    return this._client
  }

  get faucet () : CoreWallet {
    if (this._faucet === null) {
      throw new Error('Faucet wallet is not loaded!')
    }
    return this._faucet
  }

  get opt () : CoreConfig {
    return this._opt
  }

  get ready () : boolean {
    return this._ready
  }

  _debug (...msg : unknown[]) {
    if (this.opt.debug) {
      console.log('[core]', ...msg)
    }
  }

  _log (...msg : unknown[]) {
    if (this.opt.verbose) {
      console.log('[core]', ...msg)
    }
  }

  on <K extends keyof CoreEvent> (
    event : K, 
    cb    : (arg: CoreEvent[K]) => void
  ) : this {
    return super.on(event, cb as (...args: any[]) => void)
  }

  once <K extends keyof CoreEvent> (
    event : K, 
    cb    : (arg: CoreEvent[K]) => void
  ) : this {
    return super.once(event, cb as (...args: any[]) => void)
  }

  emit <K extends keyof CoreEvent> (
    event : K, 
    arg   : CoreEvent[K]
  ): boolean {
    return super.emit(event, arg)
  }

  async _start (params : string[] = []) {
    const { confpath, corepath, datapath, timeout } = this.opt

    if (confpath !== undefined) {
      await ensure_file(confpath)
    }

    if (datapath !== undefined) {
      await ensure_path(datapath)
    }

    const exec = corepath ?? 'bitcoind'
    const msg  = 'init message: Done loading'

    params = [ ...this.params, ...params ]

    this._debug('exec :', exec)
    this._debug('data :', datapath)
    this._debug('args :', params.join(' '))

    this._proc = await spawn_process(exec, params, msg, timeout)
  }

  async _init () {
    const delay   = this.opt.init_delay
    const min_bal = FAUCET_MIN_BAL / SAT_MULTI

    if (delay > 0) {
      this._log(`init process sleeping for ${delay} seconds...`)
      const ms = Math.floor(delay * 1000)
      await sleep(ms)
    }

    this._faucet  = await this.client.load_wallet('faucet')
    const addr    = await this.faucet.get_address('faucet')
      let bal     = await this.faucet.balance
    
    if (this.opt.network === 'regtest' && bal <= min_bal) {
      this._log('Faucet generating blocks...')
      await this.client.mine_blocks(INIT_BLOCK_CT, addr)
      bal = await this.faucet.balance
    }

    this._log('Faucet address:', addr)
    this._log('Faucet balance:', bal)
    
    if (bal <= min_bal) {
      throw new Error('faucet is broke!')
    }

    await Promise.all(this.tasks.map(t => t(this.client)))
  }

  async startup (params : string[] = []) {
    const { isolated, no_spawn } = this.opt

    const has_daemon = await check_process('bitcoind')
    const has_client = await check_process('bitcoin-qt')
    const no_process = (!has_client && !has_daemon)

    if (no_spawn) {
      this._log('Using existing bitcoin process...')
    } else if (isolated || no_process) {
      this._log('Starting new bitcoin daemon...')
      await this._start(params)
    } else {
      this._log('Using existing bitcoin process...')
    }

    await this._init()
    this._ready = true
    this.emit('ready', this.client)
    return this.client
  }

  async shutdown () {
    if (!this._closing) {
      this._closing = true
      if (this._proc !== undefined) {
        const is_dead = this._proc.kill()
        if (!is_dead) this._proc.kill('SIGKILL')
      }
    }
  }

  async run (...methods : RunMethod[]) {
    if (this._proc === undefined) {
      await this.startup()
    }
    const jobs = methods.map(async fn => {
      return Promise.resolve(fn(this.client))
        .then(() => null)
        .catch((err) => err)
    })
    const ret = await Promise.all(jobs)
    await this.shutdown()
    return ret
  }
}
