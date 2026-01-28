// Core classes
export { CoreDaemon } from '@/class/core.js'
export { CoreClient } from '@/class/client.js'
export { CoreWallet } from '@/class/wallet.js'

// Process management
export {
  ProcessState,
  SpawnedProcess,
  ConnectedProcess,
  ManagedProcess,
  type ProcessController
} from '@/class/process.js'

// State machine
export {
  DaemonState,
  DaemonStateMachine,
  type StateChangeEvent,
  type StateMachineEvents
} from '@/class/state.js'

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
} from '@/class/errors.js'

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
} from '@/class/zmq.js'

// Polling event bus
export {
  PollEventBus,
  create_poll_event_bus,
  type PollConfig,
  type PollEvents
} from '@/class/poll.js'

// Event bus factory
export {
  createEventBus,
  startEventBus,
  stopEventBus,
  type EventBus,
  type EventBusType,
  type EventBusResult
} from '@/class/events.js'

// Wallet types
export type { KeyType, ExtractedKey, PsbtOptions, PsbtResult } from '@/class/wallet.js'
