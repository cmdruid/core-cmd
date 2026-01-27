/**
 * Process management for Bitcoin Core daemon
 *
 * This module provides two process controllers:
 * - SpawnedProcess: Spawns and manages a new Bitcoin Core process
 * - ConnectedProcess: Connects to an existing Bitcoin Core process
 */

import { ChildProcess, spawn } from 'child_process'
import { create_core_debug } from '../util/debug.js'
import { CoreClient } from './client.js'
import { check_process } from '../lib/cmd.js'
import { ensure_file, ensure_path } from '../lib/util.js'
import { CoreConfig } from '../types/index.js'
import { ProcessError, ConnectionError } from './errors.js'
import {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_HEALTH_CHECK_INTERVAL_MS,
  LOG_BUFFER_MAX_LINES,
  ERROR_PATTERNS,
  WARNING_PATTERNS,
  HEALTH_CHECK_STALE_MS
} from '../const.js'

const debug = create_core_debug('process')

/**
 * Process lifecycle states
 */
export enum ProcessState {
  Uninitialized = 'uninitialized',
  Starting = 'starting',
  Running = 'running',
  Connected = 'connected',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Crashed = 'crashed'
}

/**
 * Interface for process controllers
 */
export interface ProcessController {
  start(): Promise<void>
  cleanup(): Promise<void>
  get_state(): ProcessState
  get_client(): CoreClient
}

/**
 * Process log buffer for debugging
 */
interface ProcessLogs {
  stdout: string[]
  stderr: string[]
  add_stdout(data: string): void
  add_stderr(data: string): void
  get_recent(lines?: number): string[]
}

/**
 * Circular buffer for process logs
 */
class ProcessLogBuffer implements ProcessLogs {
  stdout: string[] = []
  stderr: string[] = []
  private max_lines = LOG_BUFFER_MAX_LINES

  add_stdout(data: string): void {
    const lines = data.split('\n').filter(l => l.trim())
    for (const line of lines) {
      this.stdout.push(line)
      if (this.stdout.length > this.max_lines) {
        this.stdout.shift()
      }
    }
  }

  add_stderr(data: string): void {
    const lines = data.split('\n').filter(l => l.trim())
    for (const line of lines) {
      this.stderr.push(line)
      if (this.stderr.length > this.max_lines) {
        this.stderr.shift()
      }
    }
  }

  get_recent(lines = 50): string[] {
    // Interleave stdout and stderr, most recent last
    const all_logs = [...this.stdout, ...this.stderr]
    return all_logs.slice(-lines)
  }

  get_stderr_recent(lines = 20): string[] {
    return this.stderr.slice(-lines)
  }
}

/**
 * Check if stderr text is an actual error (not just a warning)
 */
function is_actual_error(stderr: string): boolean {
  // First check if it's a known warning pattern
  for (const pattern of WARNING_PATTERNS) {
    if (pattern.test(stderr)) {
      return false
    }
  }

  // Then check if it matches an error pattern
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(stderr)) {
      return true
    }
  }

  // If it doesn't match any pattern, don't treat as error
  return false
}

/**
 * Spawned process controller
 *
 * Manages a Bitcoin Core process that we spawn ourselves.
 * Includes proper stderr handling (warnings vs errors) and health checking.
 */
export class SpawnedProcess implements ProcessController {
  private state: ProcessState = ProcessState.Uninitialized
  private process?: ChildProcess
  private logs: ProcessLogBuffer = new ProcessLogBuffer()
  private client: CoreClient
  private config: CoreConfig
  private params: string[]
  private healthCheckInterval?: NodeJS.Timeout

  constructor(config: CoreConfig, client: CoreClient, params: string[]) {
    this.config = config
    this.client = client
    this.params = params
  }

