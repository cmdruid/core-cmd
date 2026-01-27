/**
 * Configuration fixtures for testing
 */

import type { CoreConfig } from '../../../src/index.js'
import type { CoreConfigFixture } from '../types/fixture.types.js'

// ============================================================================
// Default Paths
// ============================================================================

const DEFAULT_PATHS = {
  darwin: {
    corepath : '/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoind',
    clipath  : '/Applications/Bitcoin-Qt.app/Contents/MacOS/bitcoin-cli',
    datapath : '~/Library/Application Support/Bitcoin'
  },
  linux: {
    corepath : '/usr/local/bin/bitcoind',
    clipath  : '/usr/local/bin/bitcoin-cli',
    datapath : '~/.bitcoin'
  },
  win32: {
    corepath : 'C:\\Program Files\\Bitcoin\\daemon\\bitcoind.exe',
    clipath  : 'C:\\Program Files\\Bitcoin\\daemon\\bitcoin-cli.exe',
    datapath : '%APPDATA%\\Bitcoin'
  }
}

// ============================================================================
// Core Config Fixtures
// ============================================================================

/**
 * Create a minimal test configuration
 */
export function create_test_config(): CoreConfigFixture {
  return {
    corepath : 'test/bin/bitcoind',
    clipath  : 'test/bin/bitcoin-cli',
    datapath : 'test/data',
    confpath : 'test/bitcoin.conf',
    network  : 'regtest',
    isolated : true,
    debug    : true,
    verbose  : true,
    timeout  : 30000
  }
}

/**
 * Create a CI-optimized configuration
 */
export function create_ci_config(): CoreConfigFixture {
  return {
    ...create_test_config(),
    debug   : false,
    verbose : false,
    timeout : 60000
  }
}

/**
 * Create a production-like configuration
 */
export function create_production_config(
  network: 'main' | 'testnet' | 'signet' = 'main'
): CoreConfigFixture {
  return {
    corepath : '/usr/local/bin/bitcoind',
    clipath  : '/usr/local/bin/bitcoin-cli',
    datapath : '~/.bitcoin',
    confpath : '~/.bitcoin/bitcoin.conf',
    network,
    isolated : false,
    debug    : false,
    verbose  : false,
    timeout  : 30000
  }
}

/**
 * Create a full CoreConfig with all options
 */
export function create_full_config(
  overrides: Partial<CoreConfig> = {}
): CoreConfig {
  return {
    // Paths
    corepath   : 'test/bin/bitcoind',
    clipath    : 'test/bin/bitcoin-cli',
    datapath   : 'test/data',
    confpath   : 'test/bitcoin.conf',
    cookiepath : undefined,

    // Network
    network  : 'regtest',
    isolated : true,

    // RPC
    rpc_host  : 'localhost',
    rpc_port  : 18443,
    rpc_user  : undefined,
    rpc_pass  : undefined,
    peer_port : undefined,

    // Timeouts
    timeout          : 30000,
    shutdown_timeout : 5000,
    init_delay       : 0,

    // Flags
    debug     : true,
    verbose   : true,
    use_cache : true,
    safemode  : true,
    no_spawn  : false,

    // Parameters
    params      : [],
    core_params : [],
    cli_params  : [],

    // ZMQ
    zmq_enabled : false,
    zmq_host    : 'localhost',
    zmq_port    : undefined,
    zmq_topics  : ['hashblock', 'hashtx', 'sequence'],

    ...overrides
  }
}

// ============================================================================
// Network-Specific Configs
// ============================================================================

/**
 * Create regtest configuration
 */
export function create_regtest_config(
  overrides: Partial<CoreConfig> = {}
): CoreConfig {
  return create_full_config({
    network  : 'regtest',
    rpc_port : 18443,
    isolated : true,
    ...overrides
  })
}

/**
 * Create testnet configuration
 */
export function create_testnet_config(
  overrides: Partial<CoreConfig> = {}
): CoreConfig {
  return create_full_config({
    network  : 'testnet',
    rpc_port : 18332,
    isolated : false,
    no_spawn : true,
    ...overrides
  })
}

/**
 * Create signet configuration
 */
export function create_signet_config(
  overrides: Partial<CoreConfig> = {}
): CoreConfig {
  return create_full_config({
    network  : 'signet',
    rpc_port : 38332,
    isolated : false,
    no_spawn : true,
    ...overrides
  })
}

/**
 * Create mainnet configuration
 */
export function create_mainnet_config(
  overrides: Partial<CoreConfig> = {}
): CoreConfig {
  return create_full_config({
    network  : 'main',
    rpc_port : 8332,
    isolated : false,
    no_spawn : true,
    safemode : true,
    ...overrides
  })
}

// ============================================================================
// Test Scenario Configs
// ============================================================================

/**
 * Create configuration for testing isolated mode
 */
export function create_isolated_test_config(): CoreConfig {
  return create_full_config({
    isolated : true,
    rpc_port : undefined,  // Will use random port
    peer_port: undefined   // Will use random port
  })
}

/**
 * Create configuration for testing RPC authentication
 */
export function create_auth_test_config(
  username : string = 'testuser',
  password : string = 'testpass'
): CoreConfig {
  return create_full_config({
    rpc_user : username,
    rpc_pass : password
  })
}

/**
 * Create configuration for testing ZMQ
 */
export function create_zmq_test_config(
  port   : number = 28332,
  topics : string[] = ['hashblock', 'hashtx', 'sequence']
): CoreConfig {
  return create_full_config({
    zmq_enabled : true,
    zmq_host    : 'localhost',
    zmq_port    : port,
    zmq_topics  : topics
  })
}

/**
 * Create configuration with custom parameters
 */
export function create_custom_params_config(
  params     : string[] = [],
  coreParams : string[] = [],
  cliParams  : string[] = []
): CoreConfig {
  return create_full_config({
    params      : params,
    core_params : coreParams,
    cli_params  : cliParams
  })
}

// ============================================================================
// Invalid Configs for Error Testing
// ============================================================================

/**
 * Create configurations that should fail validation
 */
export function create_invalid_configs(): Record<string, Partial<CoreConfig>> {
  return {
    // Missing required paths
    no_corepath: {
      clipath  : 'test/bin/bitcoin-cli',
      network  : 'regtest'
    },

    no_clipath: {
      corepath : 'test/bin/bitcoind',
      network  : 'regtest'
    },

    // Invalid network
    invalid_network: {
      corepath : 'test/bin/bitcoind',
      clipath  : 'test/bin/bitcoin-cli',
      network  : 'invalid' as any
    },

    // Invalid timeout
    negative_timeout: {
      corepath : 'test/bin/bitcoind',
      clipath  : 'test/bin/bitcoin-cli',
      timeout  : -1000
    },

    // Invalid port
    invalid_port: {
      corepath : 'test/bin/bitcoind',
      clipath  : 'test/bin/bitcoin-cli',
      rpc_port : 99999
    }
  }
}

// ============================================================================
// Platform-Specific Configs
// ============================================================================

/**
 * Get default paths for current platform
 */
export function get_platform_defaults(): {
  corepath : string
  clipath  : string
  datapath : string
} {
  const platform = process.platform as keyof typeof DEFAULT_PATHS
  return DEFAULT_PATHS[platform] ?? DEFAULT_PATHS.linux
}

/**
 * Create platform-specific configuration
 */
export function create_platform_config(
  overrides: Partial<CoreConfig> = {}
): CoreConfig {
  const defaults = get_platform_defaults()
  return create_full_config({
    ...defaults,
    ...overrides
  })
}

// ============================================================================
// Export Types
// ============================================================================

export type { CoreConfigFixture }
