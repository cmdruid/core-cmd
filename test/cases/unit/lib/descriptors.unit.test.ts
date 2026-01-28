/**
 * Unit tests for descriptor parsing functions
 */

import type { TapeHarness, MockTestContext } from '../../../lib/types/test.types.js'
import { parse_descriptor, parse_segment, parse_desc_item } from '../../../../src/lib/descriptors.js'
import {
  VALID_DESCRIPTORS,
  MAINNET_DESCRIPTORS,
  INVALID_DESCRIPTORS,
  INVALID_SEGMENTS,
  EXPECTED_PARSE_RESULTS,
  create_descriptor_item_fixture,
  create_descriptor_fixture
} from '../../../lib/fixtures/descriptor.fixture.js'

export default function descriptors_unit_tests(
  tape: TapeHarness,
  _ctx: MockTestContext
): void {
  // =========================================================================
  // parse_segment Tests
  // =========================================================================

  tape('parse_segment - non-hardened segments', (t) => {
    t.equal(parse_segment('0'), 0, 'Parses 0')
    t.equal(parse_segment('1'), 1, 'Parses 1')
    t.equal(parse_segment('44'), 44, 'Parses 44')
    t.equal(parse_segment('84'), 84, 'Parses 84')
    t.equal(parse_segment('1000'), 1000, 'Parses large number')
    t.end()
  })

  tape('parse_segment - hardened segments with apostrophe', (t) => {
    t.equal(parse_segment("0'"), -0, "Parses 0'")
    t.equal(parse_segment("44'"), -44, "Parses 44'")
    t.equal(parse_segment("84'"), -84, "Parses 84'")
    t.equal(parse_segment("86'"), -86, "Parses 86'")
    t.end()
  })

  tape('parse_segment - hardened segments with h', (t) => {
    t.equal(parse_segment('0h'), -0, 'Parses 0h')
    t.equal(parse_segment('44h'), -44, 'Parses 44h')
    t.equal(parse_segment('84h'), -84, 'Parses 84h')
    t.equal(parse_segment('86h'), -86, 'Parses 86h')
    t.end()
  })

  tape('parse_segment - invalid segments throw', (t) => {
    for (const segment of INVALID_SEGMENTS) {
      try {
        parse_segment(segment)
        t.fail(`Should have thrown for segment: "${segment}"`)
      } catch (err) {
        t.ok(err instanceof Error, `Throws for invalid segment: "${segment}"`)
      }
    }
    t.end()
  })

  // =========================================================================
  // parse_descriptor Tests - Basic Parsing
  // =========================================================================

  tape('parse_descriptor - wpkh descriptor', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.equal(result.keytype, 'wpkh', 'Key type is wpkh')
    t.ok(result.keystr.startsWith('tpub'), 'Key string is tpub')
    t.ok(result.checksum, 'Has checksum')
    t.equal(result.is_extended, true, 'Is extended key')
    t.equal(result.is_private, false, 'Is not private')
    t.equal(result.purpose, -84, 'Purpose is 84 hardened')
    t.end()
  })

  tape('parse_descriptor - taproot descriptor', (t) => {
    const desc = VALID_DESCRIPTORS.tr
    const result = parse_descriptor(desc)

    t.equal(result.keytype, 'tr', 'Key type is tr')
    t.equal(result.is_extended, true, 'Is extended key')
    t.equal(result.is_private, false, 'Is not private')
    t.equal(result.purpose, -86, 'Purpose is 86 hardened')
    t.end()
  })

  tape('parse_descriptor - pkh descriptor', (t) => {
    const desc = VALID_DESCRIPTORS.pkh
    const result = parse_descriptor(desc)

    t.equal(result.keytype, 'pkh', 'Key type is pkh')
    t.equal(result.is_extended, true, 'Is extended key')
    t.equal(result.purpose, -44, 'Purpose is 44 hardened')
    t.end()
  })

  tape('parse_descriptor - nested sh-wpkh descriptor', (t) => {
    const desc = VALID_DESCRIPTORS.sh_wpkh
    const result = parse_descriptor(desc)

    t.equal(result.keytype, 'sh-wpkh', 'Key type is sh-wpkh')
    t.equal(result.is_extended, true, 'Is extended key')
    t.equal(result.purpose, -49, 'Purpose is 49 hardened')
    t.end()
  })

  // =========================================================================
  // parse_descriptor Tests - Path Extraction
  // =========================================================================

  tape('parse_descriptor - extracts full path', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.ok(result.fullpath.includes("84'"), 'Full path includes purpose')
    t.ok(result.fullpath.includes("1'"), 'Full path includes network')
    t.ok(result.fullpath.includes("0'"), 'Full path includes account')
    t.end()
  })

  tape('parse_descriptor - extracts parent label', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.equal(result.parent_label, 'd34db33f', 'Extracts parent label (fingerprint)')
    t.end()
  })

  tape('parse_descriptor - extracts relative path', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.ok(result.relpath.includes('/0/0'), 'Relative path includes derivation')
    t.end()
  })

  tape('parse_descriptor - extracts index', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.equal(result.index, 0, 'Index is 0')
    t.end()
  })

  // =========================================================================
  // parse_descriptor Tests - Extended Key Detection
  // =========================================================================

  tape('parse_descriptor - detects tpub as extended', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.equal(result.is_extended, true, 'tpub is extended')
    t.ok(result.extkey !== undefined, 'Has extkey')
    t.end()
  })

  tape('parse_descriptor - detects xpub as extended', (t) => {
    const desc = MAINNET_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.equal(result.is_extended, true, 'xpub is extended')
    t.end()
  })

  tape('parse_descriptor - detects tprv as private', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh_private
    const result = parse_descriptor(desc)

    t.equal(result.is_private, true, 'tprv is private')
    t.equal(result.is_extended, true, 'tprv is extended')
    t.end()
  })

  // =========================================================================
  // parse_descriptor Tests - Label Generation
  // =========================================================================

  tape('parse_descriptor - generates label from pubkey hash', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.ok(result.label, 'Has label')
    t.equal(result.label.length, 8, 'Label is 8 hex chars (4 bytes)')
    t.ok(/^[0-9a-f]+$/i.test(result.label), 'Label is hex')
    t.end()
  })

  // =========================================================================
  // parse_descriptor Tests - Network Detection
  // =========================================================================

  tape('parse_descriptor - testnet descriptor', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.equal(result.network, -1, 'Network is 1 hardened (testnet)')
    t.end()
  })

  tape('parse_descriptor - mainnet descriptor', (t) => {
    const desc = MAINNET_DESCRIPTORS.wpkh
    const result = parse_descriptor(desc)

    t.equal(result.network, -0, 'Network is 0 hardened (mainnet)')
    t.end()
  })

  // =========================================================================
  // parse_descriptor Tests - Invalid Descriptors
  // =========================================================================

  tape('parse_descriptor - throws on invalid format', (t) => {
    for (const invalid of INVALID_DESCRIPTORS.slice(0, 3)) {
      try {
        parse_descriptor(invalid)
        t.fail(`Should have thrown for: "${invalid}"`)
      } catch (err) {
        t.ok(err instanceof Error, `Throws for invalid: "${invalid}"`)
      }
    }
    t.end()
  })

  tape('parse_descriptor - throws on missing checksum', (t) => {
    const noChecksum = "wpkh([d34db33f/84'/1'/0']tpubDCxzhZzGfRLdJc6P4FUFKv3u8WKVYgBkdqxU4KMNRkNwPFnLqNTMF9jUjRPWYaWBiN7Jm3g2D6b4mPSQyCLwRk5jgsNXvLz7gZmhD9zBkNA/0/0)"

    try {
      parse_descriptor(noChecksum)
      t.fail('Should have thrown for missing checksum')
    } catch (err) {
      t.ok(err instanceof Error, 'Throws for missing checksum')
    }
    t.end()
  })

  // =========================================================================
  // parse_desc_item Tests
  // =========================================================================

  tape('parse_desc_item - merges descriptor item with parsed data', (t) => {
    const item = create_descriptor_item_fixture('wpkh')
    const result = parse_desc_item(item)

    // Should have both item fields and parsed fields
    t.equal(result.timestamp, item.timestamp, 'Has timestamp from item')
    t.equal(result.active, item.active, 'Has active from item')
    t.equal(result.internal, item.internal, 'Has internal from item')
    t.deepEqual(result.range, item.range, 'Has range from item')
    t.equal(result.next, item.next, 'Has next from item')

    // Should have parsed fields
    t.ok(result.keytype, 'Has keytype from parse')
    t.ok(result.keystr, 'Has keystr from parse')
    t.ok(result.checksum, 'Has checksum from parse')
    t.end()
  })

  tape('parse_desc_item - works with different key types', (t) => {
    const wpkhItem = create_descriptor_item_fixture('wpkh')
    const trItem = create_descriptor_item_fixture('tr')
    const pkhItem = create_descriptor_item_fixture('pkh')

    const wpkhResult = parse_desc_item(wpkhItem)
    const trResult = parse_desc_item(trItem)
    const pkhResult = parse_desc_item(pkhItem)

    t.equal(wpkhResult.keytype, 'wpkh', 'Parses wpkh item')
    t.equal(trResult.keytype, 'tr', 'Parses tr item')
    t.equal(pkhResult.keytype, 'pkh', 'Parses pkh item')
    t.end()
  })

  // =========================================================================
  // parse_descriptor Tests - Edge Cases
  // =========================================================================

  tape('parse_descriptor - handles wildcard index', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh_wildcard
    const result = parse_descriptor(desc)

    t.equal(result.index, 0, 'Wildcard defaults to index 0')
    t.end()
  })

  tape('parse_descriptor - normalizes h to apostrophe', (t) => {
    // Create descriptor with 'h' notation using create_descriptor_fixture
    const desc = create_descriptor_fixture('wpkh').replace(/'/g, 'h')
    const result = parse_descriptor(desc)

    // Path should be normalized to apostrophe notation
    t.ok(result.fullpath.includes("'"), "Path normalized to use apostrophe")
    t.notOk(result.fullpath.includes('h'), "Path does not contain 'h'")
    t.end()
  })

  tape('parse_descriptor - consistent output for same input', (t) => {
    const desc = VALID_DESCRIPTORS.wpkh
    const result1 = parse_descriptor(desc)
    const result2 = parse_descriptor(desc)

    t.equal(result1.keytype, result2.keytype, 'Keytype consistent')
    t.equal(result1.keystr, result2.keystr, 'Keystr consistent')
    t.equal(result1.checksum, result2.checksum, 'Checksum consistent')
    t.equal(result1.fullpath, result2.fullpath, 'Fullpath consistent')
    t.equal(result1.label, result2.label, 'Label consistent')
    t.end()
  })

  // =========================================================================
  // Expected Parse Results Validation
  // =========================================================================

  tape('parse_descriptor - wpkh matches expected results', (t) => {
    const result = parse_descriptor(VALID_DESCRIPTORS.wpkh)
    const expected = EXPECTED_PARSE_RESULTS.wpkh

    t.equal(result.keytype, expected.keytype, 'Keytype matches')
    t.equal(result.is_extended, expected.is_extended, 'is_extended matches')
    t.equal(result.is_private, expected.is_private, 'is_private matches')
    t.equal(result.purpose, expected.purpose, 'Purpose matches')
    t.end()
  })

  tape('parse_descriptor - tr matches expected results', (t) => {
    const result = parse_descriptor(VALID_DESCRIPTORS.tr)
    const expected = EXPECTED_PARSE_RESULTS.tr

    t.equal(result.keytype, expected.keytype, 'Keytype matches')
    t.equal(result.is_extended, expected.is_extended, 'is_extended matches')
    t.equal(result.is_private, expected.is_private, 'is_private matches')
    t.equal(result.purpose, expected.purpose, 'Purpose matches')
    t.end()
  })
}
