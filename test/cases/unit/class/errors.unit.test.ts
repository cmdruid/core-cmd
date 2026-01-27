/**
 * Unit tests for error classes
 */

import type { TestFunction as TapeTest } from 'tape'
import type { MockTestContext } from '../../../lib/types/test.types.js'
import {
  CoreError,
  ProcessError,
  CommandError,
  ConnectionError,
  RPCError,
  WalletError,
  ConfigError,
  NetworkError
} from '../../../../src/index.js'

/**
 * Error classes unit tests
 */
export default function errors_unit_tests(
  tape: TapeTest,
  _ctx: MockTestContext
): void {
  tape('CoreError - base class', (t) => {
    const error = new CoreError('Test error')

    t.ok(error instanceof Error, 'Is an Error instance')
    t.ok(error instanceof CoreError, 'Is a CoreError instance')
    t.equal(error.message, 'Test error', 'Message is set')
    t.equal(error.name, 'CoreError', 'Name is CoreError')

    t.end()
  })

  tape('ProcessError - process failures', (t) => {
    const error = new ProcessError('Process failed', 12345, 1, 'SIGTERM')

    t.ok(error instanceof CoreError, 'Is a CoreError instance')
    t.ok(error instanceof ProcessError, 'Is a ProcessError instance')
    t.equal(error.message, 'Process failed', 'Message is set')
    t.equal(error.name, 'ProcessError', 'Name is ProcessError')
    t.equal(error.pid, 12345, 'PID is set')
    t.equal(error.exit_code, 1, 'Exit code is set')
    t.equal(error.signal, 'SIGTERM', 'Signal is set')

    t.end()
  })

  tape('CommandError - CLI failures', (t) => {
    const error = new CommandError(
      'Command failed',
      'getblockcount',
      'output',
      'error output',
      1
    )

    t.ok(error instanceof CoreError, 'Is a CoreError instance')
    t.ok(error instanceof CommandError, 'Is a CommandError instance')
    t.equal(error.message, 'Command failed', 'Message is set')
    t.equal(error.name, 'CommandError', 'Name is CommandError')
    t.equal(error.command, 'getblockcount', 'Command is set')
    t.equal(error.stdout, 'output', 'Stdout is set')
    t.equal(error.stderr, 'error output', 'Stderr is set')
    t.equal(error.code, 1, 'Code is set')

    t.end()
  })

  tape('ConnectionError - RPC connection failures', (t) => {
    const error = new ConnectionError(
      'Connection refused',
      'localhost',
      18443,
      5000
    )

    t.ok(error instanceof CoreError, 'Is a CoreError instance')
    t.ok(error instanceof ConnectionError, 'Is a ConnectionError instance')
    t.equal(error.message, 'Connection refused', 'Message is set')
    t.equal(error.name, 'ConnectionError', 'Name is ConnectionError')
    t.equal(error.host, 'localhost', 'Host is set')
    t.equal(error.port, 18443, 'Port is set')
    t.equal(error.timeout, 5000, 'Timeout is set')

    t.end()
  })

  tape('RPCError - RPC command failures', (t) => {
    const error = new RPCError(
      'Wallet not found',
      'loadwallet',
      ['nonexistent'],
      -18,
      'Wallet "nonexistent" not found'
    )

    t.ok(error instanceof CoreError, 'Is a CoreError instance')
    t.ok(error instanceof RPCError, 'Is a RPCError instance')
    t.equal(error.message, 'Wallet not found', 'Message is set')
    t.equal(error.name, 'RPCError', 'Name is RPCError')
    t.equal(error.method, 'loadwallet', 'Method is set')
    t.deepEqual(error.params, ['nonexistent'], 'Params are set')
    t.equal(error.rpc_code, -18, 'RPC code is set')
    t.equal(error.rpc_message, 'Wallet "nonexistent" not found', 'RPC message is set')

    t.end()
  })

  tape('WalletError - wallet operation failures', (t) => {
    const error = new WalletError(
      'Insufficient funds',
      'test_wallet',
      'send_funds'
    )

    t.ok(error instanceof CoreError, 'Is a CoreError instance')
    t.ok(error instanceof WalletError, 'Is a WalletError instance')
    t.equal(error.message, 'Insufficient funds', 'Message is set')
    t.equal(error.name, 'WalletError', 'Name is WalletError')
    t.equal(error.wallet_name, 'test_wallet', 'Wallet name is set')
    t.equal(error.operation, 'send_funds', 'Operation is set')

    t.end()
  })

  tape('ConfigError - configuration failures', (t) => {
    const error = new ConfigError(
      'Invalid network',
      'network',
      'invalid'
    )

    t.ok(error instanceof CoreError, 'Is a CoreError instance')
    t.ok(error instanceof ConfigError, 'Is a ConfigError instance')
    t.equal(error.message, 'Invalid network', 'Message is set')
    t.equal(error.name, 'ConfigError', 'Name is ConfigError')
    t.equal(error.config_key, 'network', 'Config key is set')
    t.equal(error.config_value, 'invalid', 'Config value is set')

    t.end()
  })

  tape('NetworkError - network mismatch failures', (t) => {
    const error = new NetworkError(
      'Network mismatch',
      'testnet',
      'regtest'
    )

    t.ok(error instanceof CoreError, 'Is a CoreError instance')
    t.ok(error instanceof NetworkError, 'Is a NetworkError instance')
    t.equal(error.message, 'Network mismatch', 'Message is set')
    t.equal(error.name, 'NetworkError', 'Name is NetworkError')
    t.equal(error.network, 'testnet', 'Network is set')
    t.equal(error.expected, 'regtest', 'Expected is set')

    t.end()
  })

  tape('Error inheritance chain', (t) => {
    const error = new RPCError('Test', 'test', [])

    t.ok(error instanceof Error, 'RPCError is Error')
    t.ok(error instanceof CoreError, 'RPCError is CoreError')
    t.ok(error instanceof RPCError, 'RPCError is RPCError')
    t.notOk(error instanceof WalletError, 'RPCError is not WalletError')

    t.end()
  })

  tape('Error stack traces', (t) => {
    const error = new CoreError('Test error')

    t.ok(error.stack, 'Stack trace exists')
    t.ok(error.stack!.includes('CoreError'), 'Stack includes error name')

    t.end()
  })

  tape('Error serialization', (t) => {
    const error = new RPCError('Test', 'getblockcount', [], -28)

    const json = JSON.stringify({
      name       : error.name,
      message    : error.message,
      method     : error.method,
      rpc_code   : error.rpc_code
    })

    const parsed = JSON.parse(json)

    t.equal(parsed.name, 'RPCError', 'Name serialized')
    t.equal(parsed.message, 'Test', 'Message serialized')
    t.equal(parsed.method, 'getblockcount', 'Method serialized')
    t.equal(parsed.rpc_code, -28, 'RPC code serialized')

    t.end()
  })
}
