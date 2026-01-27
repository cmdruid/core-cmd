/**
 * E2E test runner - runs end-to-end scenario tests
 */

import tape from 'tape'
import { glob } from 'glob'
import { pathToFileURL } from 'url'
import { CoreDaemon } from '../../src/index.js'
import { create_daemon_context } from '../lib/helpers/context.js'
import {
  DEFAULT_E2E_TIMEOUT_MS,
  E2E_TEST_PATTERN,
  DEFAULT_TEST_CONFIG
} from '../lib/const.js'
import type {
  E2ERunnerConfig,
  E2EScenario,
  TestResults,
  DaemonTestContext,
  E2EContext
} from '../lib/types/test.types.js'
import { create_reporter, TestReporter } from '../lib/reporters/index.js'

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
    timeout_ms      = DEFAULT_E2E_TIMEOUT_MS,
    glob_pattern    = E2E_TEST_PATTERN,
    bail_on_failure = false,
    reporter        = 'tap'
  } = config

  const testReporter = create_reporter(reporter)
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
  console.log(`Timeout: ${timeout_ms}ms`)
  console.log('')

  // Find test files
  const testFiles = await glob(glob_pattern)

  if (testFiles.length === 0) {
    console.log('No E2E test files found')
    return results
  }

  console.log(`Found ${testFiles.length} E2E test files\n`)

  // Run each test file with its own daemon
  for (const testFile of testFiles) {
    if (bail_on_failure && results.failed > 0) {
      console.log('Bailing due to failure')
      break
    }

    let daemon: CoreDaemon | null = null

    try {
      console.log(`Starting daemon for ${testFile}...`)
      daemon = await CoreDaemon.spawn(DEFAULT_TEST_CONFIG as any)
      const ctx = create_daemon_context(daemon)

      await run_e2e_file(testFile, ctx, timeout_ms, results, testReporter)

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      results.errors.push(error)
      results.failed++
      console.error(`Error in ${testFile}: ${error.message}`)

    } finally {
      if (daemon) {
        console.log('Shutting down daemon...')
        await daemon.shutdown().catch(() => {})
      }
    }
  }

  results.duration = Date.now() - startTime

  // Print summary
  print_summary(results)
  testReporter.summary(results)

  return results
}

/**
 * Run a single E2E test file
 */
async function run_e2e_file(
  filePath : string,
  ctx      : DaemonTestContext,
  timeout  : number,
  results  : TestResults,
  reporter : TestReporter
): Promise<void> {
  const fileUrl = pathToFileURL(filePath).href
  const module = await import(fileUrl)

  // E2E files can export a default test function or multiple scenarios
  if (typeof module.default === 'function') {
    // Single test function
    await run_test_function(filePath, module.default, ctx, timeout, results, reporter)
  } else if (module.scenarios) {
    // Multiple scenarios
    for (const scenario of module.scenarios as E2EScenario[]) {
      await run_scenario(scenario, ctx, timeout, results, reporter)
    }
  } else {
    console.log(`Skipping ${filePath} - no default export or scenarios`)
  }
}

/**
 * Run a test function
 */
async function run_test_function(
  filePath : string,
  testFn   : (t: tape.Test, ctx: DaemonTestContext) => Promise<void>,
  ctx      : DaemonTestContext,
  timeout  : number,
  results  : TestResults,
  reporter : TestReporter
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const testName = filePath.replace(/^test\//, '').replace(/\.e2e\.test\.ts$/, '')

    tape(testName, async (t) => {
      const testStart = Date.now()
      results.total++

      const timeoutId = setTimeout(() => {
        t.fail(`E2E test timed out after ${timeout}ms`)
        t.end()
      }, timeout)

      try {
        await testFn(t, ctx)

        results.passed++
        results.results.push({
          name     : testName,
          passed   : true,
          duration : Date.now() - testStart
        })

        reporter.pass(testName, Date.now() - testStart)

      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        results.failed++
        results.errors.push(error)
        results.results.push({
          name     : testName,
          passed   : false,
          duration : Date.now() - testStart,
          error
        })

        reporter.fail(testName, error, Date.now() - testStart)
        t.fail(error.message)

      } finally {
        clearTimeout(timeoutId)
        t.end()
      }
    })

    tape.onFinish(() => resolve())
    tape.onFailure(() => reject(new Error('E2E test failed')))
  })
}

/**
 * Run an E2E scenario
 */
async function run_scenario(
  scenario : E2EScenario,
  ctx      : DaemonTestContext,
  timeout  : number,
  results  : TestResults,
  reporter : TestReporter
): Promise<void> {
  const scenarioTimeout = scenario.timeout_ms ?? timeout
  const testStart = Date.now()
  results.total++

  const e2eCtx: E2EContext = {
    ...ctx,
    scenario,
    data: {}
  }

  console.log(`Running scenario: ${scenario.name}`)

  try {
    // Run setup
    await Promise.race([
      scenario.setup(e2eCtx),
      timeout_promise(scenarioTimeout, 'setup')
    ])

    // Run execute
    await Promise.race([
      scenario.execute(e2eCtx),
      timeout_promise(scenarioTimeout, 'execute')
    ])

    results.passed++
    results.results.push({
      name     : scenario.name,
      passed   : true,
      duration : Date.now() - testStart
    })

    reporter.pass(scenario.name, Date.now() - testStart)
    console.log(`  PASS (${Date.now() - testStart}ms)`)

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    results.failed++
    results.errors.push(error)
    results.results.push({
      name     : scenario.name,
      passed   : false,
      duration : Date.now() - testStart,
      error
    })

    reporter.fail(scenario.name, error, Date.now() - testStart)
    console.log(`  FAIL: ${error.message}`)

  } finally {
    // Always run teardown
    try {
      await Promise.race([
        scenario.teardown(e2eCtx),
        timeout_promise(10000, 'teardown')
      ])
    } catch {
      // Ignore teardown errors
    }
  }
}

/**
 * Create a timeout promise
 */
function timeout_promise(ms: number, phase: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Scenario ${phase} timed out after ${ms}ms`))
    }, ms)
  })
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
// Scenario Definition Helper
// ============================================================================

/**
 * Define an E2E scenario
 *
 * @example
 * ```typescript
 * export const scenarios = [
 *   define_scenario({
 *     name: 'Multi-wallet transaction',
 *     async setup(ctx) { ... },
 *     async execute(ctx) { ... },
 *     async teardown(ctx) { ... }
 *   })
 * ]
 * ```
 */
export function define_scenario(scenario: E2EScenario): E2EScenario {
  return scenario
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  run_e2e_tests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0)
    })
    .catch(err => {
      console.error('E2E test runner failed:', err)
      process.exit(1)
    })
}

export default run_e2e_tests
