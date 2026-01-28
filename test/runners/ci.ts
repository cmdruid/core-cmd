/**
 * CI test runner - optimized for continuous integration
 */

import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import {
  DEFAULT_CI_TIMEOUT_MS,
  detect_ci_environment
} from '../lib/const.js'
import type { CIRunnerConfig, CITestResults, TestResults } from '../lib/types/test.types.js'

// ============================================================================
// Subprocess Runner
// ============================================================================

/**
 * Run a test suite in a subprocess to isolate tape instances
 */
async function run_suite_in_subprocess(
  suite: 'unit' | 'integration' | 'e2e',
  _bail_on_failure: boolean
): Promise<TestResults> {
  return new Promise((resolve) => {
    const script = suite === 'unit' ? 'test/runners/unit.ts'
                 : suite === 'integration' ? 'test/runners/integration.ts'
                 : 'test/runners/e2e.ts'

    const child = spawn('npx', ['tsx', script], {
      stdio: ['ignore', 'inherit', 'inherit'],
      cwd: process.cwd()
    })

    let passed = 0
    let failed = 0
    const startTime = Date.now()

    child.on('close', (code) => {
      // If exit code is 0, all tests passed
      // Otherwise some tests failed (tape sets exit code)
      if (code === 0) {
        passed = 1  // At least the suite passed
      } else {
        failed = 1  // Suite had failures
      }

      resolve({
        total    : 1,
        passed,
        failed,
        skipped  : 0,
        duration : Date.now() - startTime,
        results  : [{
          name   : suite,
          passed : code === 0,
          duration: Date.now() - startTime
        }],
        errors   : code !== 0 ? [new Error(`${suite} tests failed with exit code ${code}`)] : []
      })
    })

    child.on('error', (err) => {
      resolve({
        total    : 1,
        passed   : 0,
        failed   : 1,
        skipped  : 0,
        duration : Date.now() - startTime,
        results  : [{
          name   : suite,
          passed : false,
          duration: Date.now() - startTime,
          error  : err
        }],
        errors   : [err]
      })
    })
  })
}

// ============================================================================
// CI Test Runner
// ============================================================================

/**
 * Check if Bitcoin Core binaries are available
 */
function has_bitcoin_core(): boolean {
  return existsSync('test/bin/bitcoind') && existsSync('test/bin/bitcoin-cli')
}

/**
 * Run tests optimized for CI environment
 *
 * @example
 * ```bash
 * # Run unit tests only (default, no Bitcoin Core needed)
 * npm test
 *
 * # Run all tests including integration (requires Bitcoin Core)
 * npm test -- --all
 *
 * # Run specific suite
 * npm test -- --integration-only
 * ```
 */
