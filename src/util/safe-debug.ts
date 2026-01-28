/**
 * Safe debug logging with automatic credential sanitization
 *
 * This module wraps the debug logger to automatically sanitize
 * sensitive data like credentials, private keys, and tokens
 * before logging.
 */

// Internal modules
import { create_core_debug, DebugFn } from '@/util/debug.js'
import { sanitize_for_log }           from '@/lib/validation.js'

/**
 * Safe debug function type
 */
export type SafeDebugFn = DebugFn

/**
 * Create a safe debugger that auto-sanitizes log output
 *
 * @param module - The module name for the debug namespace
 * @returns Debug function that sanitizes sensitive data
 *
 * @example
 * const debug = create_safe_debug('client')
 * debug('params: %s', params.join(' '))  // Credentials auto-redacted
 */
export function create_safe_debug(module: string): SafeDebugFn {
  const baseDebug = create_core_debug(module)

  // Return a wrapper that sanitizes all string arguments
  const safeDebug = (format: string, ...args: unknown[]) => {
    const sanitizedFormat = sanitize_for_log(format)
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        return sanitize_for_log(arg)
      }
      // For objects/arrays, convert to string and sanitize
      if (typeof arg === 'object' && arg !== null) {
        try {
          const str = JSON.stringify(arg)
          return sanitize_for_log(str)
        } catch {
          return arg
        }
      }
      return arg
    })
    baseDebug(sanitizedFormat, ...sanitizedArgs)
  }

  // Copy over any properties from the original debug function
  // (like .enabled, .namespace, etc.)
  Object.assign(safeDebug, baseDebug)

  return safeDebug as SafeDebugFn
}

/**
 * Sanitize parameters array for safe logging
 * Useful when you need to log CLI params that might contain credentials
 *
 * @param params - Array of command-line parameters
 * @returns Sanitized string representation
 */
export function safe_params_string(params: string[]): string {
  return params.map(sanitize_for_log).join(' ')
}
