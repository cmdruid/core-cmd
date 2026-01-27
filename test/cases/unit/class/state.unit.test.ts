/**
 * Unit tests for DaemonStateMachine mock
 */

import type { TestFunction as TapeTest } from 'tape'
import type { MockTestContext } from '../../../lib/types/test.types.js'
import { DaemonState } from '../../../../src/index.js'
import {
  MockStateMachine,
  create_mock_state_machine,
  STATE_SEQUENCES
} from '../../../lib/mocks/state.mock.js'
import {
  verify_state_sequence,
  get_visited_states,
  get_final_state
} from '../../../lib/helpers/state.utils.js'

/**
 * State machine unit tests
 */
export default function state_unit_tests(
  tape: TapeTest,
  _ctx: MockTestContext
): void {
  tape('State machine - initial state', (t) => {
    const sm = create_mock_state_machine()

    t.equal(sm.state, DaemonState.Created, 'Initial state is Created')
    t.equal(sm.isReady, false, 'Not ready initially')
    t.equal(sm.isRunning, false, 'Not running initially')
    t.equal(sm.isStopped, false, 'Not stopped initially')
    t.equal(sm.hasError, false, 'No error initially')

    t.end()
  })

  tape('State machine - valid transitions', (t) => {
    const sm = create_mock_state_machine()

    sm.transition(DaemonState.Starting)
    t.equal(sm.state, DaemonState.Starting, 'Transitioned to Starting')

    sm.transition(DaemonState.ProcessRunning)
    t.equal(sm.state, DaemonState.ProcessRunning, 'Transitioned to ProcessRunning')
    t.equal(sm.isRunning, true, 'isRunning is true in ProcessRunning')

    sm.transition(DaemonState.Initializing)
    t.equal(sm.state, DaemonState.Initializing, 'Transitioned to Initializing')

    sm.transition(DaemonState.Ready)
    t.equal(sm.state, DaemonState.Ready, 'Transitioned to Ready')
    t.equal(sm.isReady, true, 'isReady is true in Ready state')

    t.end()
  })

  tape('State machine - invalid transitions throw', (t) => {
    const sm = create_mock_state_machine()

    try {
      sm.transition(DaemonState.Ready)
      t.fail('Should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'Threw an error')
      t.ok((err as Error).message.includes('Invalid state transition'), 'Error message mentions invalid transition')
    }

    t.end()
  })

  tape('State machine - error state', (t) => {
    const sm = create_mock_state_machine()
    const testError = new Error('Test error')

    sm.setError(testError)

    t.equal(sm.state, DaemonState.Error, 'State is Error')
    t.equal(sm.hasError, true, 'hasError is true')
    t.equal(sm.lastError, testError, 'lastError is set')

    t.end()
  })

  tape('State machine - history tracking', (t) => {
    const sm = create_mock_state_machine()

    sm._simulate_startup()

    t.equal(sm.history.length, 4, '4 transitions in startup')
    const visited = get_visited_states(sm.history)
    t.deepEqual(visited, STATE_SEQUENCES.STARTUP, 'Visited states match startup sequence')

    t.end()
  })

  tape('State machine - verify startup sequence', (t) => {
    const sm = create_mock_state_machine()

    sm._simulate_startup()

    verify_state_sequence(t, sm.history, [...STATE_SEQUENCES.STARTUP], 'Startup sequence verified')
    t.equal(get_final_state(sm.history), DaemonState.Ready, 'Final state is Ready')

    t.end()
  })

  tape('State machine - shutdown sequence', (t) => {
    const sm = create_mock_state_machine()

    sm._simulate_startup()
    sm._simulate_shutdown()

    t.equal(get_final_state(sm.history), DaemonState.Stopped, 'Final state is Stopped')
    t.equal(sm.isStopped, true, 'isStopped is true')
    t.ok(sm._has_transition(DaemonState.Ready, DaemonState.ShuttingDown), 'Ready -> ShuttingDown transition occurred')

    t.end()
  })

  tape('State machine - reset', (t) => {
    const sm = create_mock_state_machine()

    sm._simulate_startup()
    sm._simulate_shutdown()
    sm.reset()

    t.equal(sm.state, DaemonState.Created, 'State reset to Created')
    t.equal(sm.history.length, 0, 'History cleared')
    t.equal(sm.lastError, undefined, 'Last error cleared')

    t.end()
  })

  tape('State machine - cannot reset while running', (t) => {
    const sm = create_mock_state_machine()

    sm._simulate_startup()

    try {
      sm.reset()
      t.fail('Should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'Threw an error')
      t.ok((err as Error).message.includes('Cannot reset'), 'Error mentions cannot reset')
    }

    t.end()
  })

  tape('State machine - event emission', (t) => {
    const sm = create_mock_state_machine()
    let readyEmitted = false
    let changeCount = 0

    sm.on('state:ready', () => { readyEmitted = true })
    sm.on('state:change', () => { changeCount++ })

    sm._simulate_startup()

    t.equal(readyEmitted, true, 'state:ready event emitted')
    t.equal(changeCount, 4, '4 state:change events during startup')

    let stoppedEmitted = false
    sm.on('state:stopped', () => { stoppedEmitted = true })

    sm._simulate_shutdown()
    t.equal(stoppedEmitted, true, 'state:stopped event emitted')

    t.end()
  })

  tape('State machine - wait_for_ready', async (t) => {
    const sm = create_mock_state_machine()

    // Simulate startup in background
    setTimeout(() => sm._simulate_startup(), 10)

    await sm.wait_for_ready(1000)
    t.pass('wait_for_ready resolved')

    t.end()
  })

  tape('State machine - wait_for_ready timeout', async (t) => {
    const sm = create_mock_state_machine()

    try {
      await sm.wait_for_ready(50)
      t.fail('Should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'Threw an error')
      t.ok((err as Error).message.includes('Timeout'), 'Error mentions timeout')
    }

    t.end()
  })

  tape('State machine - transition count', (t) => {
    const sm = create_mock_state_machine()

    t.equal(sm._get_transition_count(), 0, 'Initial transition count is 0')

    sm._simulate_startup()
    t.equal(sm._get_transition_count(), 4, 'Transition count is 4 after startup')

    t.end()
  })
}
