/**
 * State machine testing utilities
 */

import type { Test } from 'tape'
import { DaemonState } from '../../../src/index.js'
import type { StateTransitionRecord } from '../mocks/state.mock.js'
import { STATE_SEQUENCES } from '../mocks/state.mock.js'

// ============================================================================
// State Verification
// ============================================================================

/**
 * Verify that a sequence of state transitions occurred
 *
 * @example
 * ```typescript
 * verify_state_sequence(t, stateMachine.history, [
 *   DaemonState.Created,
 *   DaemonState.Starting,
 *   DaemonState.ProcessRunning,
 *   DaemonState.Ready
 * ])
 * ```
 */
export function verify_state_sequence(
  t        : Test,
  history  : ReadonlyArray<StateTransitionRecord>,
  expected : DaemonState[],
  message? : string
): void {
  if (expected.length < 2) {
    t.fail('Expected sequence must have at least 2 states')
    return
  }

  const expectedTransitions = expected.length - 1
  if (history.length !== expectedTransitions) {
    t.fail(
      message ??
      `Expected ${expectedTransitions} transitions but got ${history.length}`
    )
    return
  }

  let allMatch = true
  for (let i = 0; i < history.length; i++) {
    if (history[i].from !== expected[i] || history[i].to !== expected[i + 1]) {
      allMatch = false
      break
    }
  }

  if (allMatch) {
    t.pass(message ?? `State sequence matches: ${expected.join(' -> ')}`)
  } else {
    const actual = get_visited_states(history).join(' -> ')
    t.fail(
      message ??
      `State sequence mismatch. Expected: ${expected.join(' -> ')}, Got: ${actual}`
    )
  }
}

/**
 * Verify that a standard sequence occurred
 */
export function verify_standard_sequence(
  t           : Test,
  history     : ReadonlyArray<StateTransitionRecord>,
  sequenceName: keyof typeof STATE_SEQUENCES,
  message?    : string
): void {
  const expected = STATE_SEQUENCES[sequenceName]
  verify_state_sequence(t, history, expected as unknown as DaemonState[], message)
}

/**
 * Verify that startup completed successfully
 */
export function verify_startup_sequence(
  t       : Test,
  history : ReadonlyArray<StateTransitionRecord>,
  message?: string
): void {
  verify_standard_sequence(t, history, 'STARTUP', message ?? 'Startup sequence completed')
}

/**
 * Verify that shutdown completed successfully
 */
export function verify_shutdown_sequence(
  t       : Test,
  history : ReadonlyArray<StateTransitionRecord>,
  message?: string
): void {
  verify_standard_sequence(t, history, 'SHUTDOWN', message ?? 'Shutdown sequence completed')
}

// ============================================================================
// State Assertions
// ============================================================================

/**
 * Assert current state
 */
export function assert_state(
  t            : Test,
  currentState : DaemonState,
  expectedState: DaemonState,
  message?     : string
): void {
  t.equal(
    currentState,
    expectedState,
    message ?? `State is ${expectedState}`
  )
}

/**
 * Assert that a transition occurred
 */
export function assert_transition(
  t       : Test,
  history : ReadonlyArray<StateTransitionRecord>,
  from    : DaemonState,
  to      : DaemonState,
  message?: string
): void {
  const found = history.some(r => r.from === from && r.to === to)
  t.ok(
    found,
    message ?? `Transition ${from} -> ${to} occurred`
  )
}

/**
 * Assert that a transition did not occur
 */
export function assert_no_transition(
  t       : Test,
  history : ReadonlyArray<StateTransitionRecord>,
  from    : DaemonState,
  to      : DaemonState,
  message?: string
): void {
  const found = history.some(r => r.from === from && r.to === to)
  t.ok(
    !found,
    message ?? `Transition ${from} -> ${to} did not occur`
  )
}

/**
 * Assert that a state was visited
 */
export function assert_state_visited(
  t       : Test,
  history : ReadonlyArray<StateTransitionRecord>,
  state   : DaemonState,
  message?: string
): void {
  const visited = get_visited_states(history)
  t.ok(
    visited.includes(state),
    message ?? `State ${state} was visited`
  )
}

/**
 * Assert that a state was never visited
 */
export function assert_state_not_visited(
  t       : Test,
  history : ReadonlyArray<StateTransitionRecord>,
  state   : DaemonState,
  message?: string
): void {
  const visited = get_visited_states(history)
  t.ok(
    !visited.includes(state),
    message ?? `State ${state} was never visited`
  )
}

/**
 * Assert transition count
 */
export function assert_transition_count(
  t       : Test,
  history : ReadonlyArray<StateTransitionRecord>,
  count   : number,
  message?: string
): void {
  t.equal(
    history.length,
    count,
    message ?? `${count} transitions occurred`
  )
}

// ============================================================================
// State Utilities
// ============================================================================

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

/**
 * Get the final state from history
 */
export function get_final_state(
  history: ReadonlyArray<StateTransitionRecord>
): DaemonState | undefined {
  if (history.length === 0) return undefined
  return history[history.length - 1].to
}

/**
 * Get the initial state from history
 */
export function get_initial_state(
  history: ReadonlyArray<StateTransitionRecord>
): DaemonState | undefined {
  if (history.length === 0) return undefined
  return history[0].from
}

/**
 * Count transitions to a specific state
 */
export function count_transitions_to(
  history : ReadonlyArray<StateTransitionRecord>,
  state   : DaemonState
): number {
  return history.filter(r => r.to === state).length
}

/**
 * Count transitions from a specific state
 */
export function count_transitions_from(
  history : ReadonlyArray<StateTransitionRecord>,
  state   : DaemonState
): number {
  return history.filter(r => r.from === state).length
}

/**
 * Get all transitions involving a state
 */
export function get_state_transitions(
  history : ReadonlyArray<StateTransitionRecord>,
  state   : DaemonState
): StateTransitionRecord[] {
  return history.filter(r => r.from === state || r.to === state)
}

/**
 * Check if history contains any errors
 */
export function has_error_transition(
  history: ReadonlyArray<StateTransitionRecord>
): boolean {
  return history.some(r => r.to === DaemonState.Error || r.error !== undefined)
}

/**
 * Get all error transitions
 */
export function get_error_transitions(
  history: ReadonlyArray<StateTransitionRecord>
): StateTransitionRecord[] {
  return history.filter(r => r.to === DaemonState.Error || r.error !== undefined)
}

/**
 * Get time spent in each state
 */
export function get_state_durations(
  history: ReadonlyArray<StateTransitionRecord>
): Map<DaemonState, number> {
  const durations = new Map<DaemonState, number>()

  for (let i = 0; i < history.length; i++) {
    const state = history[i].from
    const start = i === 0 ? history[i].timestamp : history[i - 1].timestamp
    const end = history[i].timestamp
    const duration = end.getTime() - start.getTime()

    const existing = durations.get(state) ?? 0
    durations.set(state, existing + duration)
  }

  return durations
}

// ============================================================================
// Re-export
// ============================================================================

export { STATE_SEQUENCES }
