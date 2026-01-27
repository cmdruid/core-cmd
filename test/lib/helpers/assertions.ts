/**
 * Extended assertion helpers for tape tests
 */

import type { Test } from 'tape'
import type { UTXO, TxResult } from '../../../src/index.js'
import { CoreError } from '../../../src/index.js'

// ============================================================================
// Types
// ============================================================================

export interface AssertionHelpers {
  /** Assert that an async function throws */
  throws: (fn: () => Promise<unknown>, message?: string) => Promise<void>
  /** Assert that an async function throws a specific error type */
  throws_type: <T extends Error>(
    fn: () => Promise<unknown>,
    errorType: new (...args: any[]) => T,
    message?: string
  ) => Promise<T>
  /** Assert that an async function throws with a specific message */
  throws_message: (
    fn: () => Promise<unknown>,
    expectedMessage: string | RegExp,
    message?: string
  ) => Promise<void>
  /** Assert that a value matches a regex */
  matches: (value: string, pattern: RegExp, message?: string) => void
  /** Assert that an array contains a value */
  contains: <T>(arr: T[], value: T, message?: string) => void
  /** Assert that an array does not contain a value */
  not_contains: <T>(arr: T[], value: T, message?: string) => void
  /** Assert that a number is within a range */
  in_range: (value: number, min: number, max: number, message?: string) => void
  /** Assert deep equality with better error messages */
  deep_equals: <T>(actual: T, expected: T, message?: string) => void
  /** Assert that a value is a valid transaction */
  valid_tx: (tx: unknown, message?: string) => void
  /** Assert that a value is a valid UTXO */
  valid_utxo: (utxo: unknown, message?: string) => void
  /** Assert that a value is a valid address */
  valid_address: (address: string, network?: string, message?: string) => void
  /** Assert that a value is a valid txid */
  valid_txid: (txid: string, message?: string) => void
  /** Assert that an error is a CoreError */
  is_core_error: (err: unknown, message?: string) => void
  /** Assert approximate equality for numbers */
  approximately: (actual: number, expected: number, delta: number, message?: string) => void
}

// ============================================================================
// Create Assertions
// ============================================================================

/**
 * Create extended assertion helpers for a tape test
 *
 * @example
 * ```typescript
 * test('my test', async t => {
 *   const assert = create_assertions(t)
 *
 *   await assert.throws(
 *     () => client.get_tx('invalid'),
 *     'should throw on invalid txid'
 *   )
 *
 *   assert.valid_tx(tx, 'should return valid transaction')
 * })
 * ```
 */
