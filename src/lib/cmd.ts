import { spawn, ChildProcess } from 'child_process'

import { MethodArgs } from '../types/index.js'

export function parse_args (
  method : string,
  input ?: MethodArgs
) : string[] {
  const args : string[] = []
  if (Array.isArray(input)) {
    args.push(method, ...input)
  } else if (typeof input === 'object') {
    args.push('-named', method)
    for (const [ k, v ] of Object.entries(input)) {
      args.push(`${k}=${String(v)}`)
    }
  } else if (input !== undefined) {
    args.push(method, input)
  } else {
    args.push(method)
  }
  return args
}

export async function run_cmd <T> (
  cmdpath : string,
  params  : string[]
) : Promise<T> {
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
      if (code !== 0) reject(new Error(`exit code: ${String(code)}`))
      try {
        resolve(JSON.parse(blob) as T)
      } catch {
        resolve(blob.replace('\n', '') as T) 
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
      if (init = false) rej(data)
      console.log('[stderr]: ' + data)
    })
    proc.on('error', err => {
      if (init = false) rej(err.message)
      console.error(err)
    })
    proc.on('close', code => {
      if (code !== 0) {
        throw new Error(`Core exited with failure code: ${String(code)}`)
      }
      console.log('Core exited successfully with code 0.')
    })
  })
}
