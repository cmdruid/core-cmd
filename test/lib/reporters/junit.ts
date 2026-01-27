/**
 * JUnit XML reporter for CI systems
 */

import type { TestResults, TestResult } from '../types/test.types.js'
import type { TestReporter } from './index.js'

// ============================================================================
// JUnit Reporter
// ============================================================================

/**
 * JUnit XML format reporter
 *
 * Outputs test results in JUnit XML format for CI systems
 * like Jenkins, GitHub Actions, GitLab CI, etc.
 */
export class JUnitReporter implements TestReporter {
  private results: TestResult[] = []
  private suiteName: string
  private startTime: Date

  constructor(suiteName: string = 'core-cmd') {
    this.suiteName = suiteName
    this.startTime = new Date()
  }

  /**
   * Start the test run
   */
  start(_total?: number): void {
    this.startTime = new Date()
    this.results = []
  }

  /**
   * Report a passing test
   */
  pass(name: string, duration?: number): void {
    this.results.push({
      name,
      passed   : true,
      duration : duration ?? 0
    })
  }

  /**
   * Report a failing test
   */
  fail(name: string, error: Error, duration?: number): void {
    this.results.push({
      name,
      passed   : false,
      duration : duration ?? 0,
      error
    })
  }

  /**
   * Report a skipped test
   */
  skip(name: string, _reason?: string): void {
    this.results.push({
      name,
      passed   : true,
      duration : 0,
      skipped  : true
    })
  }

  /**
   * Report a TODO test
   */
  todo(name: string, _reason?: string): void {
    this.results.push({
      name,
      passed   : true,
      duration : 0,
      skipped  : true
    })
  }

  /**
   * Output a diagnostic message (no-op for JUnit)
   */
  diagnostic(_message: string): void {
    // JUnit doesn't have diagnostics
  }

  /**
   * Output the final summary
   */
  summary(results: TestResults): void {
    const xml = this.formatXML(results)
    console.log(xml)
  }

  /**
   * Get the XML output
   */
  getOutput(results: TestResults): string {
    return this.formatXML(results)
  }

  /**
   * Reset the reporter
   */
  reset(): void {
    this.results = []
    this.startTime = new Date()
  }

  /**
   * Format results as JUnit XML
   */
  private formatXML(results: TestResults): string {
    const timestamp = this.startTime.toISOString()
    const time = (results.duration / 1000).toFixed(3)

    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuites name="${escape_xml(this.suiteName)}" tests="${results.total}" failures="${results.failed}" errors="0" skipped="${results.skipped}" time="${time}">`,
      `  <testsuite name="${escape_xml(this.suiteName)}" tests="${results.total}" failures="${results.failed}" errors="0" skipped="${results.skipped}" time="${time}" timestamp="${timestamp}">`
    ]

    for (const result of results.results) {
      const testTime = ((result.duration ?? 0) / 1000).toFixed(3)
      const className = this.suiteName
      const testName = escape_xml(result.name)

      if (result.skipped) {
        lines.push(`    <testcase name="${testName}" classname="${className}" time="${testTime}">`)
        lines.push('      <skipped/>')
        lines.push('    </testcase>')
      } else if (result.passed) {
        lines.push(`    <testcase name="${testName}" classname="${className}" time="${testTime}"/>`)
      } else {
        lines.push(`    <testcase name="${testName}" classname="${className}" time="${testTime}">`)
        if (result.error) {
          const message = escape_xml(result.error.message)
          const stack = result.error.stack ? escape_xml(result.error.stack) : ''
          lines.push(`      <failure message="${message}" type="${result.error.constructor.name}">`)
          if (stack) {
            lines.push(stack)
          }
          lines.push('      </failure>')
        } else {
          lines.push('      <failure message="Test failed"/>')
        }
        lines.push('    </testcase>')
      }
    }

    lines.push('  </testsuite>')
    lines.push('</testsuites>')

    return lines.join('\n')
  }
}

/**
 * Escape XML special characters
 */
function escape_xml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Create a JUnit reporter
 */
export function create_junit_reporter(suiteName?: string): JUnitReporter {
  return new JUnitReporter(suiteName)
}

/**
 * Format results as JUnit XML string
 */
export function format_as_junit(
  results   : TestResults,
  suiteName : string = 'core-cmd'
): string {
  const reporter = new JUnitReporter(suiteName)
  return reporter.getOutput(results)
}

/**
 * Write JUnit XML to a file
 */
export async function write_junit_file(
  results  : TestResults,
  filePath : string,
  suiteName?: string
): Promise<void> {
  const { writeFile } = await import('fs/promises')
  const xml = format_as_junit(results, suiteName)
  await writeFile(filePath, xml, 'utf-8')
}

export default JUnitReporter
