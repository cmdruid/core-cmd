/**
 * Unit test runner - runs tests without Bitcoin Core
 */

import tape from 'tape'
import { glob } from 'glob'
import { pathToFileURL } from 'node:url'
import { create_mock_context } from '../lib/helpers/context.js'
import { DEFAULT_UNIT_TIMEOUT_MS, UNIT_TEST_PATTERN } from '../lib/const.js'
import type { UnitRunnerConfig, TestResults, MockTestContext } from '../lib/types/test.types.js'

// ============================================================================
// Types
// ============================================================================

interface TestModule {
  default: (tape: typeof import('tape'), ctx: MockTestContext) => void | Promise<void>
  setup?: (ctx: MockTestContext) => void | Promise<void>
  teardown?: (ctx: MockTestContext) => void | Promise<void>
}

// ============================================================================
// Unit Test Runner
// ============================================================================

/**
 * Run unit tests (no Bitcoin Core required)
 *
 * @example
 * ```bash
 * tsx test/runners/unit.ts
 * ```
 */
export async function run_unit_tests(
  config: UnitRunnerConfig = {}
): Promise<TestResults> {
  const {
    timeout_ms: _timeout_ms = DEFAULT_UNIT_TIMEOUT_MS,
    glob_pattern    = UNIT_TEST_PATTERN,
    bail_on_failure: _bail_on_failure = false,
    verbose: _verbose = false
  } = config

  const results: TestResults = {
    total    : 0,
    passed   : 0,
    failed   : 0,
    skipped  : 0,
    duration : 0,
    results  : [],
    errors   : []
  }

  const startTime = Date.now()

  // Find test files
  const testFiles = await glob(glob_pattern)

  if (testFiles.length === 0) {
    console.log('  No test files found')
    return results
  }

  console.log(`  Found ${testFiles.length} test files`)
  console.log('')

  // Create shared mock context
  const ctx = create_mock_context()

  // IMPORTANT: Import ALL modules FIRST before calling any test functions.
  // This prevents tape from starting to process tests before all are queued.
  const modules: Array<{ file: string; name: string; module: TestModule }> = []

  for (const testFile of testFiles) {
    const testName = testFile
      .replace(/^test\/cases\//, '')
      .replace(/\.test\.ts$/, '')

    try {
      const fileUrl = pathToFileURL(testFile).href
      const module = await import(fileUrl) as TestModule

      if (typeof module.default !== 'function') {
        console.log(`  ⚠ Skipping ${testName} - no default export`)
        continue
      }

      modules.push({ file: testFile, name: testName, module })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.log(`  ✗ ${testName} (import failed)`)
      console.log(`    ${error.message.split('\n')[0]}`)
      results.errors.push(error)
      results.failed++
    }
  }

  // Call all test functions synchronously - this queues all tests to tape
  // BEFORE tape starts processing (tape starts on process.nextTick)
  for (const { name: testName, module } of modules) {
    try {
      const testStart = Date.now()
      results.total++

      // Call default function synchronously (it returns void, not Promise)
      // This queues tests to tape's global queue
      module.default(tape, ctx)

      const duration = Date.now() - testStart
      results.passed++
      results.results.push({
        name     : testName,
        passed   : true,
        duration
      })

      console.log(`  ✓ ${testName} (${duration}ms)`)

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const duration = Date.now() - startTime
      results.errors.push(error)
      results.failed++
      results.results.push({
        name     : testName,
        passed   : false,
        duration,
        error
      })

      console.log(`  ✗ ${testName}`)
      console.log(`    ${error.message.split('\n')[0]}`)
    }
  }

  results.duration = Date.now() - startTime

  console.log('')
  console.log(`  ${results.passed}/${results.total} tests passed (${results.duration}ms)`)

  return results
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const isMainModule = import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  console.log('Unit Test Runner')
  console.log('================')
  console.log('')

  // Run tests - this queues tape tests, then tape runs them
  run_unit_tests({ verbose: true })
    .then(() => {
      // After all tests are queued, register onFinish to exit cleanly
      // This ensures we don't exit before tape processes all queued tests
      tape.onFinish(() => {
        process.exitCode = 0
      })
    })
    .catch(err => {
      console.error('Unit tests failed:', err)
      process.exitCode = 1
    })
}

export default run_unit_tests
