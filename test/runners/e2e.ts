/**
 * E2E test runner - runs end-to-end scenario tests
 */

import tape from 'tape'
import { glob } from 'glob'
import { pathToFileURL } from 'node:url'
import { CoreDaemon } from '../../src/index.js'
import { create_daemon_context } from '../lib/helpers/context.js'
import {
  DEFAULT_E2E_TIMEOUT_MS,
  E2E_TEST_PATTERN,
  DEFAULT_TEST_CONFIG
} from '../lib/const.js'
import type {
  E2ERunnerConfig,
  TestResults,
  DaemonTestContext
} from '../lib/types/test.types.js'

// ============================================================================
// E2E Test Runner
// ============================================================================

/**
 * Run E2E tests (full scenario tests)
 *
 * @example
 * ```bash
 * tsx test/runners/e2e.ts
 * ```
 */
export async function run_e2e_tests(
  config: E2ERunnerConfig = {}
): Promise<TestResults> {
  const {
    timeout_ms: _timeout_ms = DEFAULT_E2E_TIMEOUT_MS,
    glob_pattern    = E2E_TEST_PATTERN,
    bail_on_failure: _bail_on_failure = false,
    core_config     = DEFAULT_TEST_CONFIG
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

  console.log('E2E Test Runner')
  console.log('===============')
  console.log(`Pattern: ${glob_pattern}`)
  console.log(`Timeout: ${_timeout_ms}ms`)
  console.log('')

  // Find test files
  const testFiles = await glob(glob_pattern)

  if (testFiles.length === 0) {
    console.log('No E2E test files found')
    return results
  }

  console.log(`Found ${testFiles.length} E2E test files\n`)

  let daemon: CoreDaemon | null = null
  let ctx: DaemonTestContext | null = null

  try {
    // Start daemon for all E2E tests
    console.log('Starting Bitcoin Core daemon...')
    daemon = await CoreDaemon.spawn(core_config as any)
    ctx = create_daemon_context(daemon)
    console.log('Daemon ready\n')

    // Load all test files
    for (const testFile of testFiles) {
      const testName = testFile
        .replace(/^test\/cases\//, '')
        .replace(/\.e2e\.test\.ts$/, '')
        .replace(/\.test\.ts$/, '')

      results.total++

      try {
        const fileUrl = pathToFileURL(testFile).href
        const module = await import(fileUrl)

        if (typeof module.default !== 'function') {
          console.log(`  ⚠ Skipping ${testName} - no default export`)
          results.skipped++
          continue
        }

        console.log(`  Loading ${testName}...`)

        // Call the test function - this queues tests with tape
        await module.default(tape, ctx)

        results.results.push({
          name     : testName,
          passed   : true,
          duration : 0
        })

      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        results.failed++
        results.errors.push(error)
        results.results.push({
          name     : testName,
          passed   : false,
          duration : 0,
          error
        })
        console.log(`  ✗ Failed to load ${testName}: ${error.message}`)
      }
    }

    // Register cleanup to run when tape finishes
    if (daemon) {
      const daemonToShutdown = daemon
      tape.onFinish(async () => {
        console.log('\nShutting down daemon...')
        await daemonToShutdown.shutdown().catch(() => {})
      })
    }

  } catch (err) {
    // Cleanup on error during setup
    if (daemon) {
      console.log('\nShutting down daemon after error...')
      await daemon.shutdown().catch(() => {})
    }
    throw err
  }

  results.duration = Date.now() - startTime

  // Print summary
  print_summary(results)

  return results
}

/**
 * Print test summary
 */
function print_summary(results: TestResults): void {
  console.log('\n===============')
  console.log('E2E Test Summary')
  console.log('===============')
  console.log(`Total:    ${results.total}`)
  console.log(`Passed:   ${results.passed}`)
  console.log(`Failed:   ${results.failed}`)
  console.log(`Skipped:  ${results.skipped}`)
  console.log(`Duration: ${results.duration}ms`)

  if (results.errors.length > 0) {
    console.log('\nErrors:')
    for (const error of results.errors) {
      console.log(`  - ${error.message}`)
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  console.log('')

  run_e2e_tests()
    .then(() => {
      // Tests are queued, tape will run them
      // Daemon shutdown is registered with tape.onFinish
    })
    .catch(err => {
      console.error('E2E test runner failed:', err)
      process.exitCode = 1
    })
}

export default run_e2e_tests
