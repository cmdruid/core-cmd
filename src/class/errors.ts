/**
 * Custom error classes for Bitcoin Core operations
 */

export class CoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoreError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ProcessError extends CoreError {
  readonly pid?: number
  readonly exit_code?: number
  readonly signal?: string

  constructor(message: string, pid?: number, exit_code?: number, signal?: string) {
    super(message)
    this.name = 'ProcessError'
    this.pid = pid
    this.exit_code = exit_code
    this.signal = signal
  }
}

export class CommandError extends CoreError {
  readonly command: string
  readonly stdout: string
  readonly stderr: string
  readonly code?: number

  constructor(message: string, command: string, stdout: string, stderr: string, code?: number) {
    super(message)
    this.name = 'CommandError'
    this.command = command
    this.stdout = stdout
    this.stderr = stderr
    this.code = code
  }
}

export class ConnectionError extends CoreError {
  readonly host?: string
  readonly port?: number
  readonly timeout?: number

  constructor(message: string, host?: string, port?: number, timeout?: number) {
    super(message)
    this.name = 'ConnectionError'
    this.host = host
    this.port = port
    this.timeout = timeout
  }
}

export class RPCError extends CoreError {
  readonly method: string
  readonly params?: any
  readonly rpc_code?: number
  readonly rpc_message?: string

  constructor(message: string, method: string, params?: any, rpc_code?: number, rpc_message?: string) {
    super(message)
    this.name = 'RPCError'
    this.method = method
    this.params = params
    this.rpc_code = rpc_code
    this.rpc_message = rpc_message
  }
}

export class WalletError extends CoreError {
  readonly wallet_name?: string
  readonly operation?: string

  constructor(message: string, wallet_name?: string, operation?: string) {
    super(message)
    this.name = 'WalletError'
    this.wallet_name = wallet_name
    this.operation = operation
  }
}

export class ConfigError extends CoreError {
  readonly config_key?: string
  readonly config_value?: any

  constructor(message: string, config_key?: string, config_value?: any) {
    super(message)
    this.name = 'ConfigError'
    this.config_key = config_key
    this.config_value = config_value
  }
}

export class NetworkError extends CoreError {
  readonly network?: string
  readonly expected?: string

  constructor(message: string, network?: string, expected?: string) {
    super(message)
    this.name = 'NetworkError'
    this.network = network
    this.expected = expected
  }
}

/**
 * Helper function to create CommandError from common RPC failures
 */
export function create_command_error(
  stdout: string,
  stderr: string,
  command: string,
  code?: number
): CommandError {
  let message = `Command failed with exit code ${code}`

  // Parse common Bitcoin Core RPC errors
  if (stderr.includes('error: Could not connect')) {
    message = 'Bitcoin Core is not responding. Is it running? Check your RPC settings.'
  } else if (stderr.includes('error: Incorrect rpcuser or rpcpassword')) {
    message = 'RPC authentication failed. Check your rpcuser and rpcpassword.'
  } else if (stderr.includes('error code: -28')) {
    message = 'Bitcoin Core is still starting up. Please wait and try again.'
  } else if (stderr.includes('error code: -18')) {
    message = 'Wallet not found. Make sure the wallet is loaded.'
  } else if (stderr.includes('error code: -4')) {
    message = 'Wallet error. The wallet may be locked or corrupted.'
  } else if (stderr.includes('error code: -5')) {
    message = 'Invalid address or key.'
  } else if (stderr.includes('error code: -6')) {
    message = 'Insufficient funds.'
  } else if (stderr.includes('error code: -26')) {
    message = 'Transaction rejected. Fee may be too low.'
  }

  return new CommandError(message, command, stdout, stderr, code)
}
