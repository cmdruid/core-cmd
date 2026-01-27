/**
 * Mock configuration types for core-cmd test framework
 */

import type { CoreConfig, UTXO, DaemonState } from '../../../src/index.js'

// ============================================================================
// Mock Client Types
// ============================================================================

/**
 * Configuration for MockCoreClient
 */
export interface MockClientConfig {
  /** Pre-configured RPC responses by method name */
  responses?       : Record<string, unknown>
  /** Methods that should throw errors */
  error_methods?   : Record<string, Error>
  /** Artificial delay in milliseconds for responses */
  response_delay?  : number
  /** Whether to record calls for verification */
  record_calls?    : boolean
  /** Network type */
  network?         : string
}

/**
 * Recorded method call for verification
 */
export interface RecordedCall {
  /** Method name */
  method    : string
  /** Arguments passed */
  args      : unknown[]
  /** Timestamp of call */
  timestamp : Date
  /** Result if successful */
  result?   : unknown
  /** Error if failed */
  error?    : Error
}

// ============================================================================
// Mock Wallet Types
// ============================================================================

/**
 * Configuration for MockCoreWallet
 */
export interface MockWalletConfig {
  /** Wallet label/name */
  label    : string
  /** Initial balance in satoshis */
  balance? : number
  /** Initial UTXOs */
  utxos?   : MockUTXOData[]
  /** Network type */
  network? : string
}

/**
 * Simplified UTXO data for mocks
 */
export interface MockUTXOData {
  txid          : string
  vout          : number
  sats          : number
  confirmations?: number
  address?      : string
  scriptPubKey? : string
}

// ============================================================================
// Mock Daemon Types
// ============================================================================

/**
 * Configuration for MockCoreDaemon
 */
export interface MockDaemonConfig {
  /** Core configuration overrides */
  core_config?    : Partial<CoreConfig>
  /** Client configuration */
  client_config?  : MockClientConfig
  /** Faucet wallet initial balance */
  faucet_balance? : number
  /** Skip initialization sequence */
  skip_init?      : boolean
  /** Initial state */
  initial_state?  : DaemonState
}

// ============================================================================
// Mock State Machine Types
// ============================================================================

/**
 * Configuration for MockStateMachine
 */
export interface MockStateMachineConfig {
  /** Initial state */
  initial_state?   : DaemonState
  /** Record state history */
  record_history?  : boolean
  /** Emit events on transitions */
  emit_events?     : boolean
}

/**
 * State transition record
 */
export interface StateTransitionRecord {
  from      : DaemonState
  to        : DaemonState
  timestamp : Date
  error?    : Error
}

// ============================================================================
// Mock Process Controller Types
// ============================================================================

/**
 * Configuration for MockProcessController
 */
export interface MockProcessControllerConfig {
  /** Initial process state */
  initial_state?  : 'Uninitialized' | 'Running' | 'Connected' | 'Stopped'
  /** Simulated startup delay */
  startup_delay?  : number
  /** Simulated shutdown delay */
  shutdown_delay? : number
  /** Should start fail */
  fail_start?     : boolean
  /** Should cleanup fail */
  fail_cleanup?   : boolean
}

// ============================================================================
// Mock ZMQ Types
// ============================================================================

/**
 * Configuration for MockZMQEventBus
 */
export interface MockZMQConfig {
  /** Whether connected */
  connected? : boolean
  /** Topics to subscribe */
  topics?    : string[]
}

/**
 * Simulated ZMQ event
 */
export interface MockZMQEvent {
  topic    : string
  message  : unknown
  sequence : number
}

// ============================================================================
// Call Recording Types
// ============================================================================

/**
 * Call recorder for tracking method invocations
 */
export interface CallRecorder {
  /** All recorded calls */
  calls      : RecordedCall[]
  /** Get calls for specific method */
  get_calls  : (method: string) => RecordedCall[]
  /** Check if method was called */
  was_called : (method: string) => boolean
  /** Get call count for method */
  call_count : (method: string) => number
  /** Clear all recorded calls */
  clear      : () => void
  /** Get last call for method */
  last_call  : (method: string) => RecordedCall | undefined
}

/**
 * Create a call recorder
 */
export function create_call_recorder(): CallRecorder {
  const calls: RecordedCall[] = []

  return {
    calls,
    get_calls: (method: string) => calls.filter(c => c.method === method),
    was_called: (method: string) => calls.some(c => c.method === method),
    call_count: (method: string) => calls.filter(c => c.method === method).length,
    clear: () => { calls.length = 0 },
    last_call: (method: string) => {
      const methodCalls = calls.filter(c => c.method === method)
      return methodCalls[methodCalls.length - 1]
    }
  }
}
