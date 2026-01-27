// Main classes exported directly (OOP convention)
export { CoreDaemon } from './class/core.js'
export { CoreClient } from './class/client.js'
export { CoreWallet } from './class/wallet.js'
export { SigningContext } from './class/signing.js'

// Process management
export { ProcessState, SpawnedProcess, ConnectedProcess, ManagedProcess } from './class/process.js'
export type { ProcessController } from './class/process.js'

// State machine
export { DaemonState, DaemonStateMachine } from './class/state.js'
export type { StateChangeEvent, StateMachineEvents } from './class/state.js'

// Error classes
export {
  CoreError,
  ProcessError,
  CommandError,
  ConnectionError,
  RPCError,
  WalletError,
  ConfigError,
  NetworkError
} from './class/errors.js'

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
} from './class/zmq.js'

// Polling event bus
export {
  PollEventBus,
  create_poll_event_bus,
  type PollConfig,
  type PollEvents
} from './class/poll.js'

// Event bus factory
export {
  createEventBus,
  startEventBus,
  stopEventBus,
  type EventBus,
  type EventBusType,
  type EventBusResult
} from './class/events.js'

// Descriptors
export { parse_descriptor, parse_segment } from './lib/descriptors.js'

// Utilities use namespace pattern
export * as CONST from './const.js'
export * as ERRORS from './class/errors.js'

// Constants (individual exports for backwards compat)
export {
  SATS_PER_BTC,
  SAT_MULTI,
  DUST_LIMIT,
  DUST_LIMIT_SATS,
  MIN_TX_FEE,
  MIN_RELAY_FEE_SATS,
  FALLBACK_FEE,
  REGTEST_BLOCK_SUBSIDY_SATS,
  REGTEST_INITIAL_BLOCKS,
  FAUCET_MIN_BAL,
  INIT_BLOCK_CT,
  RATE_LIMIT,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_STARTUP_TIMEOUT_MS,
  DEFAULT_HEALTH_CHECK_INTERVAL_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  PORT_RANGE_MIN,
  PORT_RANGE_MAX,
  randomPort,
  RANDOM_PORT,
  RANDOM_SORT,
  NETWORK_ALIASES,
  DEFAULT_PATHS,
  // Transaction sizing
  TXIN_SIZE,
  WIT_VSIZE,
  TXO_SIZE,
  // BIP32/Crypto
  BIP32_HARDENED_FLAG,
  RBF_SEQUENCE,
  TAPROOT_VERSION,
  TESTNET_VERSIONS,
  MAINNET_VERSIONS,
  // Process management
  LOG_BUFFER_MAX_LINES,
  DEFAULT_SPAWN_TIMEOUT_MS,
  HEALTH_CHECK_STALE_MS,
  ERROR_PATTERNS,
  WARNING_PATTERNS
} from './const.js'
export type { NetworkName } from './const.js'

// Configuration helpers
export {
  core_config,
  cmd_config,
  resolve_path,
  normalize_network,
  CORE_DEFAULTS,
  CMD_DEFAULTS
} from './config.js'

// All types
export type * from './types/index.js'
