/**
 * State machine for CoreDaemon lifecycle management
 */

import { EventEmitter }      from '@vbyte/util'

import { create_core_debug } from '@/util/debug.js'

const debug = create_core_debug('state')

/**
 * Daemon lifecycle states
 */
export enum DaemonState {
  /** Initial state before any operation */
  Created = 'created',
  /** Process is starting up */
  Starting = 'starting',
  /** Process is running but not yet initialized */
  ProcessRunning = 'process_running',
  /** Running initialization (loading faucet, mining initial blocks) */
  Initializing = 'initializing',
  /** Fully ready for operations */
  Ready = 'ready',
  /** Graceful shutdown in progress */
  ShuttingDown = 'shutting_down',
  /** Process has stopped */
  Stopped = 'stopped',
  /** An error occurred */
  Error = 'error'
}

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<DaemonState, DaemonState[]> = {
  [DaemonState.Created]: [DaemonState.Starting, DaemonState.Error],
  [DaemonState.Starting]: [DaemonState.ProcessRunning, DaemonState.Error, DaemonState.Stopped],
  [DaemonState.ProcessRunning]: [DaemonState.Initializing, DaemonState.ShuttingDown, DaemonState.Error],
  [DaemonState.Initializing]: [DaemonState.Ready, DaemonState.ShuttingDown, DaemonState.Error],
  [DaemonState.Ready]: [DaemonState.ShuttingDown, DaemonState.Error],
  [DaemonState.ShuttingDown]: [DaemonState.Stopped, DaemonState.Error],
  [DaemonState.Stopped]: [], // Terminal state
  [DaemonState.Error]: [DaemonState.ShuttingDown, DaemonState.Stopped] // Can attempt cleanup from error
}

/**
 * State change event data
 */
export interface StateChangeEvent {
  from      : DaemonState
  to        : DaemonState
  timestamp : Date
  error?    : Error
}

/**
 * State machine events
 */
export interface StateMachineEvents {
  'state:change': StateChangeEvent
  'state:ready': void
  'state:error': Error
  'state:stopped': void
}

/**
 * Daemon state machine that manages lifecycle transitions
 */
export class DaemonStateMachine extends EventEmitter<StateMachineEvents> {
  private _state: DaemonState = DaemonState.Created
  private _lastError?: Error
  private _stateHistory: StateChangeEvent[] = []

  /**
   * Get the current state
   */
  get state(): DaemonState {
    return this._state
  }

  /**
   * Check if the daemon is ready for operations
   */
  get isReady(): boolean {
    return this._state === DaemonState.Ready
  }

  /**
   * Check if the daemon is in a running state (not stopped/error)
   */
  get isRunning(): boolean {
    return (
      this._state === DaemonState.ProcessRunning ||
      this._state === DaemonState.Initializing ||
      this._state === DaemonState.Ready
    )
  }

  /**
   * Check if the daemon has stopped
   */
  get isStopped(): boolean {
    return this._state === DaemonState.Stopped
  }

  /**
   * Check if the daemon is in an error state
   */
  get hasError(): boolean {
    return this._state === DaemonState.Error
  }

  /**
   * Get the last error if any
   */
  get lastError(): Error | undefined {
    return this._lastError
  }

  /**
   * Get the state history
   */
  get history(): ReadonlyArray<StateChangeEvent> {
    return this._stateHistory
  }

  /**
   * Transition to a new state
   * @throws Error if the transition is not valid
   */
  transition(newState: DaemonState, error?: Error): void {
    const validNextStates = VALID_TRANSITIONS[this._state]

    if (!validNextStates.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${this._state} -> ${newState}. ` +
        `Valid transitions: ${validNextStates.join(', ') || 'none'}`
      )
    }

    const event: StateChangeEvent = {
      from      : this._state,
      to        : newState,
      timestamp : new Date(),
      error
    }

    this._stateHistory.push(event)
    this._state = newState

    if (error) {
      this._lastError = error
    }

    debug('state transition: %s -> %s', event.from, event.to)

    // Emit events
    this.emit('state:change', event)

    if (newState === DaemonState.Ready) {
      debug('daemon ready')
      this.emit('state:ready', undefined)
    } else if (newState === DaemonState.Error && error) {
      debug('daemon error: %s', error.message)
      this.emit('state:error', error)
    } else if (newState === DaemonState.Stopped) {
      debug('daemon stopped')
      this.emit('state:stopped', undefined)
    }
  }

  /**
   * Convenience method to transition to error state
   */
  setError(error: Error): void {
    this.transition(DaemonState.Error, error)
  }

  /**
   * Wait for the daemon to reach the ready state
   * @param timeout Maximum time to wait in milliseconds
   * @throws Error if timeout is reached or daemon enters error state
   */
  async wait_for_ready(timeout = 30000): Promise<void> {
    if (this.isReady) return

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Timeout waiting for daemon to become ready (${timeout}ms)`))
      }, timeout)

      const onReady = () => {
        cleanup()
        resolve()
      }

      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }

      const onStopped = () => {
        cleanup()
        reject(new Error('Daemon stopped before becoming ready'))
      }

      const cleanup = () => {
        clearTimeout(timer)
        this.off('state:ready', onReady)
        this.off('state:error', onError)
        this.off('state:stopped', onStopped)
      }

      this.once('state:ready', onReady)
      this.once('state:error', onError)
      this.once('state:stopped', onStopped)
    })
  }

  /**
   * Wait for the daemon to stop
   * @param timeout Maximum time to wait in milliseconds
   */
  async wait_for_stopped(timeout = 10000): Promise<void> {
    if (this.isStopped) return

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Timeout waiting for daemon to stop (${timeout}ms)`))
      }, timeout)

      const onStopped = () => {
        cleanup()
        resolve()
      }

      const cleanup = () => {
        clearTimeout(timer)
        this.off('state:stopped', onStopped)
      }

      this.once('state:stopped', onStopped)
    })
  }

  /**
   * Reset the state machine to its initial state
   * Only allowed when stopped or in error state
   */
  reset(): void {
    if (this._state !== DaemonState.Stopped && this._state !== DaemonState.Error) {
      throw new Error(`Cannot reset state machine while in ${this._state} state`)
    }

    debug('resetting state machine')
    this._state = DaemonState.Created
    this._lastError = undefined
    this._stateHistory = []
  }
}
