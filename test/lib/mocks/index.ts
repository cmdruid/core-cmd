/**
 * Mock implementations barrel export
 */

// Client mock
export {
  MockCoreClient,
  create_mock_client,
  type MockClientConfig,
  type RecordedCall
} from './client.mock.js'

// Wallet mock
export {
  MockCoreWallet,
  create_mock_wallet,
  create_mock_faucet,
  type MockWalletConfig,
  type MockUTXOData
} from './wallet.mock.js'

// Daemon mock
export {
  MockCoreDaemon,
  MockDaemonFactory,
  create_mock_daemon,
  type MockDaemonConfig
} from './daemon.mock.js'

// State machine mock
export {
  MockStateMachine,
  create_mock_state_machine,
  verify_state_sequence,
  get_visited_states,
  STATE_SEQUENCES,
  type StateChangeEvent
} from './state.mock.js'

// Process controller mock
export {
  MockProcessController,
  ProcessState,
  create_mock_process_controller,
  create_running_process_controller,
  type MockProcessControllerConfig
} from './process.mock.js'

// ZMQ mock
export {
  MockZMQEventBus,
  create_mock_zmq,
  create_connected_zmq,
  type MockZMQConfig,
  type MockZMQEvent,
  type BlockEvent,
  type TransactionEvent,
  type SequenceEvent
} from './zmq.mock.js'