export async function run_ci_tests(
  config: CIRunnerConfig = {}
): Promise<CITestResults> {
  // Default to unit tests only unless Bitcoin Core is available or explicitly requested
  const defaultSuites = config.suites ?? (has_bitcoin_core() ? ['unit', 'integration'] : ['unit'])

  const {
    suites             = defaultSuites,
    global_timeout_ms  = DEFAULT_CI_TIMEOUT_MS,
    reporter: _reporter = 'tap',
    fail_fast          = true,
    retry_failed: _retry_failed = 0
  } = config

  const environment = detect_ci_environment()
  const startTime = Date.now()

  console.log('╔══════════════════════════════════════╗')
  console.log('║         CI Test Runner               ║')
  console.log('╚══════════════════════════════════════╝')
  console.log('')
  console.log(`  Environment:    ${environment}`)
  console.log(`  Suites:         ${suites.join(', ')}`)
  console.log(`  Timeout:        ${global_timeout_ms}ms`)
  console.log(`  Fail fast:      ${fail_fast}`)
  console.log(`  Bitcoin Core:   ${has_bitcoin_core() ? 'available' : 'not found'}`)
  console.log('')

  const results: CITestResults = {
    total       : 0,
    passed      : 0,
    failed      : 0,
    skipped     : 0,
    duration    : 0,
    results     : [],
    errors      : [],
    environment,
    suites      : {}
  }

  // Set up global timeout
  const globalTimeout = setTimeout(() => {
    console.error(`\n✗ Global timeout exceeded (${global_timeout_ms}ms)`)
    process.exit(1)
  }, global_timeout_ms)

  try {
    // Run unit tests
    if (suites.includes('unit')) {
      console.log('┌──────────────────────────────────────┐')
      console.log('│  Unit Tests                          │')
      console.log('└──────────────────────────────────────┘')
      console.log('')

      // Run unit tests in subprocess to get separate tape instance
      const unitResults = await run_suite_in_subprocess('unit', fail_fast)
      results.suites.unit = unitResults
      merge_results(results, unitResults)

      if (fail_fast && unitResults.failed > 0) {
        console.log('\n✗ Stopping due to unit test failures')
        return finalize_results(results, startTime, globalTimeout)
      }
    }

    // Run integration tests
    if (suites.includes('integration')) {
      if (!has_bitcoin_core()) {
        console.log('\n⚠ Skipping integration tests (Bitcoin Core not found)')
        console.log('  Install bitcoind and bitcoin-cli to test/bin/ to enable')
      } else {
        console.log('')
        console.log('┌──────────────────────────────────────┐')
        console.log('│  Integration Tests                   │')
        console.log('└──────────────────────────────────────┘')
        console.log('')

        try {
          // Run integration tests in subprocess
          const integrationResults = await run_suite_in_subprocess('integration', fail_fast)
          results.suites.integration = integrationResults
          merge_results(results, integrationResults)

          if (fail_fast && integrationResults.failed > 0) {
            console.log('\n✗ Stopping due to integration test failures')
            return finalize_results(results, startTime, globalTimeout)
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          console.log(`\n✗ Integration tests failed: ${error.message}`)
          results.errors.push(error)
          results.failed++

          if (fail_fast) {
            return finalize_results(results, startTime, globalTimeout)
          }
        }
      }
    }

    // Run E2E tests
    if (suites.includes('e2e')) {
      if (!has_bitcoin_core()) {
        console.log('\n⚠ Skipping E2E tests (Bitcoin Core not found)')
      } else {
        console.log('')
        console.log('┌──────────────────────────────────────┐')
        console.log('│  E2E Tests                           │')
        console.log('└──────────────────────────────────────┘')
        console.log('')

        try {
          // Run E2E tests in subprocess
          const e2eResults = await run_suite_in_subprocess('e2e', fail_fast)
          results.suites.e2e = e2eResults
          merge_results(results, e2eResults)
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          console.log(`\n✗ E2E tests failed: ${error.message}`)
          results.errors.push(error)
          results.failed++
        }
      }
    }

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('\n✗ Test runner error:', error.message)
    results.errors.push(error)
  } finally {
    clearTimeout(globalTimeout)
  }

  return finalize_results(results, startTime, globalTimeout)
}

/**
 * Merge suite results into overall results
 */
function merge_results(overall: CITestResults, suite: TestResults): void {
  overall.total += suite.total
  overall.passed += suite.passed
  overall.failed += suite.failed
  overall.skipped += suite.skipped
  overall.results.push(...suite.results)
  overall.errors.push(...suite.errors)
}

/**
 * Finalize results and print summary
 */
function finalize_results(
  results       : CITestResults,
  startTime     : number,
  globalTimeout : NodeJS.Timeout
): CITestResults {
  clearTimeout(globalTimeout)
  results.duration = Date.now() - startTime

  print_ci_summary(results)

  return results
}

/**
 * Print CI summary
 */
function print_ci_summary(results: CITestResults): void {
  console.log('')
  console.log('╔══════════════════════════════════════╗')
  console.log('║         Test Summary                 ║')
  console.log('╚══════════════════════════════════════╝')
  console.log('')
  console.log(`  Total:      ${results.total}`)
  console.log(`  Passed:     ${results.passed}`)
  console.log(`  Failed:     ${results.failed}`)
  console.log(`  Skipped:    ${results.skipped}`)
  console.log(`  Duration:   ${results.duration}ms`)
  console.log('')

  // Suite breakdown
  if (Object.keys(results.suites).length > 0) {
    console.log('  Suite Results:')
    if (results.suites.unit) {
      const s = results.suites.unit
      console.log(`    Unit:        ${s.passed}/${s.total} passed`)
    }
    if (results.suites.integration) {
      const s = results.suites.integration
      console.log(`    Integration: ${s.passed}/${s.total} passed`)
    }
    if (results.suites.e2e) {
      const s = results.suites.e2e
      console.log(`    E2E:         ${s.passed}/${s.total} passed`)
    }
    console.log('')
  }

  if (results.errors.length > 0) {
    console.log('  Errors:')
    for (const error of results.errors.slice(0, 5)) {
      console.log(`    - ${error.message.split('\n')[0]}`)
    }
    if (results.errors.length > 5) {
      console.log(`    ... and ${results.errors.length - 5} more`)
    }
    console.log('')
  }

  // Final status
  if (results.failed > 0) {
    console.log(`  ✗ FAILED (${results.failed} tests failed)`)
  } else if (results.total === 0) {
    console.log('  ⚠ No tests were run')
  } else {
    console.log('  ✓ PASSED')
  }
  console.log('')
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  (async () => {
    // Parse CLI arguments
    const args = process.argv.slice(2)
    const config: CIRunnerConfig = {}

    for (const arg of args) {
      if (arg === '--unit-only' || arg === '--unit') {
        config.suites = ['unit']
      } else if (arg === '--integration-only' || arg === '--integration') {
        config.suites = ['integration']
      } else if (arg === '--e2e-only' || arg === '--e2e') {
        config.suites = ['e2e']
      } else if (arg === '--all') {
        config.suites = ['unit', 'integration', 'e2e']
      } else if (arg === '--no-fail-fast') {
        config.fail_fast = false
      } else if (arg.startsWith('--timeout=')) {
        config.global_timeout_ms = parseInt(arg.split('=')[1], 10)
      } else if (arg === '--help' || arg === '-h') {
        console.log('Usage: npm test [options]')
        console.log('')
        console.log('Options:')
        console.log('  --unit-only       Run only unit tests (default if no Bitcoin Core)')
        console.log('  --integration     Run integration tests (requires Bitcoin Core)')
        console.log('  --e2e             Run E2E tests (requires Bitcoin Core)')
        console.log('  --all             Run all test suites')
        console.log('  --no-fail-fast    Continue on failures')
        console.log('  --timeout=N       Set global timeout in ms')
        console.log('  --help            Show this help')
        process.exit(0)
      }
    }

    try {
      // IMPORTANT: Tape starts processing tests on process.nextTick after the first test is queued.
      // To ensure ALL tests (unit + integration) are processed, we need to queue them all
      // before yielding to the event loop.
      //
      // However, our runners use async/await which yields to the event loop.
      // Solution: The daemon in integration tests keeps the event loop alive.
      // We register cleanup on tape.onFinish which fires after ALL queued tests complete.

      // Run the tests - this queues tape tests
      await run_ci_tests(config)

      // Tape tests run automatically
      // Don't call process.exit() - let tape handle the exit naturally
      // Tape will set exit code based on test results

    } catch (err) {
      console.error('CI test runner failed:', err)
      process.exit(1)
    }
  })()
}

export default run_ci_tests