export function create_assertions(t: Test): AssertionHelpers {
  return {
    /**
     * Assert that an async function throws
     */
    async throws(fn: () => Promise<unknown>, message?: string): Promise<void> {
      try {
        await fn()
        t.fail(message ?? 'Expected to throw but did not')
      } catch {
        t.pass(message ?? 'Threw as expected')
      }
    },

    /**
     * Assert that an async function throws a specific error type
     */
    async throws_type<T extends Error>(
      fn: () => Promise<unknown>,
      errorType: new (...args: any[]) => T,
      message?: string
    ): Promise<T> {
      try {
        await fn()
        t.fail(message ?? `Expected to throw ${errorType.name} but did not throw`)
        throw new Error('Expected to throw')
      } catch (err) {
        if (err instanceof errorType) {
          t.pass(message ?? `Threw ${errorType.name} as expected`)
          return err
        }
        t.fail(
          message ??
          `Expected ${errorType.name} but got ${(err as Error).constructor.name}`
        )
        throw err
      }
    },

    /**
     * Assert that an async function throws with a specific message
     */
    async throws_message(
      fn: () => Promise<unknown>,
      expectedMessage: string | RegExp,
      message?: string
    ): Promise<void> {
      try {
        await fn()
        t.fail(message ?? 'Expected to throw but did not')
      } catch (err) {
        const errMessage = (err as Error).message
        const matches = expectedMessage instanceof RegExp
          ? expectedMessage.test(errMessage)
          : errMessage.includes(expectedMessage)

        if (matches) {
          t.pass(message ?? `Threw with expected message`)
        } else {
          t.fail(
            message ??
            `Expected error message "${expectedMessage}" but got "${errMessage}"`
          )
        }
      }
    },

    /**
     * Assert that a value matches a regex
     */
    matches(value: string, pattern: RegExp, message?: string): void {
      t.ok(
        pattern.test(value),
        message ?? `"${value}" matches ${pattern}`
      )
    },

    /**
     * Assert that an array contains a value
     */
    contains<T>(arr: T[], value: T, message?: string): void {
      t.ok(
        arr.includes(value),
        message ?? `Array contains ${JSON.stringify(value)}`
      )
    },

    /**
     * Assert that an array does not contain a value
     */
    not_contains<T>(arr: T[], value: T, message?: string): void {
      t.ok(
        !arr.includes(value),
        message ?? `Array does not contain ${JSON.stringify(value)}`
      )
    },

    /**
     * Assert that a number is within a range
     */
    in_range(value: number, min: number, max: number, message?: string): void {
      t.ok(
        value >= min && value <= max,
        message ?? `${value} is in range [${min}, ${max}]`
      )
    },

    /**
     * Assert deep equality with better error messages
     */
    deep_equals<T>(actual: T, expected: T, message?: string): void {
      t.deepEqual(actual, expected, message ?? 'Values are deeply equal')
    },

    /**
     * Assert that a value is a valid transaction
     */
    valid_tx(tx: unknown, message?: string): void {
      const result = tx as TxResult | null
      const valid = result !== null &&
        typeof result === 'object' &&
        typeof result.txid === 'string' &&
        result.txid.length === 64 &&
        typeof result.version === 'number' &&
        Array.isArray(result.vin) &&
        Array.isArray(result.vout)

      t.ok(valid, message ?? 'Is valid transaction')
    },

    /**
     * Assert that a value is a valid UTXO
     */
    valid_utxo(utxo: unknown, message?: string): void {
      const result = utxo as UTXO | null
      const valid = result !== null &&
        typeof result === 'object' &&
        typeof result.txid === 'string' &&
        result.txid.length === 64 &&
        typeof result.vout === 'number' &&
        typeof result.sats === 'number' &&
        result.sats > 0

      t.ok(valid, message ?? 'Is valid UTXO')
    },

    /**
     * Assert that a value is a valid address
     */
    valid_address(address: string, network?: string, message?: string): void {
      let valid = typeof address === 'string' && address.length > 20

      if (network && valid) {
        const prefixes: Record<string, string[]> = {
          regtest : ['bcrt1', '2', 'm', 'n'],
          testnet : ['tb1', '2', 'm', 'n'],
          mainnet : ['bc1', '1', '3']
        }
        const validPrefixes = prefixes[network] ?? []
        valid = validPrefixes.some(p => address.startsWith(p))
      }

      t.ok(valid, message ?? `"${address}" is valid ${network ?? ''} address`)
    },

    /**
     * Assert that a value is a valid txid
     */
    valid_txid(txid: string, message?: string): void {
      const valid = typeof txid === 'string' &&
        txid.length === 64 &&
        /^[0-9a-fA-F]+$/.test(txid)

      t.ok(valid, message ?? `"${txid}" is valid txid`)
    },

    /**
     * Assert that an error is a CoreError
     */
    is_core_error(err: unknown, message?: string): void {
      t.ok(
        err instanceof CoreError,
        message ?? 'Error is CoreError instance'
      )
    },

    /**
     * Assert approximate equality for numbers
     */
    approximately(
      actual   : number,
      expected : number,
      delta    : number,
      message? : string
    ): void {
      const diff = Math.abs(actual - expected)
      t.ok(
        diff <= delta,
        message ?? `${actual} ≈ ${expected} (±${delta})`
      )
    }
  }
}

// ============================================================================
// Standalone Assertion Functions
// ============================================================================

/**
 * Assert that a promise rejects
 */
export async function expect_error(
  fn: () => Promise<unknown>,
  message?: string
): Promise<Error> {
  try {
    await fn()
    throw new Error(message ?? 'Expected function to throw but it did not')
  } catch (err) {
    if (err instanceof Error && err.message.includes('Expected function to throw')) {
      throw err
    }
    return err instanceof Error ? err : new Error(String(err))
  }
}

/**
 * Assert that a promise rejects with a specific error type
 */
export async function expect_error_type<T extends Error>(
  fn: () => Promise<unknown>,
  errorType: new (...args: any[]) => T
): Promise<T> {
  try {
    await fn()
    throw new Error(`Expected ${errorType.name} but function did not throw`)
  } catch (err) {
    if (err instanceof errorType) {
      return err
    }
    throw new Error(
      `Expected ${errorType.name} but got ${(err as Error).constructor.name}`
    )
  }
}

/**
 * Check if a value is a valid transaction
 */
export function is_valid_tx(tx: unknown): tx is TxResult {
  const result = tx as TxResult | null
  return result !== null &&
    typeof result === 'object' &&
    typeof result.txid === 'string' &&
    result.txid.length === 64 &&
    typeof result.version === 'number' &&
    Array.isArray(result.vin) &&
    Array.isArray(result.vout)
}

/**
 * Check if a value is a valid UTXO
 */
export function is_valid_utxo(utxo: unknown): utxo is UTXO {
  const result = utxo as UTXO | null
  return result !== null &&
    typeof result === 'object' &&
    typeof result.txid === 'string' &&
    result.txid.length === 64 &&
    typeof result.vout === 'number' &&
    typeof result.sats === 'number'
}

/**
 * Check if a value is a valid txid
 */
export function is_valid_txid(txid: unknown): txid is string {
  return typeof txid === 'string' &&
    txid.length === 64 &&
    /^[0-9a-fA-F]+$/.test(txid)
}

/**
 * Check if a value is a valid block hash
 */
export function is_valid_blockhash(hash: unknown): hash is string {
  return typeof hash === 'string' &&
    hash.length === 64 &&
    /^[0-9a-fA-F]+$/.test(hash)
}
