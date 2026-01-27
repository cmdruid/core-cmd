// Core classes
export { CoreDaemon } from './core.js'
export { CoreClient } from './client.js'
export { CoreWallet } from './wallet.js'

// Process management
export {
  ProcessState,
  SpawnedProcess,
  ConnectedProcess,
  ManagedProcess,
  type ProcessController
} from './process.js'

// State machine
export {
  DaemonState,
  DaemonStateMachine,
  type StateChangeEvent,
  type StateMachineEvents
} from './state.js'

// Error classes
export {
  CoreError,
  ProcessError,
  CommandError,
  ConnectionError,
  RPCError,
  WalletError,
  ConfigError,
  NetworkError,
  create_command_error
} from './errors.js'

// ZMQ event bus
export {
  ZMQEventBus,
  ZMQTopic,
  is_zmq_available,
  type ZMQConfig,
  type ZMQMessage,
  type ZMQEvents,
  type BlockEvent,
  type TransactionEvent,
  type SequenceEvent
} from './zmq.js'

// Polling event bus
export {
  PollEventBus,
  create_poll_event_bus,
  type PollConfig,
  type PollEvents
} from './poll.js'

// Event bus factory
export {
  createEventBus,
  startEventBus,
  stopEventBus,
  type EventBus,
  type EventBusType,
  type EventBusResult
} from './events.js'

// Signing context
export { SigningContext } from './signing.js'
