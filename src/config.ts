// External dependencies
import { resolve, join, normalize } from 'node:path'
import { homedir }                   from 'node:os'

// Internal modules
import { ConfigError }                        from '@/class/errors.js'
import { NETWORK_ALIASES, DEFAULT_TIMEOUT_MS } from '@/const.js'
import { init_debug }                         from '@/util/debug.js'

// Type imports
import type { CmdConfig, CoreConfig, NetworkName } from '@/types/config.js'

/**
 * Default core configuration values
 */
export const CORE_DEFAULTS: CoreConfig = {
  debug: false,
  init_delay: 0,
  isolated: false,
  network: 'regtest',
  safemode: true,
  no_spawn: false,
  timeout: DEFAULT_TIMEOUT_MS,
  verbose: true,
  params: [],
  core_params: [],
  cli_params: []
}

/**
 * Default command configuration values
 */
export const CMD_DEFAULTS: CmdConfig = {
  params: []
}

/**
 * Characters that are dangerous in paths (shell metacharacters)
 */
const DANGEROUS_PATH_CHARS = /[;&|`$(){}[\]<>!\\*?\n\r\t]/

/**
 * Resolve a path, expanding ~ and making it absolute
 *
 * Security checks:
 * - Rejects shell metacharacters
 * - Normalizes path to prevent traversal after resolution
 *
 * @param path - Path string to resolve
 * @returns Resolved absolute path or undefined
 * @throws ConfigError if path contains dangerous characters
 */
export function resolve_path(path?: string): string | undefined {
  if (!path) return undefined

  // Check for dangerous characters that could cause issues
  // Note: We allow quotes (') and (") as they may be in valid Windows paths
  // We also allow backslash on Windows
  const dangerousChars = process.platform === 'win32'
    ? /[;&|`$(){}[\]<>!\n\r\t]/
    : DANGEROUS_PATH_CHARS

  if (dangerousChars.test(path)) {
    throw new ConfigError(
      'Path contains invalid characters',
      'path',
      path
    )
  }

  // Expand ~ to home directory
  if (path.startsWith('~')) {
    path = join(homedir(), path.slice(1))
  }

  // Expand environment variables (Windows)
  if (process.platform === 'win32') {
    path = path.replace(/%([^%]+)%/g, (_, key) => process.env[key] ?? '')
  }

  // Make absolute if relative
  if (!path.startsWith('/') && !path.match(/^[A-Z]:\\/i)) {
    path = resolve(process.cwd(), path)
  }

  // Normalize to resolve any remaining . or .. segments
  // This is safe because we've already made the path absolute
  path = normalize(path)

  return path
}

/**
 * Normalize a network name string to the canonical form
 */
export function normalize_network(network: string): NetworkName {
  const normalized = NETWORK_ALIASES[network.toLowerCase()]
  if (!normalized) {
    throw new Error(
      `Unknown network: "${network}". Valid networks: main, test, signet, regtest`
    )
  }
  return normalized
}

/**
 * Create a complete CoreConfig from partial options
 */
export function core_config(
  config: Partial<CoreConfig> = {}
): CoreConfig {
  const { confpath, corepath, clipath, datapath, cookiepath } = config

  // Resolve all paths
  config.confpath = resolve_path(confpath)
  config.corepath = resolve_path(corepath)
  config.clipath = resolve_path(clipath)
  config.datapath = resolve_path(datapath)
  config.cookiepath = resolve_path(cookiepath)

  // Merge with defaults
  const merged = { ...CORE_DEFAULTS, ...config }

  // Initialize debug settings based on config
  init_debug(merged)

  // Normalize network name if provided as a string alias
  if (typeof merged.network === 'string') {
    try {
      merged.network = normalize_network(merged.network)
    } catch {
      // Keep the original value if normalization fails
      // This allows backward compatibility with custom networks
    }
  }

  return merged
}

/**
 * Create a complete CmdConfig from partial options
 */
export function cmd_config(
  config: Partial<CmdConfig> = {}
): CmdConfig {
  return { ...CMD_DEFAULTS, ...config }
}
