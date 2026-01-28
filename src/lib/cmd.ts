// External dependencies
import { execFile, spawn } from 'node:child_process'

// Internal modules
import { ManagedProcess }                    from '@/class/process.js'
import { CommandError, create_command_error } from '@/class/errors.js'
import { RATE_LIMIT, DEFAULT_SPAWN_TIMEOUT_MS } from '@/const.js'
import { create_core_debug }                 from '@/util/debug.js'
import { validate_process_name }             from '@/lib/validation.js'

// Type imports
import type { MethodArgs } from '@/types/index.js'

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

/**
 * Check if a Bitcoin Core process is running
 *
 * Uses execFile with array arguments to prevent command injection.
 * Process name must be in the allowlist (bitcoind, bitcoin-qt, bitcoin-cli).
 *
 * @param name - Process name to check (must be in allowlist)
 * @returns Promise resolving to true if process is running
 * @throws Error if process name is not in allowlist
 */
export function check_process(name: string): Promise<boolean> {
  // Validate against allowlist to prevent injection
  const validName = validate_process_name(name)

  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Windows: Use tasklist with filter
      // tasklist /FI "IMAGENAME eq bitcoind.exe" /NH
      const args = ['/FI', `IMAGENAME eq ${validName}.exe`, '/NH']
      execFile('tasklist', args, (_err, out) => {
        // Check if output contains the process name (not "INFO: No tasks")
        resolve(out.includes(validName))
      })
    } else {
      // Unix: Use pgrep with exact match (-x flag)
      // pgrep -x bitcoind
      execFile('pgrep', ['-x', validName], (_err, out) => {
        // pgrep returns output (PIDs) if process found, empty if not
        resolve(out.trim().length > 0)
      })
    }
  })
}

function handle_data(blob: string) {
  try {
    return JSON.parse(blob)
  } catch {
    return blob.replace('\n', '')
  }
}