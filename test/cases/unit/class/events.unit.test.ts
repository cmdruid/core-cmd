/**
 * Unit tests for Event Bus implementations
 *
 * Tests both PollEventBus and ZMQEventBus, plus the event bus factory.
 */

import type { TestFunction as TapeTest } from 'tape'
import type { MockTestContext } from '../../../lib/types/test.types.js'
import { PollEventBus } from '../../../../src/class/poll.js'
import { ZMQEventBus, is_zmq_available, ZMQTopic } from '../../../../src/class/zmq.js'
import { createEventBus } from '../../../../src/class/events.js'
import type { CoreConfig } from '../../../../src/types/config.js'
import { create_mock_client } from '../../../lib/mocks/client.mock.js'

// ============================================================================
// Test Fixtures
// ============================================================================

function create_test_config(overrides: Partial<CoreConfig> = {}): CoreConfig {
  return {
    network          : 'regtest',
    isolated         : true,
    timeout          : 30000,
    init_delay       : 0,
    debug            : false,
    verbose          : false,
    use_cache        : false,
    safemode         : false,
    no_spawn         : false,
    params           : [],
    core_params      : [],
    cli_params       : [],
    ...overrides
  }
}

// ============================================================================
// PollEventBus Tests
// ============================================================================

export default function events_unit_tests(
  tape: TapeTest,
  _ctx: MockTestContext
): void {

  // ==========================================================================
  // PollEventBus Constructor Tests
  // ==========================================================================

  tape('PollEventBus - constructor with default config', (t) => {
    const client = create_mock_client()
    const poll = new PollEventBus(client as any)

    t.equal(poll.interval, 1000, 'default interval is 1000ms')
    t.equal(poll.is_connected(), false, 'not connected initially')

    t.end()
  })

  tape('PollEventBus - constructor with custom interval', (t) => {
    const client = create_mock_client()
    const poll = new PollEventBus(client as any, { interval: 500 })

    t.equal(poll.interval, 500, 'custom interval is respected')

    t.end()
  })

  tape('PollEventBus - constructor with all options', (t) => {
    const client = create_mock_client()
    const poll = new PollEventBus(client as any, {
      interval      : 2000,
      poll_blocks   : true,
      poll_mempool  : false
    })

    t.equal(poll.interval, 2000, 'interval is set')
    t.equal(poll.is_connected(), false, 'not connected initially')

    t.end()
  })

  // ==========================================================================
  // PollEventBus Lifecycle Tests
  // ==========================================================================

  tape('PollEventBus - start/stop lifecycle', async (t) => {
    const client = create_mock_client()
    const poll = new PollEventBus(client as any, { interval: 100 })

    t.equal(poll.is_connected(), false, 'not connected before start')

    await poll.start()
    t.equal(poll.is_connected(), true, 'connected after start')

    await poll.stop()
    t.equal(poll.is_connected(), false, 'not connected after stop')

    t.end()
  })

  tape('PollEventBus - double start is idempotent', async (t) => {
    const client = create_mock_client()
    const poll = new PollEventBus(client as any, { interval: 100 })

    await poll.start()
    await poll.start()  // Second call should be no-op

    t.equal(poll.is_connected(), true, 'still connected')

    await poll.stop()
    t.end()
  })

  tape('PollEventBus - double stop is idempotent', async (t) => {
    const client = create_mock_client()
    const poll = new PollEventBus(client as any, { interval: 100 })

    await poll.start()
    await poll.stop()
    await poll.stop()  // Second call should be no-op

    t.equal(poll.is_connected(), false, 'still disconnected')

    t.end()
  })

  // ==========================================================================
  // PollEventBus Event Tests
  // ==========================================================================

  tape('PollEventBus - emits started event', async (t) => {
    const client = create_mock_client()
    const poll = new PollEventBus(client as any, { interval: 100 })

    let startedEmitted = false
    poll.on('started', () => { startedEmitted = true })

    await poll.start()
    t.equal(startedEmitted, true, 'started event emitted')

    await poll.stop()
    t.end()
  })

  tape('PollEventBus - emits stopped event', async (t) => {
    const client = create_mock_client()
    const poll = new PollEventBus(client as any, { interval: 100 })

    let stoppedEmitted = false
    poll.on('stopped', () => { stoppedEmitted = true })

    await poll.start()
    await poll.stop()

    t.equal(stoppedEmitted, true, 'stopped event emitted')

    t.end()
  })

  // ==========================================================================
  // ZMQEventBus Tests
  // ==========================================================================

  tape('ZMQEventBus - constructor with default config', (t) => {
    const config = create_test_config()
    const zmq = new ZMQEventBus(config)

    t.equal(zmq.is_connected(), false, 'not connected initially')
    t.ok(zmq.get_topics().length > 0, 'has default topics')
    t.ok(zmq.get_topics().includes(ZMQTopic.HashBlock), 'includes hashblock topic')
    t.ok(zmq.get_topics().includes(ZMQTopic.HashTx), 'includes hashtx topic')

    t.end()
  })

  tape('ZMQEventBus - constructor with custom config', (t) => {
    const config = create_test_config({
      zmq_host   : 'tcp://192.168.1.1',
      zmq_port   : 29000,
      zmq_topics : [ZMQTopic.RawBlock, ZMQTopic.Sequence]
    })
    const zmq = new ZMQEventBus(config)

    const topics = zmq.get_topics()
    t.ok(topics.includes(ZMQTopic.RawBlock), 'includes rawblock')
    t.ok(topics.includes(ZMQTopic.Sequence), 'includes sequence')
    t.notOk(topics.includes(ZMQTopic.HashBlock), 'does not include hashblock')

    t.end()
  })

  tape('ZMQEventBus - subscribe/unsubscribe', (t) => {
    const config = create_test_config()
    const zmq = new ZMQEventBus(config)

    // Initially has default topics
    const initialTopics = zmq.get_topics()

    // Subscribe to new topic
    zmq.subscribe(ZMQTopic.Sequence)
    t.ok(zmq.get_topics().includes(ZMQTopic.Sequence), 'sequence topic added')

    // Unsubscribe
    zmq.unsubscribe(ZMQTopic.Sequence)
    t.notOk(zmq.get_topics().includes(ZMQTopic.Sequence), 'sequence topic removed')

    t.end()
  })

  tape('ZMQEventBus - connect fails without zeromq package', async (t) => {
    // This test verifies the error handling when zeromq is not installed
    const zmqAvailable = await is_zmq_available()

    if (zmqAvailable) {
      t.skip('zeromq is installed, skipping error test')
      t.end()
      return
    }

    const config = create_test_config({ zmq_enabled: true })
    const zmq = new ZMQEventBus(config)

    try {
      await zmq.connect()
      t.fail('should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'threw Error')
      t.ok((err as Error).message.includes('zeromq'), 'error mentions zeromq')
    }

    t.end()
  })

  // ==========================================================================
  // is_zmq_available Tests
  // ==========================================================================

  tape('is_zmq_available - returns boolean', async (t) => {
    const result = await is_zmq_available()

    t.ok(typeof result === 'boolean', 'returns boolean')
    // We don't assert the specific value since it depends on environment

    t.end()
  })

  // ==========================================================================
  // Event Bus Factory Tests
  // ==========================================================================

  tape('createEventBus - returns null when events_enabled=false', async (t) => {
    const client = create_mock_client()
    const config = create_test_config({ events_enabled: false })

    const result = await createEventBus(client as any, config)

    t.equal(result.type, 'none', 'type is none')
    t.equal(result.bus, null, 'bus is null')

    t.end()
  })

  tape('createEventBus - returns poll bus by default', async (t) => {
    const client = create_mock_client()
    const config = create_test_config()

    // Don't enable ZMQ, so it should fall back to polling
    const result = await createEventBus(client as any, config)

    t.equal(result.type, 'poll', 'type is poll')
    t.ok(result.bus, 'bus is not null')
    t.ok(result.bus?.is_connected !== undefined, 'bus has is_connected method')

    t.end()
  })

  tape('createEventBus - returns null when polling_enabled=false and no zmq', async (t) => {
    const client = create_mock_client()
    const config = create_test_config({
      polling_enabled: false,
      zmq_enabled: false
    })

    const result = await createEventBus(client as any, config)

    t.equal(result.type, 'none', 'type is none')
    t.equal(result.bus, null, 'bus is null')

    t.end()
  })

  tape('createEventBus - uses custom poll interval', async (t) => {
    const client = create_mock_client()
    const config = create_test_config({
      events_poll_interval: 2000
    })

    const result = await createEventBus(client as any, config)

    t.equal(result.type, 'poll', 'type is poll')

    // Check the interval via the PollEventBus
    const poll = result.bus as unknown as PollEventBus
    t.equal(poll.interval, 2000, 'custom interval is set')

    t.end()
  })

  tape('createEventBus - prefers ZMQ when available and enabled', async (t) => {
    const zmqAvailable = await is_zmq_available()

    if (!zmqAvailable) {
      t.skip('zeromq not installed, skipping ZMQ preference test')
      t.end()
      return
    }

    const client = create_mock_client()
    const config = create_test_config({
      zmq_enabled: true
    })

    const result = await createEventBus(client as any, config)

    t.equal(result.type, 'zmq', 'type is zmq when available')
    t.ok(result.bus, 'bus is not null')

    t.end()
  })

  // ==========================================================================
  // Event Interface Tests
  // ==========================================================================

  tape('PollEventBus - implements common event interface', (t) => {
    const client = create_mock_client()
    const poll = new PollEventBus(client as any)

    // Check that all required methods exist
    t.ok(typeof poll.on === 'function', 'has on method')
    t.ok(typeof poll.is_connected === 'function', 'has is_connected method')
    t.ok(typeof poll.start === 'function', 'has start method')
    t.ok(typeof poll.stop === 'function', 'has stop method')

    t.end()
  })

  tape('ZMQEventBus - implements common event interface', (t) => {
    const config = create_test_config()
    const zmq = new ZMQEventBus(config)

    // Check that all required methods exist
    t.ok(typeof zmq.on === 'function', 'has on method')
    t.ok(typeof zmq.is_connected === 'function', 'has is_connected method')
    t.ok(typeof zmq.connect === 'function', 'has connect method')
    t.ok(typeof zmq.disconnect === 'function', 'has disconnect method')

    t.end()
  })

  // ==========================================================================
  // ZMQTopic Enum Tests
  // ==========================================================================

  tape('ZMQTopic - has expected values', (t) => {
    t.equal(ZMQTopic.RawTx, 'rawtx', 'RawTx value')
    t.equal(ZMQTopic.HashTx, 'hashtx', 'HashTx value')
    t.equal(ZMQTopic.RawBlock, 'rawblock', 'RawBlock value')
    t.equal(ZMQTopic.HashBlock, 'hashblock', 'HashBlock value')
    t.equal(ZMQTopic.Sequence, 'sequence', 'Sequence value')

    t.end()
  })
}
