/**
 * Test reporters barrel export
 */

import type { TestResults } from '../types/test.types.js'
import { TAPReporter, create_tap_reporter, format_as_tap } from './tap.js'
import { JUnitReporter, create_junit_reporter, format_as_junit, write_junit_file } from './junit.js'

// ============================================================================
// Reporter Interface
// ============================================================================

/**
 * Test reporter interface
 */
export interface TestReporter {
  /** Start the test run */
  start(total?: number): void
  /** Report a passing test */
  pass(name: string, duration?: number): void
  /** Report a failing test */
  fail(name: string, error: Error, duration?: number): void
  /** Report a skipped test */
  skip(name: string, reason?: string): void
  /** Report a TODO test */
  todo(name: string, reason?: string): void
  /** Output a diagnostic message */
  diagnostic(message: string): void
  /** Output the final summary */
  summary(results: TestResults): void
  /** Reset the reporter */
  reset(): void
}

// ============================================================================
// Reporter Types
// ============================================================================

export type ReporterType = 'tap' | 'junit' | 'json'

// ============================================================================
// JSON Reporter
// ============================================================================

/**
 * Simple JSON reporter
 */
export class JSONReporter implements TestReporter {
  private results: Array<{ name: string; status: string; duration?: number; error?: string }> = []

  start(_total?: number): void {
    this.results = []
  }

  pass(name: string, duration?: number): void {
    this.results.push({ name, status: 'pass', duration })
  }

  fail(name: string, error: Error, duration?: number): void {
    this.results.push({ name, status: 'fail', duration, error: error.message })
  }

  skip(name: string, _reason?: string): void {
    this.results.push({ name, status: 'skip' })
  }

  todo(name: string, _reason?: string): void {
    this.results.push({ name, status: 'todo' })
  }

  diagnostic(_message: string): void {
    // No-op for JSON
  }

  summary(results: TestResults): void {
    const output = {
      total    : results.total,
      passed   : results.passed,
      failed   : results.failed,
      skipped  : results.skipped,
      duration : results.duration,
      results  : this.results
    }
    console.log(JSON.stringify(output, null, 2))
  }

  reset(): void {
    this.results = []
  }

  getOutput(results: TestResults): string {
    return JSON.stringify({
      total    : results.total,
      passed   : results.passed,
      failed   : results.failed,
      skipped  : results.skipped,
      duration : results.duration,
      results  : this.results
    }, null, 2)
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a reporter by type
 */
export function create_reporter(type: ReporterType = 'tap'): TestReporter {
  switch (type) {
    case 'tap':
      return create_tap_reporter()
    case 'junit':
      return create_junit_reporter()
    case 'json':
      return new JSONReporter()
    default:
      return create_tap_reporter()
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  TAPReporter,
  create_tap_reporter,
  format_as_tap,
  JUnitReporter,
  create_junit_reporter,
  format_as_junit,
  write_junit_file
}
