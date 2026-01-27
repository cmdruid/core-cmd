/**
 * Mock implementation of ProcessController for unit testing
 */

import { EventEmitter } from 'events'
import type { MockProcessControllerConfig, RecordedCall } from '../types/mock.types.js'
import { create_call_recorder } from '../types/mock.types.js'
import { create_mock_client, MockCoreClient } from './client.mock.js'

// ============================================================================
// Process State
// ============================================================================

/**
 * Process state enum (matches actual implementation)
 */
export enum ProcessState {
  Uninitialized = 'uninitialized',
  Starting      = 'starting',
  Running       = 'running',
  Connected     = 'connected',
  Stopping      = 'stopping',
  Stopped       = 'stopped',
  Crashed       = 'crashed'
}

// ============================================================================
// MockProcessController
// ============================================================================

/**
 * Mock implementation of ProcessController for unit testing
 *
 * Simulates process lifecycle without actually spawning bitcoind
 */
export class MockProcessController extends EventEmitter {
  private _state          : ProcessState
  private _client         : MockCoreClient
  private _startup_delay  : number
  private _shutdown_delay : number
  private _fail_start     : boolean
  private _fail_cleanup   : boolean
  private _recorder       : ReturnType<typeof create_call_recorder>
  private _pid?           : number

  constructor(config: MockProcessControllerConfig = {}) {
    super()
    this._state = this._parse_initial_state(config.initial_state)
    this._startup_delay = config.startup_delay ?? 0
    this._shutdown_delay = config.shutdown_delay ?? 0
    this._fail_start = config.fail_start ?? false
    this._fail_cleanup = config.fail_cleanup ?? false
    this._client = create_mock_client()
    this._recorder = create_call_recorder()
    this._pid = undefined
  }

  // ============================================================================
  // ProcessController Interface
  // ============================================================================

  /**
   * Start the process
   */
  async start(): Promise<void> {
    this._record_call('start', [])

    if (this._fail_start) {
      this._state = ProcessState.Crashed
      throw new Error('Mock process failed to start')
    }

    this._state = ProcessState.Starting
    this.emit('state:change', { state: this._state })

    if (this._startup_delay > 0) {
      await this._delay(this._startup_delay)
    }

    this._state = ProcessState.Running
    this._pid = Math.floor(Math.random() * 100000)
    this.emit('state:change', { state: this._state })
  }

  /**
   * Cleanup/stop the process
   */
  async cleanup(): Promise<void> {
    this._record_call('cleanup', [])

    if (this._fail_cleanup) {
      this._state = ProcessState.Crashed
      throw new Error('Mock process failed to cleanup')
    }

    this._state = ProcessState.Stopping
    this.emit('state:change', { state: this._state })

    if (this._shutdown_delay > 0) {
      await this._delay(this._shutdown_delay)
    }

    this._state = ProcessState.Stopped
    this._pid = undefined
    this.emit('state:change', { state: this._state })
  }

  /**
   * Get current state
   */
  get_state(): ProcessState {
    return this._state
  }

  /**
   * Get client
   */
  get_client(): MockCoreClient {
    return this._client
  }

  // ============================================================================
  // Additional Getters
  // ============================================================================

  get state(): ProcessState {
    return this._state
  }

  get pid(): number | undefined {
    return this._pid
  }

  get isRunning(): boolean {
    return this._state === ProcessState.Running || this._state === ProcessState.Connected
  }

  get isStopped(): boolean {
    return this._state === ProcessState.Stopped
  }

  get hasCrashed(): boolean {
    return this._state === ProcessState.Crashed
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
   * Force state (bypasses normal transitions)
   */
  _force_state(state: ProcessState): void {
    this._state = state
    this.emit('state:change', { state })
  }

  /**
   * Simulate process crash
   */
  _simulate_crash(error?: Error): void {
    this._state = ProcessState.Crashed
    this.emit('crash', error ?? new Error('Process crashed'))
    this.emit('state:change', { state: this._state })
  }

  /**
   * Set startup delay
   */
  _set_startup_delay(delay: number): void {
    this._startup_delay = delay
  }

  /**
   * Set shutdown delay
   */
  _set_shutdown_delay(delay: number): void {
    this._shutdown_delay = delay
  }

  /**
   * Configure start to fail
   */
  _set_fail_start(fail: boolean): void {
    this._fail_start = fail
  }

  /**
   * Configure cleanup to fail
   */
  _set_fail_cleanup(fail: boolean): void {
    this._fail_cleanup = fail
  }

  /**
   * Reset to initial state
   */
  _reset(): void {
    this._state = ProcessState.Uninitialized
    this._pid = undefined
    this._recorder.clear()
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private _parse_initial_state(
    state?: 'Uninitialized' | 'Running' | 'Connected' | 'Stopped'
  ): ProcessState {
    switch (state) {
      case 'Running':
        return ProcessState.Running
      case 'Connected':
        return ProcessState.Connected
      case 'Stopped':
        return ProcessState.Stopped
      default:
        return ProcessState.Uninitialized
    }
  }

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
// Factory Functions
// ============================================================================

/**
 * Create a mock ProcessController
 */
export function create_mock_process_controller(
  config: MockProcessControllerConfig = {}
): MockProcessController {
  return new MockProcessController(config)
}

/**
 * Create a running mock ProcessController
 */
export async function create_running_process_controller(
  config: MockProcessControllerConfig = {}
): Promise<MockProcessController> {
  const controller = new MockProcessController(config)
  await controller.start()
  return controller
}

// ============================================================================
// Export Types
// ============================================================================

export type { MockProcessControllerConfig }