  /**
   * Start the Bitcoin Core process
   */
  async start(): Promise<void> {
    const { confpath, corepath, datapath, timeout = 30000 } = this.config

    // Pre-flight checks
    if (confpath !== undefined) {
      await ensure_file(confpath)
    }

    if (datapath !== undefined) {
      await ensure_path(datapath)
    }

    const exec = corepath ?? 'bitcoind'
    const init_msg = 'init message: Done loading'

    this.state = ProcessState.Starting
    debug('starting Bitcoin Core process: %s', exec)

    return new Promise((resolve, reject) => {
      let initialized = false
      let startupStderr = ''

      const timer = setTimeout(() => {
        if (!initialized) {
          this.state = ProcessState.Crashed
          const recentLogs = this.logs.get_recent(20).join('\n')
          debug('startup timeout after %dms', timeout)
          reject(new ProcessError(
            `Bitcoin Core failed to start within ${timeout}ms. ` +
            `Recent logs:\n${recentLogs}`,
            this.process?.pid,
            undefined,
            undefined
          ))
        }
      }, timeout)

      this.process = spawn(exec, this.params, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      debug('spawned process with PID: %d', this.process.pid)

      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        this.logs.add_stdout(text)

        if (!initialized && text.includes(init_msg)) {
          clearTimeout(timer)
          initialized = true
          this.state = ProcessState.Running
          debug('Bitcoin Core initialized successfully')
          this._startHealthCheck()
          resolve()
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        this.logs.add_stderr(text)
        startupStderr += text

        // Only fail on ACTUAL errors, not warnings
        // Bitcoin Core uses stderr for warnings too
        if (!initialized && is_actual_error(text)) {
          clearTimeout(timer)
          this.state = ProcessState.Crashed
          debug('startup error: %s', text)
          reject(new ProcessError(
            `Bitcoin Core startup error: ${text}`,
            this.process?.pid,
            undefined,
            undefined
          ))
        }
      })

      this.process.on('error', (err) => {
        clearTimeout(timer)
        this.state = ProcessState.Crashed
        debug('process spawn error: %s', err.message)
        reject(new ProcessError(
          `Failed to spawn Bitcoin Core: ${err.message}`,
          undefined,
          undefined,
          undefined
        ))
      })

      this.process.on('close', (code, signal) => {
        this._stopHealthCheck()

        if (!initialized) {
          clearTimeout(timer)
          this.state = ProcessState.Crashed
          debug('process exited during startup with code %d', code)
          reject(new ProcessError(
            `Bitcoin Core exited during startup with code ${code}. stderr: ${startupStderr}`,
            this.process?.pid,
            code ?? undefined,
            signal ?? undefined
          ))
        } else if (this.state === ProcessState.Running) {
          // Unexpected crash after initialization
          this.state = ProcessState.Crashed
          debug('process crashed unexpectedly, exit code: %d, signal: %s', code, signal)
        } else if (this.state === ProcessState.Stopping) {
          this.state = ProcessState.Stopped
          debug('process stopped cleanly')
        }
      })
    })
  }

  /**
   * Start periodic health checks
   */
  private _startHealthCheck(): void {
    const interval = DEFAULT_HEALTH_CHECK_INTERVAL_MS

    this.healthCheckInterval = setInterval(() => {
      if (this.process && !this.process.killed) {
        // Process still exists - basic check passed
        // Could add RPC ping here for deeper health check
      } else if (this.state === ProcessState.Running) {
        this.state = ProcessState.Crashed
        debug('health check failed: process no longer running')
      }
    }, interval)
  }

  /**
   * Stop health checks
   */
  private _stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  /**
   * Gracefully shut down the Bitcoin Core process
   */
  async cleanup(): Promise<void> {
    this._stopHealthCheck()

    if (!this.process || this.state === ProcessState.Stopped) {
      return
    }

    if (this.state !== ProcessState.Running && this.state !== ProcessState.Starting) {
      return
    }

    this.state = ProcessState.Stopping
    debug('shutting down Bitcoin Core process')

    const shutdownTimeout = this.config.shutdown_timeout ?? DEFAULT_SHUTDOWN_TIMEOUT_MS

    return new Promise((resolve) => {
      const forceKillTimer = setTimeout(() => {
        if (this.process && !this.process.killed) {
          debug('graceful shutdown timed out, forcing kill')
          this.process.kill('SIGKILL')
        }
      }, shutdownTimeout)

      this.process!.once('close', () => {
        clearTimeout(forceKillTimer)
        this.state = ProcessState.Stopped
        debug('Bitcoin Core process stopped')
        resolve()
      })

      // Try graceful shutdown first
      const killed = this.process!.kill('SIGTERM')
      if (!killed) {
        clearTimeout(forceKillTimer)
        this.state = ProcessState.Stopped
        resolve()
      }
    })
  }

  get_state(): ProcessState {
    return this.state
  }

  get_client(): CoreClient {
    return this.client
  }

  get_logs(): string[] {
    return this.logs.get_recent()
  }
}

/**
 * Connected process controller
 *
 * Connects to an existing Bitcoin Core process.
 * Includes health checking to detect connection loss.
 */
