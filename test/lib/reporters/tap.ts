/**
 * TAP (Test Anything Protocol) reporter
 */

import type { TestResults, TestResult } from '../types/test.types.js'
import type { TestReporter } from './index.js'

// ============================================================================
// TAP Reporter
// ============================================================================

/**
 * TAP format reporter
 *
 * Outputs test results in TAP format for compatibility with
 * various test harnesses and CI systems.
 */
export class TAPReporter implements TestReporter {
  private testCount = 0
  private outputLines: string[] = []

  /**
   * Start the test run
   */
  start(total?: number): void {
    if (total !== undefined) {
      this.output(`1..${total}`)
    }
  }

  /**
   * Report a passing test
   */
  pass(name: string, duration?: number): void {
    this.testCount++
    const durationStr = duration !== undefined ? ` # time=${duration}ms` : ''
    this.output(`ok ${this.testCount} - ${name}${durationStr}`)
  }

  /**
   * Report a failing test
   */
  fail(name: string, error: Error, duration?: number): void {
    this.testCount++
    const durationStr = duration !== undefined ? ` # time=${duration}ms` : ''
    this.output(`not ok ${this.testCount} - ${name}${durationStr}`)
    this.output('  ---')
    this.output(`  message: ${error.message}`)
    if (error.stack) {
      this.output('  stack: |')
      for (const line of error.stack.split('\n').slice(1, 5)) {
        this.output(`    ${line.trim()}`)
      }
    }
    this.output('  ...')
  }

  /**
   * Report a skipped test
   */
  skip(name: string, reason?: string): void {
    this.testCount++
    const reasonStr = reason ? ` - ${reason}` : ''
    this.output(`ok ${this.testCount} - ${name} # SKIP${reasonStr}`)
  }

  /**
   * Report a test that's still running (TODO)
   */
  todo(name: string, reason?: string): void {
    this.testCount++
    const reasonStr = reason ? ` - ${reason}` : ''
    this.output(`not ok ${this.testCount} - ${name} # TODO${reasonStr}`)
  }

  /**
   * Output a diagnostic message
   */
  diagnostic(message: string): void {
    this.output(`# ${message}`)
  }

  /**
   * Output the final summary
   */
  summary(results: TestResults): void {
    this.output('')
    this.output(`# tests ${results.total}`)
    this.output(`# pass  ${results.passed}`)
    this.output(`# fail  ${results.failed}`)
    this.output(`# skip  ${results.skipped}`)
    this.output('')
    this.output(`# ${results.failed === 0 ? 'ok' : 'not ok'}`)
  }

  /**
   * Get the full TAP output
   */
  getOutput(): string {
    return this.outputLines.join('\n')
  }

  /**
   * Reset the reporter
   */
  reset(): void {
    this.testCount = 0
    this.outputLines = []
  }

  private output(line: string): void {
    this.outputLines.push(line)
    console.log(line)
  }
}

/**
 * Create a TAP reporter
 */
export function create_tap_reporter(): TAPReporter {
  return new TAPReporter()
}

/**
 * Format results as TAP string
 */
export function format_as_tap(results: TestResults): string {
  const lines: string[] = []

  lines.push(`1..${results.total}`)

  let count = 0
  for (const result of results.results) {
    count++
    const durationStr = result.duration !== undefined ? ` # time=${result.duration}ms` : ''

    if (result.skipped) {
      lines.push(`ok ${count} - ${result.name} # SKIP`)
    } else if (result.passed) {
      lines.push(`ok ${count} - ${result.name}${durationStr}`)
    } else {
      lines.push(`not ok ${count} - ${result.name}${durationStr}`)
      if (result.error) {
        lines.push('  ---')
        lines.push(`  message: ${result.error.message}`)
        lines.push('  ...')
      }
    }
  }

  lines.push('')
  lines.push(`# tests ${results.total}`)
  lines.push(`# pass  ${results.passed}`)
  lines.push(`# fail  ${results.failed}`)
  lines.push(`# skip  ${results.skipped}`)
  lines.push('')
  lines.push(`# ${results.failed === 0 ? 'ok' : 'not ok'}`)

  return lines.join('\n')
}

export default TAPReporter
