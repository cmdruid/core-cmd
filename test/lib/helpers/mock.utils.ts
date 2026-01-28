/**
 * Mock assertion and utility helpers
 */

import type { Test } from 'tape'
import type { RecordedCall } from '../types/mock.types.js'

// ============================================================================
// Call Assertions
// ============================================================================

/**
 * Assert that a method was called
 */
export function assert_called(
  t       : Test,
  calls   : RecordedCall[],
  method  : string,
  message?: string
): void {
  const wasCalled = calls.some(c => c.method === method)
  t.ok(wasCalled, message ?? `Method "${method}" was called`)
}

/**
 * Assert that a method was called with specific arguments
 */
export function assert_called_with(
  t            : Test,
  calls        : RecordedCall[],
  method       : string,
  expectedArgs : unknown[],
  message?     : string
): void {
  const matchingCalls = calls.filter(c => c.method === method)

  if (matchingCalls.length === 0) {
    t.fail(message ?? `Method "${method}" was not called`)
    return
  }

  const hasMatchingArgs = matchingCalls.some(c =>
    JSON.stringify(c.args) === JSON.stringify(expectedArgs)
  )

  if (hasMatchingArgs) {
    t.pass(message ?? `Method "${method}" was called with expected args`)
  } else {
    const actualArgs = matchingCalls.map(c => JSON.stringify(c.args)).join(', ')
    t.fail(
      message ??
      `Method "${method}" was called but not with expected args. ` +
      `Expected: ${JSON.stringify(expectedArgs)}, Got: ${actualArgs}`
    )
  }
}

/**
 * Assert that a method was called a specific number of times
 */
export function assert_call_count(
  t       : Test,
  calls   : RecordedCall[],
  method  : string,
  count   : number,
  message?: string
): void {
  const actualCount = calls.filter(c => c.method === method).length
  t.equal(
    actualCount,
    count,
    message ?? `Method "${method}" was called ${count} times (actual: ${actualCount})`
  )
}

/**
 * Assert that a method was not called
 */
export function assert_not_called(
  t       : Test,
  calls   : RecordedCall[],
  method  : string,
  message?: string
): void {
  const wasCalled = calls.some(c => c.method === method)
  t.ok(!wasCalled, message ?? `Method "${method}" was not called`)
}

/**
 * Assert that methods were called in a specific order
 */
export function assert_call_order(
  t             : Test,
  calls         : RecordedCall[],
  expectedOrder : string[],
  message?      : string
): void {
  // Filter calls to only include expected methods
  const relevantCalls = calls.filter(c => expectedOrder.includes(c.method))
  const actualOrder = relevantCalls.map(c => c.method)

  // Check if expectedOrder is a subsequence of actualOrder
  let expectedIndex = 0
  for (const method of actualOrder) {
    if (method === expectedOrder[expectedIndex]) {
      expectedIndex++
      if (expectedIndex === expectedOrder.length) break
    }
  }

  if (expectedIndex === expectedOrder.length) {
    t.pass(message ?? `Methods called in expected order: ${expectedOrder.join(' -> ')}`)
  } else {
    t.fail(
      message ??
      `Expected call order: ${expectedOrder.join(' -> ')}, ` +
      `Actual order: ${actualOrder.join(' -> ')}`
    )
  }
}

/**
 * Assert that a method was called within a time range
 */
export function assert_called_within(
  t          : Test,
  calls      : RecordedCall[],
  method     : string,
  afterTime  : Date,
  beforeTime : Date,
  message?   : string
): void {
  const matchingCalls = calls.filter(c =>
    c.method === method &&
    c.timestamp >= afterTime &&
    c.timestamp <= beforeTime
  )

  t.ok(
    matchingCalls.length > 0,
    message ?? `Method "${method}" was called within time range`
  )
}

// ============================================================================
// Spy Creation
// ============================================================================

export interface Spy<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>
  calls     : Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: Error }>
  callCount : number
  called    : boolean
  lastCall  : { args: Parameters<T>; result?: ReturnType<T>; error?: Error } | undefined
  clear     : () => void
  restore   : () => void
}

