import { AddressType } from './address.js'

/**
 * Network type for Bitcoin Core
 */
export type NetworkName = 'main' | 'test' | 'signet' | 'regtest'

/**
 * Client configuration (alias for CoreConfig)
 */
export type ClientConfig = CoreConfig

/**
 * Core daemon configuration
 */
export interface CoreConfig {
  // Binary paths
  /** Path to bitcoind binary */
  corepath?: string
  /** Path to bitcoin-cli binary */
  clipath?: string

  // Data paths
  /** Path to blockchain data directory */
  datapath?: string
  /** Path to bitcoin.conf file */
  confpath?: string
  /** Path to RPC cookie file */
  cookiepath?: string

  // Network settings
  /** Bitcoin network to use */
  network: NetworkName | string
  /** Use random ports to avoid conflicts (for testing) */
  isolated: boolean

  // RPC connection
  /** RPC host address */
  rpc_host?: string
  /** RPC port number */
  rpc_port?: number
  /** RPC username */
  rpc_user?: string
  /** RPC password */
  rpc_pass?: string

  // P2P connection
  /** P2P port number */
  peer_port?: number

  // Process management
  /** Process startup timeout in milliseconds */
  timeout: number
  /** Graceful shutdown timeout in milliseconds */
  shutdown_timeout?: number
  /** Delay before initialization (seconds) */
  init_delay: number

  // Behavior flags
  /** Enable debug output */
  debug: boolean
  /** Enable verbose logging */
  verbose: boolean
  /** Enable cache for RPC calls */
  use_cache: boolean
  /** Catch uncaught exceptions and shutdown daemon */
  safemode: boolean
  /** Don't spawn a new process, connect to existing */
  no_spawn: boolean

  // Additional CLI parameters
  /** Common params for both daemon and CLI */
  params: string[]
  /** Params only for bitcoind */
  core_params: string[]
  /** Params only for bitcoin-cli */
  cli_params: string[]

  // Event bus configuration
  /** Enable event bus for real-time notifications (default: true) */
  events_enabled?: boolean
  /** Polling interval in milliseconds for fallback event bus (default: 1000) */
  events_poll_interval?: number
  /** Enable polling fallback when ZMQ unavailable (default: true) */
  polling_enabled?: boolean

  // ZMQ configuration
  /** Enable ZMQ event bus */
  zmq_enabled?: boolean
  /** ZMQ host (e.g., 'tcp://127.0.0.1') */
  zmq_host?: string
  /** ZMQ port number */
  zmq_port?: number
  /** ZMQ topics to subscribe to */
  zmq_topics?: string[]
}

/**
 * Address generation configuration
 */
export interface AddressConfig {
  /** Label for the address */
  label?: string
  /** Type of address to generate */
  address_type?: AddressType
}

/**
 * Command execution configuration
 */
export interface CmdConfig {
  /** Whether to use cached result */
  cache: boolean
  /** Additional CLI parameters */
  params: string[]
}
