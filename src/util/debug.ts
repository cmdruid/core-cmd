/**
 * Centralized debug factory for core-cmd
 *
 * All debug namespaces follow the pattern: core:<module>
 * - core:daemon   - CoreDaemon lifecycle
 * - core:client   - RPC operations
 * - core:wallet   - Wallet operations
 * - core:process  - Process management
 * - core:state    - State transitions
 * - core:zmq      - ZMQ event bus
 * - core:cmd      - Command execution
 * - core:config   - Configuration
 */

import { create_debugger, get_debug_logs, clear_logs } from '@vbyte/util/debug'

/** Debug function type from @vbyte/util */
export type DebugFn = ReturnType<typeof create_debugger>

/**
 * Create a debugger with the core-cmd namespace prefix
 * @param module - The module name (e.g., 'daemon', 'client', 'wallet')
 */
export function create_core_debug(module: string): DebugFn {
  return create_debugger(`core:${module}`)
}

/**
 * Initialize debug settings based on config
 * Call this early in the configuration phase
 * @param config - Configuration with debug/verbose flags
 */
export function init_debug(config: { debug?: boolean; verbose?: boolean }) {
  // Only set DEBUG if not already set by environment
  if (!process.env.DEBUG) {
    if (config.debug) {
      process.env.DEBUG = 'core:*'
    } else if (config.verbose) {
      process.env.DEBUG = 'core:daemon,core:state'
    }
  }
}

// Re-export utilities from @vbyte/util for convenience
export { get_debug_logs, clear_logs }
