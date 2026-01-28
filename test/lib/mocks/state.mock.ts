/**
 * Mock implementation of DaemonStateMachine for unit testing
 */

import { EventEmitter } from 'node:events'
import { DaemonState } from '../../../src/index.js'
import type {
  MockStateMachineConfig,
  StateTransitionRecord
} from '../types/mock.types.js'

// Re-export StateTransitionRecord for use in other modules
export type { StateTransitionRecord }

// ============================================================================
// Valid State Transitions (copied from actual implementation)
// ============================================================================

const VALID_TRANSITIONS: Record<DaemonState, DaemonState[]> = {
  [DaemonState.Created]: [DaemonState.Starting, DaemonState.Error],
  [DaemonState.Starting]: [DaemonState.ProcessRunning, DaemonState.Error, DaemonState.Stopped],
  [DaemonState.ProcessRunning]: [DaemonState.Initializing, DaemonState.ShuttingDown, DaemonState.Error],
  [DaemonState.Initializing]: [DaemonState.Ready, DaemonState.ShuttingDown, DaemonState.Error],
  [DaemonState.Ready]: [DaemonState.ShuttingDown, DaemonState.Error],
  [DaemonState.ShuttingDown]: [DaemonState.Stopped, DaemonState.Error],
  [DaemonState.Stopped]: [],
  [DaemonState.Error]: [DaemonState.ShuttingDown, DaemonState.Stopped]
}

// ============================================================================
// Predefined State Sequences
// ============================================================================

/**
 * Common state transition sequences for testing
 */
export const STATE_SEQUENCES = {
  /** Normal startup sequence */
  STARTUP: [
    DaemonState.Created,
    DaemonState.Starting,
    DaemonState.ProcessRunning,
    DaemonState.Initializing,
    DaemonState.Ready
  ],
  /** Normal shutdown sequence */
  SHUTDOWN: [
    DaemonState.Ready,
    DaemonState.ShuttingDown,
    DaemonState.Stopped
  ],
  /** Startup with error */
  STARTUP_ERROR: [
    DaemonState.Created,
    DaemonState.Starting,
    DaemonState.Error
  ],
  /** Full lifecycle */
  FULL_LIFECYCLE: [
    DaemonState.Created,
    DaemonState.Starting,
    DaemonState.ProcessRunning,
    DaemonState.Initializing,
    DaemonState.Ready,
    DaemonState.ShuttingDown,
    DaemonState.Stopped
  ],
  /** Error recovery */
  ERROR_RECOVERY: [
    DaemonState.Error,
    DaemonState.ShuttingDown,
    DaemonState.Stopped
  ]
} as const

// ============================================================================
// State Change Event
// ============================================================================

export interface StateChangeEvent {
  from      : DaemonState
  to        : DaemonState
  timestamp : Date
  error?    : Error
}

// ============================================================================
// MockStateMachine
// ============================================================================

/**
 * Mock implementation of DaemonStateMachine for testing
 */
export class MockStateMachine extends EventEmitter {
  private _state         : DaemonState
  private _lastError?    : Error
  private _history       : StateTransitionRecord[] = []
  private _record_history: boolean
  private _emit_events   : boolean
  private _transition_count : number = 0