export class ConnectedProcess implements ProcessController {
  private state: ProcessState = ProcessState.Uninitialized
  private client: CoreClient
  private config: CoreConfig
  private healthCheckInterval?: NodeJS.Timeout
  private lastHealthCheck?: Date

  constructor(config: CoreConfig, client: CoreClient) {
    this.config = config
    this.client = client
  }

  /**
   * Connect to an existing Bitcoin Core process
   */
  async start(): Promise<void> {
    this.state = ProcessState.Starting
    debug('connecting to existing Bitcoin Core process')

    // Step 1: Check if Bitcoin Core process is running
    const has_daemon = await check_process('bitcoind')
    const has_client = await check_process('bitcoin-qt')

    if (!has_daemon && !has_client) {
      this.state = ProcessState.Stopped
      throw new ConnectionError(
        'No Bitcoin Core process found. Use CoreDaemon.spawn() to start a new process.',
        this.config.rpc_host,
        this.config.rpc_port
      )
    }

    // Step 2: Verify we can connect via RPC
    try {
      const info = await this.client.cmd<{ version: number; chain: string }>('getblockchaininfo')
      debug('connected to Bitcoin Core version %d, chain: %s', info.version, info.chain)

      // Step 3: Verify network matches
      if (info.chain !== this.config.network && this.config.network !== 'main') {
        // Bitcoin Core reports 'main' for mainnet, but config might have 'bitcoin' or 'mainnet'
        const configNetwork = this.config.network.toLowerCase()
        const coreChain = info.chain.toLowerCase()

        if (configNetwork !== coreChain) {
          throw new ConnectionError(
            `Network mismatch: expected ${this.config.network}, but Bitcoin Core is on ${info.chain}`,
            this.config.rpc_host,
            this.config.rpc_port
          )
        }
      }

      this.state = ProcessState.Connected
      this._startHealthCheck()

    } catch (err) {
      this.state = ProcessState.Stopped
      if (err instanceof ConnectionError) {
        throw err
      }
      throw new ConnectionError(
        `Found Bitcoin Core process but cannot connect: ${err instanceof Error ? err.message : String(err)}`,
        this.config.rpc_host,
        this.config.rpc_port
      )
    }
  }

  /**
   * Start periodic health checks
   */
  private _startHealthCheck(): void {
    const interval = DEFAULT_HEALTH_CHECK_INTERVAL_MS

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.client.cmd<{ version: number }>('getblockchaininfo')
        this.lastHealthCheck = new Date()
      } catch (err) {
        debug('health check failed: %s', err)
        this.state = ProcessState.Crashed
        this._stopHealthCheck()
      }
    }, interval)
  }

  /**
   * Stop health checks
   */
  private _stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  /**
   * Disconnect from the Bitcoin Core process
   */
  async cleanup(): Promise<void> {
    this._stopHealthCheck()
    this.state = ProcessState.Stopped
    debug('disconnected from Bitcoin Core')
    // We don't own the process, just disconnect
  }

  /**
   * Check if the connection is healthy
   */
  is_healthy(): boolean {
    if (this.state !== ProcessState.Connected) return false
    if (!this.lastHealthCheck) return true // Just connected
    // Consider unhealthy if last check was > 30s ago
    return (Date.now() - this.lastHealthCheck.getTime()) < HEALTH_CHECK_STALE_MS
  }

  get_state(): ProcessState {
    return this.state
  }

  get_client(): CoreClient {
    return this.client
  }
}

/**
 * Managed process wrapper
 *
 * Wraps a ChildProcess with logging and state tracking.
 */
export class ManagedProcess {
  private process: ChildProcess
  private logs: ProcessLogBuffer = new ProcessLogBuffer()
  private exit_code?: number

  constructor(process: ChildProcess) {
    this.process = process

    process.stdout?.on('data', (data: Buffer) => {
      this.logs.add_stdout(data.toString())
    })

    process.stderr?.on('data', (data: Buffer) => {
      this.logs.add_stderr(data.toString())
    })

    process.on('close', (code) => {
      this.exit_code = code ?? undefined
    })
  }

  kill(signal?: NodeJS.Signals): boolean {
    return this.process.kill(signal)
  }

  get_logs(): string[] {
    return this.logs.get_recent()
  }

  get_exit_code(): number | undefined {
    return this.exit_code
  }

  get_pid(): number | undefined {
    return this.process.pid
  }
}
