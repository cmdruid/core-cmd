/**
 * Mock implementation of CoreDaemon for unit testing
 */

import { EventEmitter } from 'events'
import { DaemonState } from '../../../src/index.js'
import type { MockDaemonConfig, RecordedCall } from '../types/mock.types.js'
import type { CoreConfig } from '../../../src/index.js'
import { MockCoreClient, create_mock_client } from './client.mock.js'
import { MockCoreWallet, create_mock_faucet } from './wallet.mock.js'
import { MockStateMachine, create_mock_state_machine } from './state.mock.js'
import { create_call_recorder } from '../types/mock.types.js'

// ============================================================================
// MockCoreDaemon
// ============================================================================

/**
 * Mock implementation of CoreDaemon for unit testing
 *
 * Features:
 * - Full state machine simulation
 * - Event emission (ready, shutdown, state:change)
 * - Configurable client and faucet
 * - Call recording for verification
 *
 * @example
 * ```typescript
 * const daemon = await MockDaemonFactory.ready()
 * const client = daemon.client
 * const faucet = daemon.faucet
 *
 * // Use daemon in tests...
 *
 * await daemon.shutdown()
 * ```
 */
export class MockCoreDaemon extends EventEmitter {
  private _client      : MockCoreClient
  private _faucet      : MockCoreWallet
  private _state       : MockStateMachine
  private _config      : Partial<CoreConfig>
  private _recorder    : ReturnType<typeof create_call_recorder>
  private _zmq         : unknown = null

  constructor(config: MockDaemonConfig = {}) {
    super()

    // Create mock components
    this._config = config.core_config ?? {}
    this._client = create_mock_client(config.client_config)
    this._faucet = create_mock_faucet(config.faucet_balance)
    this._state = create_mock_state_machine({
      initial_state: config.initial_state ?? DaemonState.Created
    })
    this._recorder = create_call_recorder()

    // Wire up client
    this._faucet._set_client(this._client)

    // Forward state events
    this._state.on('state:change', (event) => {
      this.emit('state:change', event)
    })
    this._state.on('state:ready', () => {
      this.emit('ready', this._client)
    })
    this._state.on('state:error', (error) => {
      this.emit('state:error', error)
    })
    this._state.on('state:stopped', () => {
      this.emit('shutdown')
    })
  }

  // ============================================================================
  // Public Getters (matches CoreDaemon interface)
  // ============================================================================

  get client(): MockCoreClient {
    return this._client
  }

  get faucet(): MockCoreWallet {
    if (!this._faucet) {
      throw new Error('Faucet wallet not available')
    }
    return this._faucet
  }

  get opt(): CoreConfig {
    return {
      network     : 'regtest',
      isolated    : true,
      debug       : false,
      verbose     : false,
      timeout     : 30000,
      init_delay  : 0,
      use_cache   : false,
      safemode    : false,
      no_spawn    : true,
      params      : [],
      core_params : [],
      cli_params  : [],
      ...this._config
    } as CoreConfig
  }

  get isReady(): boolean {
    return this._state.isReady
  }

  get state(): string {
    return this._state.state
  }

  get daemonState(): DaemonState {
    return this._state.state
  }

