import EventEmitter       from 'events'
import { ChildProcess }   from 'child_process'
import { CoreClient }     from './client.js'
import { DEFAULT_CONFIG } from '../config.js'

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

export class CoreDaemon extends EventEmitter {
  readonly _client  : CoreClient
  readonly corepath : string
  readonly datapath : string
  readonly network  : string
  readonly params   : string[]

  _proc ?: ChildProcess

  constructor (config ?: Partial<CoreConfig>) {
    super()
    const opt = { ...DEFAULT_CONFIG, ...config }
    this._client  = new CoreClient(config)
    this.corepath  = opt.corepath
    this.datapath = opt.datapath
    this.network  = opt.network
    this.params   = [
      `-chain=${this.network}`,
      `-datadir=${opt.datapath}`,
      ...opt.params
    ]
    if (opt.confpath !== undefined) {
      ensure_file_exists(opt.confpath)
      this.params.push(`-conf=${opt.confpath}`)
    }
    process.on('uncaughtException', (err) => {
      console.log(err.message)
      console.log('Core daemon caught an error, exiting...')
      this.shutdown()
    })
    process.on('unhandledRejection', (reason) => {
      console.log(reason)
      console.log('Core daemon caught a promise rejection, exiting...')
      this.shutdown()
    })
  }

  get client () : CoreClient {
    return this._client
  }

  on <U extends keyof CoreEvent> (
    event : U, 
    cb    : (arg: CoreEvent[U]) => void
  ) : this {
    return super.on(event, cb as (...args: any[]) => void)
  }

  once <U extends keyof CoreEvent> (
    event : U, 
    cb    : (arg: CoreEvent[U]) => void
  ) : this {
    return super.once(event, cb as (...args: any[]) => void)
  }

  emit <U extends keyof CoreEvent> (
    event : U, 
    arg   : CoreEvent[U]
  ): boolean {
    return super.emit(event, arg)
  }

  async startup (params : string[] = []) {
    if (await check_process('bitcoin-qt')) {
      console.log('Using existing Bitcoin QT instance...')
    } else if (await check_process('bitcoind')) {
      console.log('Using existing Bitcoin daemon...')
    } else {
      const p = [ ...this.params, ...params ]
      const msg  = 'loadblk thread exit'
      await ensure_path_exists(this.datapath)
      console.log('Starting bitcoin core daemon with params:')
      console.log('exec:', this.corepath)
      console.log('data:', this.datapath)
      console.log(p)
      const proc = await spawn_process(this.corepath, p, msg)
      this._proc = proc
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
        .then(() => true)
        .catch(() => false)
    })
    const ret = await Promise.all(jobs)
    await this.shutdown()
    return ret
  }
}
