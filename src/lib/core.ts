import EventEmitter       from 'events'
import { ChildProcess }   from 'child_process'
import { spawn_process }  from './cmd.js'
import { CoreClient }     from './client.js'
import { DEFAULT_CONFIG } from '../config.js'

import {
  CoreConfig,
  CoreEvent
} from '../types/index.js'

import {
  ensure_file_exists,
  ensure_path_exists
} from './util.js'

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

  on <U extends keyof CoreEvent> (
    event : U, 
    cb    : (arg: CoreEvent[U]) => void
  ) : this {
    return super.on(event, cb as (...args: any[]) => void)
  }

  emit <U extends keyof CoreEvent> (
    event : U, 
    arg   : CoreEvent[U]
  ): boolean {
    return super.emit(event, arg)
  }

  async startup (params : string[] = []) {
    const p = [ ...this.params, ...params ]
    const msg  = 'loadblk thread exit'
    await ensure_path_exists(this.datapath)
    console.log('Starting bitcoin core daemon with params:')
    console.log('exec:', this.corepath)
    console.log('data:', this.datapath)
    console.log(p)
    const proc = await spawn_process(this.corepath, p, msg)
    this._proc = proc
    this.emit('ready', this._client)
  }

  async shutdown () {
    if (this._proc !== undefined) {
      const is_dead = this._proc.kill()
      if (!is_dead)   this._proc.kill('SIGKILL')
      process.exit()
    }
  }
}
