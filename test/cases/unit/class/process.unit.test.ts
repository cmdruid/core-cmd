/**
 * Unit tests for Process management classes
 */

import type { TapeHarness, MockTestContext } from '../../../lib/types/test.types.js'
import {
  MockProcessController,
  ProcessState,
  create_mock_process_controller,
  create_running_process_controller
} from '../../../lib/mocks/process.mock.js'

export default function process_unit_tests(
  tape: TapeHarness,
  _ctx: MockTestContext
): void {
  // =========================================================================
  // MockProcessController - Initial State Tests
  // =========================================================================

  tape('ProcessController - initial state is Uninitialized', (t) => {
    const controller = create_mock_process_controller()

    t.equal(controller.get_state(), ProcessState.Uninitialized, 'Initial state is Uninitialized')
    t.equal(controller.state, ProcessState.Uninitialized, 'state getter returns Uninitialized')
    t.notOk(controller.isRunning, 'isRunning is false initially')
    t.notOk(controller.isStopped, 'isStopped is false initially')
    t.notOk(controller.hasCrashed, 'hasCrashed is false initially')
    t.equal(controller.pid, undefined, 'PID is undefined initially')
    t.end()
  })

  tape('ProcessController - can configure initial state', (t) => {
    const running = create_mock_process_controller({ initial_state: 'Running' })
    const connected = create_mock_process_controller({ initial_state: 'Connected' })
    const stopped = create_mock_process_controller({ initial_state: 'Stopped' })

    t.equal(running.get_state(), ProcessState.Running, 'Running initial state')
    t.equal(connected.get_state(), ProcessState.Connected, 'Connected initial state')
    t.equal(stopped.get_state(), ProcessState.Stopped, 'Stopped initial state')
    t.end()
  })

  // =========================================================================
  // ProcessController - Start Tests
  // =========================================================================

  tape('ProcessController - start transitions to Running', async (t) => {
    const controller = create_mock_process_controller()

    await controller.start()

    t.equal(controller.get_state(), ProcessState.Running, 'State is Running after start')
    t.ok(controller.isRunning, 'isRunning is true')
    t.ok(controller.pid !== undefined, 'PID is assigned')
    t.ok((controller.pid ?? 0) > 0, 'PID is positive')
    t.end()
  })

  tape('ProcessController - start emits state:change events', async (t) => {
    const controller = create_mock_process_controller()
    const stateChanges: ProcessState[] = []

    controller.on('state:change', ({ state }) => {
      stateChanges.push(state)
    })

    await controller.start()

    t.ok(stateChanges.includes(ProcessState.Starting), 'Emitted Starting state')
    t.ok(stateChanges.includes(ProcessState.Running), 'Emitted Running state')
    t.equal(stateChanges.length, 2, 'Two state changes during start')
    t.end()
  })

  tape('ProcessController - start with delay', async (t) => {
    const controller = create_mock_process_controller({ startup_delay: 50 })
    const startTime = Date.now()

    await controller.start()

    const elapsed = Date.now() - startTime
    t.ok(elapsed >= 40, 'Start waited for delay') // Allow some tolerance
    t.equal(controller.get_state(), ProcessState.Running, 'State is Running')
    t.end()
  })

  tape('ProcessController - start fails when configured', async (t) => {
    const controller = create_mock_process_controller({ fail_start: true })

    try {
      await controller.start()
      t.fail('Should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'Threw an error')
      t.ok((err as Error).message.includes('failed to start'), 'Error message mentions failure')
      t.equal(controller.get_state(), ProcessState.Crashed, 'State is Crashed')
      t.ok(controller.hasCrashed, 'hasCrashed is true')
    }
    t.end()
  })

  // =========================================================================
  // ProcessController - Cleanup Tests
  // =========================================================================

  tape('ProcessController - cleanup transitions to Stopped', async (t) => {
    const controller = await create_running_process_controller()

    await controller.cleanup()

    t.equal(controller.get_state(), ProcessState.Stopped, 'State is Stopped after cleanup')
    t.ok(controller.isStopped, 'isStopped is true')
    t.notOk(controller.isRunning, 'isRunning is false')
    t.equal(controller.pid, undefined, 'PID is cleared')
    t.end()
  })

  tape('ProcessController - cleanup emits state:change events', async (t) => {
    const controller = await create_running_process_controller()
    const stateChanges: ProcessState[] = []

    controller.on('state:change', ({ state }) => {
      stateChanges.push(state)
    })

    await controller.cleanup()

    t.ok(stateChanges.includes(ProcessState.Stopping), 'Emitted Stopping state')
    t.ok(stateChanges.includes(ProcessState.Stopped), 'Emitted Stopped state')
    t.equal(stateChanges.length, 2, 'Two state changes during cleanup')
    t.end()
  })

  tape('ProcessController - cleanup with delay', async (t) => {
    const controller = await create_running_process_controller({ shutdown_delay: 50 })
    const startTime = Date.now()

    await controller.cleanup()

    const elapsed = Date.now() - startTime
    t.ok(elapsed >= 40, 'Cleanup waited for delay')
    t.equal(controller.get_state(), ProcessState.Stopped, 'State is Stopped')
    t.end()
  })

  tape('ProcessController - cleanup fails when configured', async (t) => {
    const controller = await create_running_process_controller({ fail_cleanup: true })

    try {
      await controller.cleanup()
      t.fail('Should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'Threw an error')
      t.ok((err as Error).message.includes('failed to cleanup'), 'Error message mentions failure')
      t.equal(controller.get_state(), ProcessState.Crashed, 'State is Crashed')
    }
    t.end()
  })

  // =========================================================================
  // ProcessController - get_client Tests
  // =========================================================================

  tape('ProcessController - get_client returns mock client', (t) => {
    const controller = create_mock_process_controller()
    const client = controller.get_client()

    t.ok(client, 'Returns a client')
    t.ok(typeof client.cmd === 'function', 'Client has cmd method')
    t.end()
  })

  // =========================================================================
  // ProcessController - State Queries
  // =========================================================================

  tape('ProcessController - isRunning for different states', async (t) => {
    const uninitialized = create_mock_process_controller()
    t.notOk(uninitialized.isRunning, 'Uninitialized is not running')

    const running = await create_running_process_controller()
    t.ok(running.isRunning, 'Running is running')

    const connected = create_mock_process_controller({ initial_state: 'Connected' })
    t.ok(connected.isRunning, 'Connected is running')

    const stopped = create_mock_process_controller({ initial_state: 'Stopped' })
    t.notOk(stopped.isRunning, 'Stopped is not running')

    t.end()
  })

  tape('ProcessController - isStopped for different states', (t) => {
    const uninitialized = create_mock_process_controller()
    t.notOk(uninitialized.isStopped, 'Uninitialized is not stopped')

    const running = create_mock_process_controller({ initial_state: 'Running' })
    t.notOk(running.isStopped, 'Running is not stopped')

    const stopped = create_mock_process_controller({ initial_state: 'Stopped' })
    t.ok(stopped.isStopped, 'Stopped is stopped')

    t.end()
  })

  // =========================================================================
  // ProcessController - Test Helpers
  // =========================================================================

  tape('ProcessController - _force_state bypasses normal transitions', (t) => {
    const controller = create_mock_process_controller()

    controller._force_state(ProcessState.Running)
    t.equal(controller.get_state(), ProcessState.Running, 'Forced to Running')

    controller._force_state(ProcessState.Crashed)
    t.equal(controller.get_state(), ProcessState.Crashed, 'Forced to Crashed')

    controller._force_state(ProcessState.Stopped)
    t.equal(controller.get_state(), ProcessState.Stopped, 'Forced to Stopped')

    t.end()
  })

  tape('ProcessController - _simulate_crash sets Crashed state', (t) => {
    const controller = create_mock_process_controller({ initial_state: 'Running' })
    let crashEmitted = false

    controller.on('crash', () => { crashEmitted = true })

    controller._simulate_crash()

    t.equal(controller.get_state(), ProcessState.Crashed, 'State is Crashed')
    t.ok(controller.hasCrashed, 'hasCrashed is true')
    t.ok(crashEmitted, 'crash event emitted')
    t.end()
  })

  tape('ProcessController - _simulate_crash with custom error', (t) => {
    const controller = create_mock_process_controller({ initial_state: 'Running' })
    const customError = new Error('Custom crash')
    let receivedError: Error | undefined

    controller.on('crash', (err) => { receivedError = err })

    controller._simulate_crash(customError)

    t.equal(receivedError, customError, 'Custom error passed to crash event')
    t.end()
  })

  tape('ProcessController - _reset returns to initial state', async (t) => {
    const controller = await create_running_process_controller()

    controller._reset()

    t.equal(controller.get_state(), ProcessState.Uninitialized, 'State reset to Uninitialized')
    t.equal(controller.pid, undefined, 'PID cleared')
    t.equal(controller._calls.length, 0, 'Calls cleared')
    t.end()
  })

  tape('ProcessController - _set_startup_delay changes delay', async (t) => {
    const controller = create_mock_process_controller()

    controller._set_startup_delay(100)

    const startTime = Date.now()
    await controller.start()
    const elapsed = Date.now() - startTime

    t.ok(elapsed >= 90, 'New delay was applied')
    t.end()
  })

  tape('ProcessController - _set_fail_start changes behavior', async (t) => {
    const controller = create_mock_process_controller()

    controller._set_fail_start(true)

    try {
      await controller.start()
      t.fail('Should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'Throws after setting fail_start')
    }
    t.end()
  })

  // =========================================================================
  // ProcessController - Call Recording
  // =========================================================================

  tape('ProcessController - records start call', async (t) => {
    const controller = create_mock_process_controller()

    await controller.start()

    t.equal(controller._calls.length, 1, 'One call recorded')
    t.equal(controller._calls[0].method, 'start', 'Method is start')
    t.ok(controller._calls[0].timestamp instanceof Date, 'Has timestamp')
    t.end()
  })

  tape('ProcessController - records cleanup call', async (t) => {
    const controller = await create_running_process_controller()

    await controller.cleanup()

    const calls = controller._calls.filter(c => c.method === 'cleanup')
    t.equal(calls.length, 1, 'Cleanup call recorded')
    t.end()
  })

  tape('ProcessController - records multiple calls in order', async (t) => {
    const controller = create_mock_process_controller()

    await controller.start()
    await controller.cleanup()

    t.equal(controller._calls.length, 2, 'Two calls recorded')
    t.equal(controller._calls[0].method, 'start', 'First call is start')
    t.equal(controller._calls[1].method, 'cleanup', 'Second call is cleanup')
    t.end()
  })

  // =========================================================================
  // ProcessState Enum Tests
  // =========================================================================

  tape('ProcessState - has expected values', (t) => {
    t.equal(ProcessState.Uninitialized, 'uninitialized', 'Uninitialized value')
    t.equal(ProcessState.Starting, 'starting', 'Starting value')
    t.equal(ProcessState.Running, 'running', 'Running value')
    t.equal(ProcessState.Connected, 'connected', 'Connected value')
    t.equal(ProcessState.Stopping, 'stopping', 'Stopping value')
    t.equal(ProcessState.Stopped, 'stopped', 'Stopped value')
    t.equal(ProcessState.Crashed, 'crashed', 'Crashed value')
    t.end()
  })

  // =========================================================================
  // Factory Function Tests
  // =========================================================================

  tape('create_mock_process_controller - creates controller', (t) => {
    const controller = create_mock_process_controller()

    t.ok(controller instanceof MockProcessController, 'Returns MockProcessController')
    t.equal(controller.get_state(), ProcessState.Uninitialized, 'Default state')
    t.end()
  })

  tape('create_running_process_controller - creates running controller', async (t) => {
    const controller = await create_running_process_controller()

    t.ok(controller instanceof MockProcessController, 'Returns MockProcessController')
    t.equal(controller.get_state(), ProcessState.Running, 'Already running')
    t.ok(controller.pid !== undefined, 'Has PID')
    t.end()
  })

  tape('create_running_process_controller - accepts config', async (t) => {
    const controller = await create_running_process_controller({ shutdown_delay: 50 })

    t.ok(controller.isRunning, 'Is running')
    // Verify delay is set by testing cleanup
    const startTime = Date.now()
    await controller.cleanup()
    const elapsed = Date.now() - startTime
    t.ok(elapsed >= 40, 'Shutdown delay was applied')
    t.end()
  })
}
