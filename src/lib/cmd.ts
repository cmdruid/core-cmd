import { RATE_LIMIT, DEFAULT_SPAWN_TIMEOUT_MS } from '../const.js'
import { MethodArgs } from '../types/index.js'
import { ManagedProcess } from '../class/process.js'
import { CommandError, create_command_error } from '../class/errors.js'
import { create_core_debug } from '../util/debug.js'

import {
  exec,
  spawn
} from 'child_process'

const debug = create_core_debug('cmd')
const delay = (ms = 1000) => new Promise(res => setTimeout(res, ms))

export function parse_args(
  method: string,
  input?: MethodArgs
): string[] {
  const args: string[] = []
  if (Array.isArray(input)) {
    args.push(method, ...input.map(e => String(e)))
  } else if (input === null) {
    args.push(method)
  } else if (typeof input === 'object') {
    args.push('-named', method)
    for (const [k, v] of Object.entries(input)) {
      args.push(`${k}=${String(v)}`)
    }
  } else if (input !== undefined) {
    args.push(method, String(input))
  } else {
    args.push(method)
  }
  return args
}

// CommandError is now imported from errors.ts

/**
 * Enhanced run_cmd with better error context
 */
export async function run_cmd<T>(
  cmdpath: string,
  params: string[]
): Promise<T> {
  if (typeof RATE_LIMIT === 'number' && RATE_LIMIT !== 0) {
    await delay(RATE_LIMIT)
  }

  debug('run_cmd: %s %s', cmdpath, params.slice(0, 3).join(' '))

  return new Promise((resolve, reject) => {
    const proc = spawn(cmdpath, params)
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', data => {
      stdout += data.toString()
    })

    proc.stderr.on('data', data => {
      stderr += data.toString()
    })

    proc.on('error', err => {
      const error = new CommandError(
        err.message,
        params[0] || cmdpath,
        stdout,
        stderr
      )
      reject(error)
    })

    proc.on('close', code => {
      if (code !== 0) {
        const error = create_command_error(
          stdout,
          stderr,
          params[0] || cmdpath,
          code ?? undefined
        )
        reject(error)
      } else {
        try {
          resolve(handle_data(stdout) as T)
        } catch (parseError) {
          const error = new CommandError(
            parseError instanceof Error ? parseError.message : String(parseError),
            params[0] || cmdpath,
            stdout,
            stderr
          )
          reject(error)
        }
      }
    })
  })
}

/**
 * Enhanced spawn_process that returns a ManagedProcess
 */
export function spawn_process(
  cmdpath: string,
  params: string[],
  init_msg: string,
  timeout = DEFAULT_SPAWN_TIMEOUT_MS
): Promise<ManagedProcess> {
  debug('spawn_process: %s (timeout: %dms)', cmdpath, timeout)

  return new Promise((resolve, reject) => {
    let initialized = false
    let stdout = ''
    let stderr = ''
    
    const timer = setTimeout(() => {
      if (!initialized) {
        const error = new CommandError(
          `Process failed to start within ${timeout}ms`,
          cmdpath,
          stdout,
          stderr
        )
        reject(error)
      }
    }, timeout)

    const proc = spawn(cmdpath, params)
    const managed = new ManagedProcess(proc)

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      stdout += text
      
      if (!initialized && text.includes(init_msg)) {
        clearTimeout(timer)
        initialized = true
        resolve(managed)
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text
      
      // Don't immediately fail on stderr, as Bitcoin Core outputs warnings there
      // Only fail if we haven't initialized and get an actual error
      if (!initialized && text.includes('Error:')) {
        clearTimeout(timer)
        const error = new CommandError(
          `Process error: ${text}`,
          cmdpath,
          stdout,
          stderr
        )
        reject(error)
      }
    })

    proc.on('error', err => {
      if (!initialized) {
        clearTimeout(timer)
        const error = new CommandError(
          err.message,
          cmdpath,
          stdout,
          stderr
        )
        reject(error)
      }
    })

    proc.on('close', code => {
      if (!initialized) {
        clearTimeout(timer)
        const error = new CommandError(
          `Process exited with code ${code}`,
          cmdpath,
          stdout,
          stderr,
          code ?? undefined
        )
        reject(error)
      }
    })
  })
}

export function check_process(name: string): Promise<boolean> {
  const unix = `ps aux | grep ${name} | grep -v grep`
  const wind = `tasklist | grep ${name}`
  const cmd = process.platform === 'win32' ? wind : unix
  
  return new Promise((resolve) => {
    exec(cmd, (_err, out) => {
      if (out) resolve(true)
      else resolve(false)
    })
  })
}

function handle_data(blob: string) {
  try {
    return JSON.parse(blob)
  } catch {
    return blob.replace('\n', '')
  }
}