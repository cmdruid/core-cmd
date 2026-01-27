import { Test } from '@vbyte/util'

// Re-export Test utilities
export const test = Test

// Custom test utilities for this project
export function create_test_suite(name: string) {
  return {
    name,
    tests: [] as Array<() => Promise<void>>,
    
    add(test_name: string, fn: () => Promise<void>) {
      this.tests.push(async () => {
        console.log(`  Testing: ${test_name}`)
        await fn()
        console.log(`  ✓ ${test_name}`)
      })
    },
    
    async run() {
      console.log(`\nRunning test suite: ${this.name}`)
      console.log('='.repeat(40))
      
      for (const test_fn of this.tests) {
        await test_fn()
      }
      
      console.log(`✓ All tests in ${this.name} passed!`)
    }
  }
}

// Test helpers
export async function expect_error(
  fn: () => Promise<any>,
  expected_message?: string
): Promise<void> {
  try {
    await fn()
    throw new Error('Expected function to throw an error')
  } catch (err) {
    if (expected_message && err instanceof Error) {
      if (!err.message.includes(expected_message)) {
        throw new Error(`Expected error message to contain "${expected_message}", got "${err.message}"`)
      }
    }
  }
}

export function expect_equal<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${actual} to equal ${expected}`)
  }
}

export function expect_deep_equal<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(actual)} to deep equal ${JSON.stringify(expected)}`)
  }
}