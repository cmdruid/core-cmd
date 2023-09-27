import { RATE_LIMIT } from './const.js'
import { MethodArgs } from '../types/index.js'

import {
  exec,
  spawn,
  ChildProcess
} from 'child_process'

const delay = (ms = 1000) => new Promise(res => setTimeout(res, ms))

export function parse_args (
  method : string,
  input ?: MethodArgs
) : string[] {
  const args : string[] = []
  if (Array.isArray(input)) {
    args.push(method, ...input.map(e => String(e)))
  } else if (input === null) {
    args.push(method)
  } else if (typeof input === 'object') {
    args.push('-named', method)
    for (const [ k, v ] of Object.entries(input)) {
      args.push(`${k}=${String(v)}`)
    }
  } else if (input !== undefined) {
    args.push(method, String(input))
  } else {
    args.push(method)
  }
  return args
}

export async function run_cmd <T> (
  cmdpath : string,
  params  : string[]
) : Promise<T> {
  if (typeof RATE_LIMIT === 'number' && RATE_LIMIT !== 0) {
    await delay(RATE_LIMIT)
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(cmdpath, params)
    let blob = ''
    proc.stdout.on('data', data => {
      blob += String(data.toString())
    })
    proc.stderr.on('data', data => {
      reject(new Error(data.toString()))
    })
    proc.on('error', err => reject(err))
    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(`exit code: ${String(code)}`))
      } else {
        resolve(handle_data(blob) as T)
      }
    })
  })
}

export function spawn_process (
  cmdpath  : string,
  params   : string[],
  init_msg : string,
  timeout  = 5_000
) : Promise<ChildProcess> {
  return new Promise((res, rej) => {
    let   init = false
    const tout = setTimeout(() => rej('Timed out!'), timeout)
    const proc = spawn(cmdpath, params)
    proc.stdout.on('data', (data : string) => {
      if (!init && data.includes(init_msg)) {
        clearTimeout(tout)
        init = true
        res(proc)
      }
    })
    proc.stderr.on('data', (data : string) => {
      if (!init) rej(data)
      throw new Error(data)
    })
    proc.on('error', err => {
      if (!init) rej(err.message)
      throw err
    })
    proc.on('close', code => {
      if (code !== 0) {
        throw new Error('Process exited with code:' + String(code))
      }
    })
  })
}

export function check_process (name : string) {
  const unix = `ps aux | grep ${name} | grep -v grep`
  const wind = `tasklist | grep ${name}`
  const cmd  = process.platform === 'win32' ? wind : unix
  return new Promise((resolve) => {
    exec(cmd, (_err, out) => {
      if (out) resolve(true)
      resolve(false)
    })
  })
}

function handle_data (blob : string) {
  try {
    return JSON.parse(blob)
  } catch {
     return blob.replace('\n', '')
  }
}