  get zmq(): unknown {
    return this._zmq
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Simulate daemon startup
   */
  async startup(): Promise<MockCoreClient> {
    this._record_call('startup', [])

    // Simulate startup sequence
    this._state.transition(DaemonState.Starting)
    await this._delay(10)

    this._state.transition(DaemonState.ProcessRunning)
    await this._delay(10)

    this._state.transition(DaemonState.Initializing)
    await this._delay(10)

    this._state.transition(DaemonState.Ready)

    return this._client
  }

  /**
   * Simulate daemon shutdown
   */
  async shutdown(): Promise<void> {
    this._record_call('shutdown', [])

    if (this._state.isStopped) return

    // Can shutdown from Ready, Error, or during startup
    if (this._state.state !== DaemonState.ShuttingDown) {
      this._state.transition(DaemonState.ShuttingDown)
    }

    await this._delay(10)
    this._state.transition(DaemonState.Stopped)
  }

  /**
   * Wait for daemon to be ready
   */
  async wait_for_ready(timeout?: number): Promise<void> {
    this._record_call('wait_for_ready', [timeout])
    return this._state.wait_for_ready(timeout)
  }

  /**
   * Run methods and then shutdown
   */
  async run(...methods: Array<() => Promise<void>>): Promise<void[]> {
    this._record_call('run', [methods])

    const results: void[] = []
    try {
      for (const method of methods) {
        results.push(await method())
      }
    } finally {
      await this.shutdown()
    }
    return results
  }

  /**
   * Run methods in parallel and then shutdown
   */
  async run_parallel(...methods: Array<() => Promise<void>>): Promise<PromiseSettledResult<void>[]> {
    this._record_call('run_parallel', [methods])

    try {
      return await Promise.allSettled(methods.map(m => m()))
    } finally {
      await this.shutdown()
    }
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Check if Bitcoin Core is running (mock always returns configurable value)
   */
  static async exists(_name?: string): Promise<boolean> {
    return false
  }

  /**
   * Spawn a new daemon (mock)
   */
  static async spawn(config?: Partial<CoreConfig>): Promise<MockCoreDaemon> {
    const daemon = new MockCoreDaemon({ core_config: config })
    await daemon.startup()
    return daemon
  }

  /**
   * Connect to existing daemon (mock)
   */
  static async connect(config?: Partial<CoreConfig>): Promise<MockCoreDaemon> {
    const daemon = new MockCoreDaemon({ core_config: config })
    await daemon.startup()
    return daemon
  }

  /**
   * Auto-detect and connect/spawn (mock)
   */
  static async auto(config?: Partial<CoreConfig>): Promise<MockCoreDaemon> {
    return MockCoreDaemon.spawn(config)
  }

  // ============================================================================
  // Test Helpers
  // ============================================================================

  /**
   * Get all recorded calls
   */
  get _calls(): RecordedCall[] {
    return this._recorder.calls
  }

  /**
   * Get the underlying state machine
   */
  get _state_machine(): MockStateMachine {
    return this._state
  }

  /**
   * Set daemon to ready state immediately
   */
  _set_ready(): void {
    if (this._state.state === DaemonState.Created) {
      this._state._force_state(DaemonState.Ready)
    }
  }

  /**
   * Set daemon to error state
   */
  _set_error(error: Error): void {
    this._state.setError(error)
  }

  /**
   * Get current state
   */
  _get_state(): DaemonState {
    return this._state.state
  }

  /**
   * Force a specific state (bypasses validation)
   */
  _force_state(state: DaemonState): void {
    this._state._force_state(state)
  }

  /**
   * Set ZMQ event bus
   */
  _set_zmq(zmq: unknown): void {
    this._zmq = zmq
  }

  /**
   * Emit a ZMQ event
   */
  _emit_zmq_event(event: string, data: unknown): void {
    this.emit(`zmq:${event}`, data)
  }

  /**
   * Reset daemon to initial state
   */
  _reset(): void {
    this._client._reset()
    this._faucet._reset()
    this._recorder.clear()
    if (this._state.isStopped || this._state.hasError) {
      this._state.reset()
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private _record_call(method: string, args: unknown[]): void {
    this._recorder.calls.push({
      method,
      args,
      timestamp: new Date()
    })
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================================
// MockDaemonFactory
// ============================================================================

/**
 * Factory for creating pre-configured mock daemons
 */
export class MockDaemonFactory {
  /**
   * Create a daemon that is already in the Ready state
   */
  static async ready(config?: MockDaemonConfig): Promise<MockCoreDaemon> {
    const daemon = new MockCoreDaemon({
      ...config,
      initial_state: DaemonState.Created
    })
    await daemon.startup()
    return daemon
  }

  /**
   * Create a daemon in Error state
   */
  static errored(error: Error, config?: MockDaemonConfig): MockCoreDaemon {
    const daemon = new MockCoreDaemon({
      ...config,
      initial_state: DaemonState.Error
    })
    daemon._state_machine._force_state(DaemonState.Error, error)
    return daemon
  }

  /**
   * Create an uninitialized daemon (Created state)
   */
  static uninitialized(config?: MockDaemonConfig): MockCoreDaemon {
    return new MockCoreDaemon({
      ...config,
      initial_state: DaemonState.Created
    })
  }

  /**
   * Create a stopped daemon
   */
  static stopped(config?: MockDaemonConfig): MockCoreDaemon {
    const daemon = new MockCoreDaemon(config)
    daemon._force_state(DaemonState.Stopped)
    return daemon
  }

  /**
   * Create a daemon with custom faucet balance
   */
  static async with_balance(balance: number, config?: MockDaemonConfig): Promise<MockCoreDaemon> {
    const daemon = await MockDaemonFactory.ready({
      ...config,
      faucet_balance: balance
    })
    return daemon
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a mock CoreDaemon instance
 */
export function create_mock_daemon(config: MockDaemonConfig = {}): MockCoreDaemon {
  return new MockCoreDaemon(config)
}

// ============================================================================
// Export Types
// ============================================================================

export type { MockDaemonConfig }
