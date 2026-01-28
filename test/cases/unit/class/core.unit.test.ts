/**
 * Unit tests for CoreDaemon using mocks
 */

import type { TapeHarness, MockTestContext } from '../../../lib/types/test.types.js'
import { DaemonState } from '../../../../src/index.js'
import {
  MockCoreDaemon,
  MockDaemonFactory,
  create_mock_daemon
} from '../../../lib/mocks/daemon.mock.js'

export default function core_unit_tests(
  tape: TapeHarness,
  _ctx: MockTestContext
): void {
  // =========================================================================
  // MockCoreDaemon - Creation Tests
  // =========================================================================

  tape('CoreDaemon - create_mock_daemon creates uninitialized daemon', (t) => {
    const daemon = create_mock_daemon()

    t.ok(daemon instanceof MockCoreDaemon, 'Returns MockCoreDaemon')
    t.equal(daemon.daemonState, DaemonState.Created, 'Initial state is Created')
    t.notOk(daemon.isReady, 'Not ready initially')
    t.end()
  })

  tape('CoreDaemon - can configure initial state', (t) => {
    const errored = create_mock_daemon({ initial_state: DaemonState.Error })

    t.equal(errored.daemonState, DaemonState.Error, 'Can set Error state')
    t.end()
  })

  // =========================================================================
  // MockDaemonFactory Tests
  // =========================================================================

  tape('MockDaemonFactory.ready - creates ready daemon', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    t.ok(daemon instanceof MockCoreDaemon, 'Returns MockCoreDaemon')
    t.equal(daemon.daemonState, DaemonState.Ready, 'State is Ready')
    t.ok(daemon.isReady, 'isReady is true')

    await daemon.shutdown()
    t.end()
  })

  tape('MockDaemonFactory.errored - creates errored daemon', (t) => {
    const error = new Error('Test error')
    const daemon = MockDaemonFactory.errored(error)

    t.equal(daemon.daemonState, DaemonState.Error, 'State is Error')
    t.notOk(daemon.isReady, 'Not ready in error state')
    t.end()
  })

  tape('MockDaemonFactory.uninitialized - creates uninitialized daemon', (t) => {
    const daemon = MockDaemonFactory.uninitialized()

    t.equal(daemon.daemonState, DaemonState.Created, 'State is Created')
    t.notOk(daemon.isReady, 'Not ready')
    t.end()
  })

  tape('MockDaemonFactory.stopped - creates stopped daemon', (t) => {
    const daemon = MockDaemonFactory.stopped()

    t.equal(daemon.daemonState, DaemonState.Stopped, 'State is Stopped')
    t.notOk(daemon.isReady, 'Not ready when stopped')
    t.end()
  })

  tape('MockDaemonFactory.with_balance - creates daemon with custom faucet balance', async (t) => {
    const daemon = await MockDaemonFactory.with_balance(50_000_000_000)

    t.ok(daemon.isReady, 'Daemon is ready')
    // Faucet balance is set via config
    await daemon.shutdown()
    t.end()
  })

  // =========================================================================
  // Getter Tests
  // =========================================================================

  tape('CoreDaemon - client getter returns client', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    const client = daemon.client
    t.ok(client, 'Returns client')
    t.ok(typeof client.cmd === 'function', 'Client has cmd method')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - faucet getter returns faucet wallet', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    const faucet = daemon.faucet
    t.ok(faucet, 'Returns faucet')
    t.equal(faucet.label, 'faucet', 'Faucet has correct label')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - opt getter returns config', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    const opt = daemon.opt
    t.ok(opt, 'Returns config')
    t.equal(opt.network, 'regtest', 'Default network is regtest')
    t.equal(opt.isolated, true, 'Default isolated is true')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - opt includes custom config', async (t) => {
    const daemon = await MockDaemonFactory.ready({
      core_config: { debug: true, timeout: 60000 }
    })

    const opt = daemon.opt
    t.equal(opt.debug, true, 'Custom debug config')
    t.equal(opt.timeout, 60000, 'Custom timeout config')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - isReady reflects state', async (t) => {
    const uninit = create_mock_daemon()
    t.notOk(uninit.isReady, 'Not ready when Created')

    const ready = await MockDaemonFactory.ready()
    t.ok(ready.isReady, 'Ready when Ready state')

    await ready.shutdown()
    t.notOk(ready.isReady, 'Not ready when Stopped')
    t.end()
  })

  tape('CoreDaemon - state getter returns process state', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    const state = daemon.state
    t.ok(state, 'Returns state')
    t.equal(typeof state, 'string', 'State is a string')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - daemonState returns DaemonState enum', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    t.equal(daemon.daemonState, DaemonState.Ready, 'daemonState is Ready')

    await daemon.shutdown()
    t.equal(daemon.daemonState, DaemonState.Stopped, 'daemonState is Stopped')
    t.end()
  })

  tape('CoreDaemon - zmq getter returns null by default', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    t.equal(daemon.zmq, null, 'ZMQ is null by default')

    await daemon.shutdown()
    t.end()
  })

  // =========================================================================
  // Lifecycle Tests - startup()
  // =========================================================================

  tape('CoreDaemon - startup transitions through states', async (t) => {
    const daemon = create_mock_daemon()
    const states: DaemonState[] = []

    daemon.on('state:change', ({ to }) => {
      states.push(to)
    })

    await daemon.startup()

    t.ok(states.includes(DaemonState.Starting), 'Transitioned through Starting')
    t.ok(states.includes(DaemonState.ProcessRunning), 'Transitioned through ProcessRunning')
    t.ok(states.includes(DaemonState.Initializing), 'Transitioned through Initializing')
    t.ok(states.includes(DaemonState.Ready), 'Transitioned to Ready')
    t.equal(daemon.daemonState, DaemonState.Ready, 'Final state is Ready')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - startup returns client', async (t) => {
    const daemon = create_mock_daemon()

    const client = await daemon.startup()

    t.ok(client, 'Returns client')
    t.equal(client, daemon.client, 'Returns the daemon client')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - startup emits ready event', async (t) => {
    const daemon = create_mock_daemon()
    let readyEmitted = false
    let receivedClient: unknown

    daemon.on('ready', (client) => {
      readyEmitted = true
      receivedClient = client
    })

    await daemon.startup()

    t.ok(readyEmitted, 'ready event emitted')
    t.equal(receivedClient, daemon.client, 'ready event receives client')

    await daemon.shutdown()
    t.end()
  })

  // =========================================================================
  // Lifecycle Tests - shutdown()
  // =========================================================================

  tape('CoreDaemon - shutdown transitions to Stopped', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    await daemon.shutdown()

    t.equal(daemon.daemonState, DaemonState.Stopped, 'State is Stopped')
    t.notOk(daemon.isReady, 'Not ready after shutdown')
    t.end()
  })

  tape('CoreDaemon - shutdown emits shutdown event', async (t) => {
    const daemon = await MockDaemonFactory.ready()
    let shutdownEmitted = false

    daemon.on('shutdown', () => {
      shutdownEmitted = true
    })

    await daemon.shutdown()

    t.ok(shutdownEmitted, 'shutdown event emitted')
    t.end()
  })

  tape('CoreDaemon - shutdown is idempotent', async (t) => {
    const daemon = await MockDaemonFactory.ready()
    let shutdownCount = 0

    daemon.on('shutdown', () => {
      shutdownCount++
    })

    await daemon.shutdown()
    await daemon.shutdown()
    await daemon.shutdown()

    t.equal(shutdownCount, 1, 'shutdown event emitted only once')
    t.equal(daemon.daemonState, DaemonState.Stopped, 'State is still Stopped')
    t.end()
  })

  tape('CoreDaemon - shutdown from Created state requires _force_state', async (t) => {
    const daemon = create_mock_daemon()

    // In the mock, shutdown from Created isn't allowed via normal transitions
    // This matches the state machine design where Created -> ShuttingDown isn't valid
    // Use _force_state if you need to set Stopped from Created
    daemon._force_state(DaemonState.Stopped)

    t.equal(daemon.daemonState, DaemonState.Stopped, 'State is Stopped after force')
    t.end()
  })

  // =========================================================================
  // wait_for_ready Tests
  // =========================================================================

  tape('CoreDaemon - wait_for_ready resolves when already ready', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    await daemon.wait_for_ready(1000)
    t.pass('wait_for_ready resolved')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - wait_for_ready waits for startup', async (t) => {
    const daemon = create_mock_daemon()

    // Start startup in background
    setTimeout(() => daemon.startup(), 10)

    await daemon.wait_for_ready(1000)
    t.pass('wait_for_ready resolved after startup')
    t.equal(daemon.daemonState, DaemonState.Ready, 'Daemon is ready')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - wait_for_ready times out', async (t) => {
    const daemon = create_mock_daemon()

    try {
      await daemon.wait_for_ready(50)
      t.fail('Should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'Threw an error')
      t.ok((err as Error).message.includes('Timeout'), 'Error mentions timeout')
    }
    t.end()
  })

  // =========================================================================
  // run() Tests
  // =========================================================================

  tape('CoreDaemon - run executes methods sequentially', async (t) => {
    const daemon = await MockDaemonFactory.ready()
    const executed: number[] = []

    await daemon.run(
      async () => { executed.push(1) },
      async () => { executed.push(2) },
      async () => { executed.push(3) }
    )

    t.deepEqual(executed, [1, 2, 3], 'Methods executed in order')
    t.equal(daemon.daemonState, DaemonState.Stopped, 'Daemon stopped after run')
    t.end()
  })

  tape('CoreDaemon - run shuts down after completion', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    await daemon.run(async () => { /* no-op */ })

    t.equal(daemon.daemonState, DaemonState.Stopped, 'Daemon is stopped')
    t.end()
  })

  tape('CoreDaemon - run records call', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    await daemon.run(async () => { /* no-op */ })

    const runCalls = daemon._calls.filter(c => c.method === 'run')
    t.equal(runCalls.length, 1, 'run call recorded')
    t.end()
  })

  // =========================================================================
  // run_parallel() Tests
  // =========================================================================

  tape('CoreDaemon - run_parallel executes methods concurrently', async (t) => {
    const daemon = await MockDaemonFactory.ready()
    const executed: number[] = []
    const startTime = Date.now()

    // Each method takes 50ms
    const results = await daemon.run_parallel(
      async () => { await delay(50); executed.push(1) },
      async () => { await delay(50); executed.push(2) },
      async () => { await delay(50); executed.push(3) }
    )

    const elapsed = Date.now() - startTime

    // Should complete in ~50ms if parallel, ~150ms if sequential
    t.ok(elapsed < 120, 'Methods ran in parallel')
    t.equal(results.length, 3, 'All methods completed')
    t.ok(results.every(r => r.status === 'fulfilled'), 'All fulfilled')
    t.end()
  })

  tape('CoreDaemon - run_parallel returns PromiseSettledResult', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    const results = await daemon.run_parallel(
      async () => { /* success */ },
      async () => { throw new Error('Test error') }
    )

    t.equal(results.length, 2, 'Two results')
    t.equal(results[0].status, 'fulfilled', 'First fulfilled')
    t.equal(results[1].status, 'rejected', 'Second rejected')
    t.ok((results[1] as PromiseRejectedResult).reason instanceof Error, 'Rejected with error')
    t.end()
  })

  tape('CoreDaemon - run_parallel shuts down after completion', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    await daemon.run_parallel(async () => { /* no-op */ })

    t.equal(daemon.daemonState, DaemonState.Stopped, 'Daemon is stopped')
    t.end()
  })

  // =========================================================================
  // Static Methods Tests
  // =========================================================================

  tape('CoreDaemon.exists - returns false in mock', async (t) => {
    const exists = await MockCoreDaemon.exists()

    t.equal(exists, false, 'Mock always returns false')
    t.end()
  })

  tape('CoreDaemon.exists - accepts process name', async (t) => {
    const exists = await MockCoreDaemon.exists('bitcoind')

    t.equal(exists, false, 'Mock returns false for specific process')
    t.end()
  })

  tape('CoreDaemon.spawn - creates and starts daemon', async (t) => {
    const daemon = await MockCoreDaemon.spawn()

    t.ok(daemon instanceof MockCoreDaemon, 'Returns MockCoreDaemon')
    t.equal(daemon.daemonState, DaemonState.Ready, 'Daemon is ready')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon.spawn - accepts config', async (t) => {
    const daemon = await MockCoreDaemon.spawn({ debug: true })

    t.equal(daemon.opt.debug, true, 'Config applied')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon.connect - creates and starts daemon', async (t) => {
    const daemon = await MockCoreDaemon.connect()

    t.ok(daemon instanceof MockCoreDaemon, 'Returns MockCoreDaemon')
    t.equal(daemon.daemonState, DaemonState.Ready, 'Daemon is ready')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon.auto - spawns daemon (mock)', async (t) => {
    // In mock, auto always spawns because exists returns false
    const daemon = await MockCoreDaemon.auto()

    t.ok(daemon instanceof MockCoreDaemon, 'Returns MockCoreDaemon')
    t.equal(daemon.daemonState, DaemonState.Ready, 'Daemon is ready')

    await daemon.shutdown()
    t.end()
  })

  // =========================================================================
  // Test Helper Methods
  // =========================================================================

  tape('CoreDaemon - _set_ready forces ready state', (t) => {
    const daemon = create_mock_daemon()

    daemon._set_ready()

    t.equal(daemon.daemonState, DaemonState.Ready, 'State is Ready')
    t.ok(daemon.isReady, 'isReady is true')
    t.end()
  })

  tape('CoreDaemon - _set_error sets error state', (t) => {
    const daemon = create_mock_daemon()
    const error = new Error('Test error')

    daemon._set_error(error)

    t.equal(daemon.daemonState, DaemonState.Error, 'State is Error')
    t.notOk(daemon.isReady, 'Not ready in error state')
    t.end()
  })

  tape('CoreDaemon - _force_state sets any state', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    daemon._force_state(DaemonState.Initializing)
    t.equal(daemon.daemonState, DaemonState.Initializing, 'Forced to Initializing')

    daemon._force_state(DaemonState.Error)
    t.equal(daemon.daemonState, DaemonState.Error, 'Forced to Error')

    t.end()
  })

  tape('CoreDaemon - _reset clears state', async (t) => {
    const daemon = await MockDaemonFactory.ready()

    await daemon.shutdown()
    daemon._reset()

    t.equal(daemon.daemonState, DaemonState.Created, 'State reset to Created')
    t.equal(daemon._calls.length, 0, 'Calls cleared')
    t.end()
  })

  tape('CoreDaemon - _set_zmq sets ZMQ instance', async (t) => {
    const daemon = await MockDaemonFactory.ready()
    const mockZmq = { topic: 'test' }

    daemon._set_zmq(mockZmq)

    t.equal(daemon.zmq, mockZmq, 'ZMQ instance set')

    await daemon.shutdown()
    t.end()
  })

  tape('CoreDaemon - _emit_zmq_event emits ZMQ events', async (t) => {
    const daemon = await MockDaemonFactory.ready()
    let eventReceived = false
    let eventData: unknown

    daemon.on('zmq:block', (data) => {
      eventReceived = true
      eventData = data
    })

    daemon._emit_zmq_event('block', { hash: 'abc123' })

    t.ok(eventReceived, 'ZMQ event received')
    t.deepEqual(eventData, { hash: 'abc123' }, 'Event data correct')

    await daemon.shutdown()
    t.end()
  })

  // =========================================================================
  // Event Emission Tests
  // =========================================================================

  tape('CoreDaemon - emits state:change events', async (t) => {
    const daemon = create_mock_daemon()
    const changes: Array<{ from: DaemonState; to: DaemonState }> = []

    daemon.on('state:change', (event) => {
      changes.push({ from: event.from, to: event.to })
    })

    await daemon.startup()

    t.ok(changes.length >= 4, 'Multiple state changes during startup')
    t.ok(changes.some(c => c.to === DaemonState.Ready), 'Reached Ready state')

    await daemon.shutdown()
    t.ok(changes.some(c => c.to === DaemonState.Stopped), 'Reached Stopped state')
    t.end()
  })

  tape('CoreDaemon - emits state:error on error', (t) => {
    const daemon = create_mock_daemon()
    let errorEmitted = false
    let receivedError: Error | undefined

    daemon.on('state:error', (error) => {
      errorEmitted = true
      receivedError = error
    })

    const testError = new Error('Test error')
    daemon._set_error(testError)

    t.ok(errorEmitted, 'state:error emitted')
    t.equal(receivedError, testError, 'Received the error')
    t.end()
  })
}

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