  constructor(config: MockStateMachineConfig = {}) {
    super()
    this._state = config.initial_state ?? DaemonState.Created
    this._record_history = config.record_history ?? true
    this._emit_events = config.emit_events ?? true
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  get state(): DaemonState {
    return this._state
  }

  get isReady(): boolean {
    return this._state === DaemonState.Ready
  }

  get isRunning(): boolean {
    return (
      this._state === DaemonState.ProcessRunning ||
      this._state === DaemonState.Initializing ||
      this._state === DaemonState.Ready
    )
  }

  get isStopped(): boolean {
    return this._state === DaemonState.Stopped
  }

  get hasError(): boolean {
    return this._state === DaemonState.Error
  }

  get lastError(): Error | undefined {
    return this._lastError
  }

  get history(): ReadonlyArray<StateTransitionRecord> {
    return this._history
  }

  // ============================================================================
  // State Transitions
  // ============================================================================

  /**
   * Transition to a new state with validation
   */
  transition(newState: DaemonState, error?: Error): void {
    const validNextStates = VALID_TRANSITIONS[this._state]

    if (!validNextStates.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${this._state} -> ${newState}. ` +
        `Valid transitions: ${validNextStates.join(', ') || 'none'}`
      )
    }

    const record: StateTransitionRecord = {
      from      : this._state,
      to        : newState,
      timestamp : new Date(),
      error
    }

    if (this._record_history) {
      this._history.push(record)
    }

    this._state = newState
    this._transition_count++

    if (error) {
      this._lastError = error
    }

    // Emit events if enabled
    if (this._emit_events) {
      this.emit('state:change', record)

      if (newState === DaemonState.Ready) {
        this.emit('state:ready', undefined)
      } else if (newState === DaemonState.Error && error) {
        this.emit('state:error', error)
      } else if (newState === DaemonState.Stopped) {
        this.emit('state:stopped', undefined)
      }
    }
  }

  /**
   * Convenience method to transition to error state
   */
  setError(error: Error): void {
    this.transition(DaemonState.Error, error)
  }

  /**
   * Wait for ready state
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
   * Wait for stopped state
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
   * Reset state machine
   */
  reset(): void {
    if (this._state !== DaemonState.Stopped && this._state !== DaemonState.Error) {
      throw new Error(`Cannot reset state machine while in ${this._state} state`)
    }

    this._state = DaemonState.Created
    this._lastError = undefined
    this._history = []
    this._transition_count = 0
  }

  // ============================================================================
  // Test Helpers
  // ============================================================================

  /**
   * Force state without validation (for testing invalid states)
   */
  _force_state(state: DaemonState, error?: Error): void {
    const record: StateTransitionRecord = {
      from      : this._state,
      to        : state,
      timestamp : new Date(),
      error
    }

    if (this._record_history) {
      this._history.push(record)
    }

    this._state = state
    this._transition_count++

    if (error) {
      this._lastError = error
    }
  }

  /**
   * Get the total number of transitions
   */
  _get_transition_count(): number {
    return this._transition_count
  }

  /**
   * Clear transition history
   */
  _clear_history(): void {
    this._history = []
  }

  /**
   * Get transitions between specific states
   */
  _get_transitions_between(from: DaemonState, to: DaemonState): StateTransitionRecord[] {
    return this._history.filter(r => r.from === from && r.to === to)
  }

  /**
   * Check if a specific transition occurred
   */
  _has_transition(from: DaemonState, to: DaemonState): boolean {
    return this._history.some(r => r.from === from && r.to === to)
  }

  /**
   * Run a sequence of state transitions
   */
  _run_sequence(sequence: readonly DaemonState[]): void {
    for (let i = 1; i < sequence.length; i++) {
      this.transition(sequence[i])
    }
  }

  /**
   * Simulate startup to ready state
   */
  _simulate_startup(): void {
    this._run_sequence(STATE_SEQUENCES.STARTUP)
  }

  /**
   * Simulate shutdown from ready state
   */
  _simulate_shutdown(): void {
    if (this._state === DaemonState.Ready) {
      this._run_sequence(STATE_SEQUENCES.SHUTDOWN)
    }
  }

  /**
   * Set event emission
   */
  _set_emit_events(enabled: boolean): void {
    this._emit_events = enabled
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a mock state machine
 */
export function create_mock_state_machine(
  config: MockStateMachineConfig = {}
): MockStateMachine {
  return new MockStateMachine(config)
}

// ============================================================================
// State Verification Utilities
// ============================================================================

/**
 * Verify that a sequence of state transitions occurred
 */
export function verify_state_sequence(
  history  : ReadonlyArray<StateTransitionRecord>,
  expected : DaemonState[]
): boolean {
  if (history.length !== expected.length - 1) {
    return false
  }

  for (let i = 0; i < history.length; i++) {
    if (history[i].from !== expected[i] || history[i].to !== expected[i + 1]) {
      return false
    }
  }

  return true
}

/**
 * Get all states visited from history
 */
export function get_visited_states(
  history: ReadonlyArray<StateTransitionRecord>
): DaemonState[] {
  if (history.length === 0) return []

  const states: DaemonState[] = [history[0].from]
  for (const record of history) {
    states.push(record.to)
  }
  return states
}
