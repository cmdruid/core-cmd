import EventEmitter     from 'events'
import { ChildProcess } from 'child_process'
import { CoreClient }   from './client.js'
import { get_config }   from '../config.js'

import {
  check_process,
  spawn_process
} from './cmd.js'

import {
  ensure_file_exists,
  ensure_path_exists
} from './util.js'

import {
  CoreConfig,
  CoreEvent,
  RunMethod
} from '../types/index.js'

const RAND_PORT = () => Math.floor((Math.random() * 10 ** 5 % 25_000) + 25_000)

export class CoreDaemon extends EventEmitter {
  readonly _client  : CoreClient
  readonly _opt     : CoreConfig
  readonly params   : string[]

  _proc ?: ChildProcess

  constructor (config ?: Partial<CoreConfig>) {
    super()

    const opt = get_config(config)

    const { isolated, throws } = opt


    if (isolated) {
      opt.rpcport = RAND_PORT()
    }

    this._client  = new CoreClient(opt)

    this.params   = [
      `-chain=${opt.network}`,
      `-datadir=${opt.datapath}`,
      ...opt.params,
      ...opt.core_params
    ]
    if (opt.confpath !== undefined) {
      ensure_file_exists(opt.confpath)
      this.params.push(`-conf=${opt.confpath}`)
    }
    if (isolated) {
      this.params.push(`-port=${opt.rpcport - 1}`)
    }
    if (opt.rpcport !== undefined) {
      this.params.push(`-rpcport=${opt.rpcport}`)
    }
    process.on('uncaughtException', async (err) => {
      console.log('Core daemon caught an error, exiting...')
      await this.shutdown()
      if (throws) {
        throw err
      } else {
        console.log(err.message)
      }
    })
    process.on('unhandledRejection', async (reason) => {
      console.log('Core daemon caught a promise rejection, exiting...')
      await this.shutdown()
      const msg = String(reason)
      if (throws) {
        throw new Error(msg)
      } else { 
        console.log(msg)
      }
    })
    this._opt = opt
  }

  get client () : CoreClient {
    return this._client
  }

  get opt () : CoreConfig {
    return this._opt
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
    const { corepath, datapath, debug, throws, timeout } = this.opt
    const p   = [ ...this.params, ...params ]
    const msg = 'loadblk thread exit'
    if (debug) {
      console.log('exec   :', corepath)
      console.log('data   :', datapath)
      console.log('params :', p.join(' '))
    }
    if (datapath === 'string') {
      await ensure_path_exists(datapath)
    }
    this._proc = await spawn_process(corepath, p, msg, throws, timeout)
  }

  async startup (params : string[] = []) {
    const { isolated, verbose } = this.opt
    if (isolated) {
      await this._start(params)
    } else {
      if (await check_process('bitcoin-qt')) {
        if (verbose) console.log('Using existing Bitcoin QT instance...')
      } else if (await check_process('bitcoind')) {
        if (verbose) console.log('Using existing Bitcoin daemon...')
      } else {
        if (verbose) console.log('Starting new bitcoin daemon...')
        await this._start(params)
      }
    }
    this.emit('ready', this.client)
    return this.client
  }

  async shutdown () {
    if (this._proc !== undefined) {
      const is_dead = this._proc.kill()
      if (!is_dead) this._proc.kill('SIGKILL')
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