/**
 * Create a spy function that records calls
 *
 * @example
 * ```typescript
 * const spy = create_spy((x: number) => x * 2)
 * spy(5)
 * spy(10)
 *
 * t.equal(spy.callCount, 2)
 * t.deepEqual(spy.calls[0].args, [5])
 * ```
 */
export function create_spy<T extends (...args: any[]) => any>(
  fn?: T
): Spy<T> {
  const calls: Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: Error }> = []

  const spy = ((...args: Parameters<T>): ReturnType<T> => {
    const call: { args: Parameters<T>; result?: ReturnType<T>; error?: Error } = { args }
    calls.push(call)

    if (fn) {
      try {
        const result = fn(...args)
        call.result = result
        return result
      } catch (err) {
        call.error = err instanceof Error ? err : new Error(String(err))
        throw err
      }
    }

    return undefined as ReturnType<T>
  }) as Spy<T>

  Object.defineProperties(spy, {
    calls: {
      get: () => calls
    },
    callCount: {
      get: () => calls.length
    },
    called: {
      get: () => calls.length > 0
    },
    lastCall: {
      get: () => calls[calls.length - 1]
    },
    clear: {
      value: () => { calls.length = 0 }
    },
    restore: {
      value: () => { /* No-op for simple spy */ }
    }
  })

  return spy
}

/**
 * Create an async spy function
 */
export function create_async_spy<T extends (...args: any[]) => Promise<any>>(
  fn?: T
): Spy<T> {
  return create_spy(fn)
}

// ============================================================================
// Mock Utilities
// ============================================================================

/**
 * Get all unique methods that were called
 */
export function get_called_methods(calls: RecordedCall[]): string[] {
  return [...new Set(calls.map(c => c.method))]
}

/**
 * Get the last call for a specific method
 */
export function get_last_call(calls: RecordedCall[], method: string): RecordedCall | undefined {
  const methodCalls = calls.filter(c => c.method === method)
  return methodCalls[methodCalls.length - 1]
}

/**
 * Get all calls for a specific method
 */
export function get_method_calls(calls: RecordedCall[], method: string): RecordedCall[] {
  return calls.filter(c => c.method === method)
}

/**
 * Get calls that match a predicate
 */
export function find_calls(
  calls     : RecordedCall[],
  predicate : (call: RecordedCall) => boolean
): RecordedCall[] {
  return calls.filter(predicate)
}

/**
 * Check if any call matches a predicate
 */
export function has_call_matching(
  calls     : RecordedCall[],
  predicate : (call: RecordedCall) => boolean
): boolean {
  return calls.some(predicate)
}

/**
 * Create a call matcher for specific arguments
 */
export function args_match(expectedArgs: unknown[]): (call: RecordedCall) => boolean {
  return (call: RecordedCall) =>
    JSON.stringify(call.args) === JSON.stringify(expectedArgs)
}

/**
 * Create a call matcher for partial arguments
 */
export function args_contain(partialArgs: unknown[]): (call: RecordedCall) => boolean {
  return (call: RecordedCall) =>
    partialArgs.every((arg, i) =>
      JSON.stringify(call.args[i]) === JSON.stringify(arg)
    )
}

// ============================================================================
// Timing Utilities
// ============================================================================

/**
 * Get calls within a time range
 */
export function get_calls_in_range(
  calls  : RecordedCall[],
  start  : Date,
  end    : Date
): RecordedCall[] {
  return calls.filter(c => c.timestamp >= start && c.timestamp <= end)
}

/**
 * Get the time between calls to a method
 */
export function get_call_intervals(calls: RecordedCall[], method: string): number[] {
  const methodCalls = calls.filter(c => c.method === method)
  const intervals: number[] = []

  for (let i = 1; i < methodCalls.length; i++) {
    const diff = methodCalls[i].timestamp.getTime() - methodCalls[i - 1].timestamp.getTime()
    intervals.push(diff)
  }

  return intervals
}

/**
 * Calculate average time between calls
 */
export function get_average_call_interval(calls: RecordedCall[], method: string): number {
  const intervals = get_call_intervals(calls, method)
  if (intervals.length === 0) return 0
  return intervals.reduce((sum, i) => sum + i, 0) / intervals.length
}
