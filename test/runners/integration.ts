/**
 * Integration test runner - runs tests with real Bitcoin Core
 */

import tape from 'tape'
import { glob } from 'glob'
import { pathToFileURL } from 'url'
import { CoreDaemon } from '../../src/index.js'
import { create_daemon_context } from '../lib/helpers/context.js'
import {
  DEFAULT_INTEGRATION_TIMEOUT_MS,
  INTEGRATION_TEST_PATTERN,
  DEFAULT_TEST_CONFIG
} from '../lib/const.js'
import type {
  IntegrationRunnerConfig,
  TestResults,
  TestModule,
  DaemonTestContext
} from '../lib/types/test.types.js'
// Reporter not used - we rely on tape's TAP output

// ============================================================================
// Integration Test Runner
// ============================================================================

/**
 * Run integration tests with real Bitcoin Core
 *
 * @example
 * ```bash
 * tsx test/runners/integration.ts
 * ```
 */
export async function run_integration_tests(
  config: IntegrationRunnerConfig = {}
): Promise<TestResults> {
  const {
    timeout_ms         = DEFAULT_INTEGRATION_TIMEOUT_MS,
    glob_pattern       = INTEGRATION_TEST_PATTERN,
    bail_on_failure    = false,
    reuse_daemon       = true,
    cleanup_on_failure = true,
    core_config        = DEFAULT_TEST_CONFIG
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

  console.log('Integration Test Runner')
  console.log('=======================')
  console.log(`Pattern: ${glob_pattern}`)
  console.log(`Timeout: ${timeout_ms}ms`)
  console.log(`Reuse daemon: ${reuse_daemon}`)
  console.log('')

  // Find test files
  const testFiles = await glob(glob_pattern)

  if (testFiles.length === 0) {
    console.log('No test files found')
    return results
  }

  console.log(`Found ${testFiles.length} test files\n`)

  let daemon: CoreDaemon | null = null
  let ctx: DaemonTestContext | null = null

  try {
    // Spawn daemon if reusing
    if (reuse_daemon) {
      console.log('Starting Bitcoin Core daemon...')
      daemon = await CoreDaemon.spawn(core_config as any)
      ctx = create_daemon_context(daemon)
      console.log('Daemon ready\n')
    }

    // Run each test file
    for (const testFile of testFiles) {
      if (bail_on_failure && results.failed > 0) {
        console.log('Bailing due to failure')
        break
      }

      try {
        // Create new daemon per test if not reusing
        if (!reuse_daemon) {
          console.log(`Starting daemon for ${testFile}...`)
          daemon = await CoreDaemon.spawn(core_config as any)
          ctx = create_daemon_context(daemon)
        }

        await run_test_file(testFile, ctx!, results)

        // Shutdown per-test daemon
        if (!reuse_daemon && daemon) {
          await daemon.shutdown()
          daemon = null
          ctx = null
        }

      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        results.errors.push(error)
        results.failed++
        console.error(`Error in ${testFile}: ${error.message}`)

        if (cleanup_on_failure && !reuse_daemon && daemon) {
          await daemon.shutdown().catch(() => {})
          daemon = null
          ctx = null
        }
      }
    }

    // Register cleanup to run when tape finishes
    // This keeps the daemon alive while tests run
    if (reuse_daemon && daemon) {
      const daemonToShutdown = daemon
      tape.onFinish(async () => {
        console.log('\nShutting down daemon...')
        await daemonToShutdown.shutdown().catch(() => {})
      })
    }

    // Don't wait here - let tape run the tests asynchronously
    // The daemon shutdown will happen when tape.onFinish fires

  } catch (err) {
    // Cleanup on error
    if (reuse_daemon && daemon) {
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
 * Run a single test file - loads and queues tests with tape
 */
async function run_test_file(
  filePath : string,
  ctx      : DaemonTestContext,
  results  : TestResults
): Promise<void> {
  const fileUrl = pathToFileURL(filePath).href
  const module = await import(fileUrl) as TestModule

  if (typeof module.default !== 'function') {
    console.log(`  ⚠ Skipping ${filePath} - no default export`)
    return
  }

  const testName = filePath
    .replace(/^test\/cases\//, '')
    .replace(/\.int\.test\.ts$/, '')
    .replace(/\.test\.ts$/, '')

  results.total++

  try {
    // Run setup if available
    if (module.setup) {
      await module.setup(ctx)
    }

    // Load test - this queues tests with tape
    console.log(`  Loading ${testName}...`)
    await module.default(tape, ctx)

    results.results.push({
      name     : testName,
      passed   : true,  // We don't know yet - tape will tell us
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

/**
 * Create integration test context (for external use)
 */
export async function create_integration_context(
  config?: Record<string, unknown>
): Promise<{ ctx: DaemonTestContext; cleanup: () => Promise<void> }> {
  const daemon = await CoreDaemon.spawn({
    ...DEFAULT_TEST_CONFIG,
    ...config
  } as any)

  const ctx = create_daemon_context(daemon)

  return {
    ctx,
    cleanup: () => daemon.shutdown()
  }
}

/**
 * Print test summary
 */
function print_summary(results: TestResults): void {
  console.log('\n=======================')
  console.log('Test Summary')
  console.log('=======================')
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
  // Keep event loop alive while tape processes tests
  const keepAlive = setInterval(() => {}, 100)

  run_integration_tests()
    .then(() => {
      // Tests are queued, wait for tape to finish
      // tape.onFinish is already registered for daemon shutdown
      // We just need to wait for it and then clean up
      tape.onFinish(() => {
        clearInterval(keepAlive)
        // Tape sets process.exitCode based on test results
      })
    })
    .catch(err => {
      console.error('Integration test runner failed:', err)
      clearInterval(keepAlive)
      process.exitCode = 1
    })
}

export default run_integration_tests
