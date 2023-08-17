import EventEmitter      from 'events'
import { ChildProcess }  from 'child_process'
import { ROOT_PATH }     from '../config.js'
import { spawn_process } from './cmd.js'
import { CoreClient }    from './client.js'

import {
  CoreConfig,
  CoreEvent
} from '../types/index.js'
import { ensure_path_exists } from './util.js'

const DEFAULT_CONFIG = {
  cmdpath  : `${ROOT_PATH}/bin/bitcoind`,
  datapath : `${process.cwd()}/coredata`,
  network  : 'regtest',
  params   : []
}

export class CoreDaemon extends EventEmitter {
  readonly _client  : CoreClient
  readonly cmdpath  : string
  readonly datapath : string
  readonly network  : string
  readonly params   : string[]

  _proc ?: ChildProcess

  constructor (config ?: Partial<CoreConfig>) {
    super()
    const opt = { ...DEFAULT_CONFIG, ...config }
    this._client  = new CoreClient(config)
    this.cmdpath  = opt.cmdpath
    this.datapath = opt.datapath
    this.network  = opt.network
    this.params   = [
      `-chain=${this.network}`,
      `-datadir=${opt.datapath}`,
      ...opt.params
    ]
    if (opt.confpath !== undefined) {
      this.params.push(`-conf=${opt.confpath}`)
    }
    
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
    return super.emit(event, arg);
  }

  async startup (params : string[] = []) {
    const p = [ ...this.params, ...params ]
    const msg  = 'loadblk thread exit'
    await ensure_path_exists(this.datapath)
    console.log('Starting bitcoin core daemon with params:')
    console.log(p)
    const proc = await spawn_process(this.cmdpath, p, msg)
    this._proc = proc
    this.emit('ready', this._client)
  }

  async shutdown () {
    if (this._proc === undefined) {
      throw new Error('Core daemon not initialized!')
    }
    const is_dead = this._proc.kill()
    if (!is_dead)   this._proc.kill('SIGKILL')
  }
}
