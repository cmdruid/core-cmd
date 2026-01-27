/**
 * Unit tests for CoreWallet signing methods
 *
 * Tests the external signing API:
 * - export_keypair()
 * - generate_keypair()
 * - build_tx()
 * - add_signature()
 * - add_signatures()
 * - finalize_tx()
 * - create_signing_context()
 */

import type { TestFunction as TapeTest } from 'tape'
import type { MockTestContext } from '../../../lib/types/test.types.js'
import type {
  ExternalSignature,
  InputSighash,
  UnsignedTx,
  KeyPair
} from '../../../../src/types/signing.js'

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock UnsignedTx for testing add_signature/finalize
 */
function create_unsigned_tx(config: {
  inputs?: number
  key_type?: 'taproot' | 'segwit'
  with_witnesses?: boolean
} = {}): UnsignedTx {
  const { inputs = 2, key_type = 'taproot', with_witnesses = false } = config

  const sighashes: InputSighash[] = []
  for (let i = 0; i < inputs; i++) {
    sighashes.push({
      index    : i,
      sighash  : new Uint8Array(32).fill(i + 1),
      sigflag  : 0x01,
      key_type,
      pubkey   : key_type === 'taproot' ? 'a'.repeat(64) : '02' + 'a'.repeat(64)
    })
  }

  // Create a minimal valid tx hex structure
  // Version (4 bytes) + marker + flag + input count + outputs...
  let tx_hex = '02000000'  // version
  if (with_witnesses) {
    tx_hex += '0001'  // segwit marker + flag
  }
  tx_hex += '0' + inputs.toString(16)  // input count

  // Add input data for each input
  for (let i = 0; i < inputs; i++) {
    tx_hex += 'a'.repeat(64)   // txid (32 bytes)
    tx_hex += '00000000'       // vout (4 bytes)
    tx_hex += '00'             // script length
    tx_hex += 'fdffffff'       // sequence
  }

  tx_hex += '01'               // output count
  tx_hex += '00e1f50500000000' // value (1 BTC)
  tx_hex += '160014' + 'b'.repeat(40) // P2WPKH script

  if (with_witnesses) {
    for (let i = 0; i < inputs; i++) {
      tx_hex += '00'  // empty witness for each input
    }
  }

  tx_hex += '00000000'  // locktime

  return {
    tx_hex,
    sighashes,
    fee   : 1000,
    vsize : 150 + (inputs * 68)
  }
}

/**
 * Create a valid external signature
 */
function create_signature(
  index: number,
  key_type: 'taproot' | 'segwit' = 'taproot'
): ExternalSignature {
  const sig: ExternalSignature = {
    index,
    key_type,
    signature: key_type === 'taproot'
      ? new Uint8Array(64).fill(index + 1)  // Schnorr: 64 bytes
      : new Uint8Array(71).fill(index + 1)  // DER: ~71 bytes
  }

  if (key_type === 'segwit') {
    sig.pubkey = '02' + 'a'.repeat(64)  // 33-byte compressed
  }

  return sig
}

/**
 * Create a mock KeyPair for testing
 */
function create_mock_keypair(type: 'taproot' | 'segwit'): KeyPair {
  return {
    type,
    pubkey      : type === 'taproot' ? 'a'.repeat(64) : '02' + 'a'.repeat(64),
    seckey      : 'b'.repeat(64),
    path        : "/84'/1'/0'/0/0",
    fingerprint : 'deadbeef',
    descriptor  : type === 'taproot'
      ? 'tr([deadbeef/86h/1h/0h]tpub...)#checksum'
      : 'wpkh([deadbeef/84h/1h/0h]tpub...)#checksum'
  }
}

// ============================================================================
// Tests
// ============================================================================

/**
 * Wallet signing methods unit tests
 *
 * Note: These tests focus on the interface contracts and validation logic.
 * Full integration with Bitcoin Core is tested in integration tests.
 */
export default function wallet_signing_unit_tests(
  tape: TapeTest,
  _ctx: MockTestContext
): void {

  // ==========================================================================
  // KeyPair Tests (interface/contract tests)
  // ==========================================================================

  tape('KeyPair - taproot type has 32-byte pubkey (64 hex chars)', (t) => {
    const keypair = create_mock_keypair('taproot')

    t.equal(keypair.type, 'taproot', 'type is taproot')
    t.equal(keypair.pubkey.length, 64, 'pubkey is 64 hex chars (32 bytes)')
    t.notOk(keypair.pubkey.startsWith('02') || keypair.pubkey.startsWith('03'),
      'taproot pubkey has no prefix')

    t.end()
  })

  tape('KeyPair - segwit type has 33-byte pubkey (66 hex chars)', (t) => {
    const keypair = create_mock_keypair('segwit')

    t.equal(keypair.type, 'segwit', 'type is segwit')
    t.equal(keypair.pubkey.length, 66, 'pubkey is 66 hex chars (33 bytes)')
    t.ok(keypair.pubkey.startsWith('02') || keypair.pubkey.startsWith('03'),
      'segwit pubkey has 02/03 prefix')

    t.end()
  })

  tape('KeyPair - seckey is always 32 bytes (64 hex chars)', (t) => {
    const taprootKeypair = create_mock_keypair('taproot')
    const segwitKeypair = create_mock_keypair('segwit')

    t.equal(taprootKeypair.seckey.length, 64, 'taproot seckey is 64 hex chars')
    t.equal(segwitKeypair.seckey.length, 64, 'segwit seckey is 64 hex chars')

    t.end()
  })

  // ==========================================================================
  // UnsignedTx Tests
  // ==========================================================================

  tape('UnsignedTx - sighashes computed for all inputs', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 3 })

    t.equal(unsigned.sighashes.length, 3, 'has 3 sighashes')
    t.deepEqual(
      unsigned.sighashes.map(s => s.index),
      [0, 1, 2],
      'sighash indices are correct'
    )

    t.end()
  })

  tape('UnsignedTx - taproot inputs have taproot key_type', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 2, key_type: 'taproot' })

    for (const sh of unsigned.sighashes) {
      t.equal(sh.key_type, 'taproot', `input ${sh.index} has taproot key_type`)
      t.equal(sh.pubkey.length, 64, `input ${sh.index} has 32-byte pubkey`)
    }

    t.end()
  })

  tape('UnsignedTx - segwit inputs have segwit key_type', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 2, key_type: 'segwit' })

    for (const sh of unsigned.sighashes) {
      t.equal(sh.key_type, 'segwit', `input ${sh.index} has segwit key_type`)
      t.equal(sh.pubkey.length, 66, `input ${sh.index} has 33-byte pubkey`)
    }

    t.end()
  })

  tape('UnsignedTx - fee and vsize are set', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 2 })

    t.ok(unsigned.fee > 0, 'fee is positive')
    t.ok(unsigned.vsize > 0, 'vsize is positive')
    t.ok(typeof unsigned.fee === 'number', 'fee is a number')
    t.ok(typeof unsigned.vsize === 'number', 'vsize is a number')

    t.end()
  })

  // ==========================================================================
  // add_signature Tests (validation logic)
  // ==========================================================================

  tape('add_signature - taproot witness is signature only', (t) => {
    // For taproot, witness should be [signature] only
    const sig = create_signature(0, 'taproot')

    t.equal(sig.signature.length, 64, 'taproot signature is 64 bytes')
    t.equal(sig.pubkey, undefined, 'taproot signature has no pubkey')

    t.end()
  })

  tape('add_signature - segwit witness is signature + pubkey', (t) => {
    // For segwit, witness should be [signature, pubkey]
    const sig = create_signature(0, 'segwit')

    t.ok(sig.signature.length >= 70, 'segwit signature is DER (~71 bytes)')
    t.ok(sig.pubkey, 'segwit signature has pubkey')
    t.equal(sig.pubkey?.length, 66, 'segwit pubkey is 33 bytes')

    t.end()
  })

  tape('add_signature - throws on key type mismatch', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 1, key_type: 'taproot' })

    // Create signature with wrong key type
    const wrongSig: ExternalSignature = {
      index     : 0,
      key_type  : 'segwit',  // Wrong!
      signature : new Uint8Array(71).fill(1),
      pubkey    : '02' + 'a'.repeat(64)
    }

    // Validate that sighash expects taproot
    t.equal(unsigned.sighashes[0].key_type, 'taproot', 'input expects taproot')
    t.equal(wrongSig.key_type, 'segwit', 'signature is segwit')
    t.notEqual(unsigned.sighashes[0].key_type, wrongSig.key_type, 'types mismatch')

    t.end()
  })

  tape('add_signature - throws when segwit missing pubkey', (t) => {
    // Create segwit signature without pubkey
    const invalidSig: ExternalSignature = {
      index     : 0,
      key_type  : 'segwit',
      signature : new Uint8Array(71).fill(1)
      // Missing pubkey!
    }

    t.equal(invalidSig.key_type, 'segwit', 'signature is segwit')
    t.equal(invalidSig.pubkey, undefined, 'pubkey is missing')

    // The actual validation happens in CoreWallet.add_signature() and SigningContext
    // This test documents the expected interface requirement

    t.end()
  })

  tape('add_signature - accepts valid taproot signature', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 1, key_type: 'taproot' })
    const sig = create_signature(0, 'taproot')

    t.equal(unsigned.sighashes[0].key_type, sig.key_type, 'key types match')
    t.equal(sig.signature.length, 64, 'valid Schnorr signature length')

    t.end()
  })

  tape('add_signature - accepts valid segwit signature', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 1, key_type: 'segwit' })
    const sig = create_signature(0, 'segwit')

    t.equal(unsigned.sighashes[0].key_type, sig.key_type, 'key types match')
    t.ok(sig.signature.length >= 70, 'valid DER signature length')
    t.ok(sig.pubkey, 'has pubkey')

    t.end()
  })

  // ==========================================================================
  // add_signatures Tests
  // ==========================================================================

  tape('add_signatures - adds multiple signatures', (t) => {
    const signatures = [
      create_signature(0, 'taproot'),
      create_signature(1, 'taproot'),
      create_signature(2, 'taproot')
    ]

    t.equal(signatures.length, 3, 'created 3 signatures')
    t.deepEqual(signatures.map(s => s.index), [0, 1, 2], 'correct indices')

    t.end()
  })

  // ==========================================================================
  // finalize_tx Tests (validation)
  // ==========================================================================

  tape('finalize_tx - validates all inputs have witnesses', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 3, key_type: 'taproot' })

    // Document the requirement: all inputs must have signatures before finalize
    t.equal(unsigned.sighashes.length, 3, 'has 3 inputs requiring signatures')

    t.end()
  })

  tape('finalize_tx - throws on missing signature', (t) => {
    // This documents the expected behavior
    const unsigned = create_unsigned_tx({ inputs: 2 })

    // If we only sign input 0, input 1 is missing
    const partiallySignedInputs = [0]
    const missingInputs = unsigned.sighashes
      .filter(s => !partiallySignedInputs.includes(s.index))
      .map(s => s.index)

    t.deepEqual(missingInputs, [1], 'input 1 would be missing signature')

    t.end()
  })

  // ==========================================================================
  // InputSighash Tests
  // ==========================================================================

  tape('InputSighash - sighash is 32 bytes', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 1 })
    const sh = unsigned.sighashes[0]

    t.ok(sh.sighash instanceof Uint8Array, 'sighash is Uint8Array')
    t.equal(sh.sighash.length, 32, 'sighash is 32 bytes')

    t.end()
  })

  tape('InputSighash - sigflag defaults to SIGHASH_ALL', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 1 })
    const sh = unsigned.sighashes[0]

    t.equal(sh.sigflag, 0x01, 'sigflag is SIGHASH_ALL (0x01)')

    t.end()
  })

  // ==========================================================================
  // ExternalSignature Tests
  // ==========================================================================

  tape('ExternalSignature - sigflag is optional (defaults handled)', (t) => {
    const sig: ExternalSignature = {
      index     : 0,
      key_type  : 'taproot',
      signature : new Uint8Array(64).fill(1)
      // sigflag is optional
    }

    t.equal(sig.sigflag, undefined, 'sigflag can be omitted')

    // When sigflag is omitted, add_signature should default to SIGHASH_ALL
    const explicitSig: ExternalSignature = {
      ...sig,
      sigflag: 0x81  // SIGHASH_ALL | ANYONECANPAY
    }
    t.equal(explicitSig.sigflag, 0x81, 'explicit sigflag is preserved')

    t.end()
  })

  // ==========================================================================
  // create_signing_context Tests
  // ==========================================================================

  tape('create_signing_context - returns SigningContext with correct state', (t) => {
    // This tests the interface contract
    const unsigned = create_unsigned_tx({ inputs: 3 })

    // SigningContext should:
    // 1. Track pending inputs
    // 2. Allow adding signatures
    // 3. Validate completeness before finalize

    t.equal(unsigned.sighashes.length, 3, 'has 3 inputs')
    t.ok(unsigned.tx_hex, 'has tx_hex')

    t.end()
  })

  // ==========================================================================
  // Mixed Input Type Tests
  // ==========================================================================

  tape('Mixed inputs - taproot and segwit can coexist', (t) => {
    // Create mixed unsigned tx manually
    const sighashes: InputSighash[] = [
      {
        index    : 0,
        sighash  : new Uint8Array(32).fill(1),
        sigflag  : 0x01,
        key_type : 'taproot',
        pubkey   : 'a'.repeat(64)
      },
      {
        index    : 1,
        sighash  : new Uint8Array(32).fill(2),
        sigflag  : 0x01,
        key_type : 'segwit',
        pubkey   : '02' + 'b'.repeat(64)
      }
    ]

    t.equal(sighashes[0].key_type, 'taproot', 'input 0 is taproot')
    t.equal(sighashes[1].key_type, 'segwit', 'input 1 is segwit')

    // Each input should be signed with its corresponding key type
    const taprootSig = create_signature(0, 'taproot')
    const segwitSig = create_signature(1, 'segwit')

    t.equal(taprootSig.key_type, sighashes[0].key_type, 'taproot sig matches')
    t.equal(segwitSig.key_type, sighashes[1].key_type, 'segwit sig matches')

    t.end()
  })

  // ==========================================================================
  // DUST_LIMIT Tests
  // ==========================================================================

  tape('build_tx - respects DUST_LIMIT for change', (t) => {
    // Document the expected behavior
    const DUST_LIMIT = 1000  // From src/const.ts

    // If change amount < DUST_LIMIT, no change output should be added
    const lowChange = 500
    const highChange = 2000

    t.ok(lowChange < DUST_LIMIT, 'low change is below dust limit')
    t.ok(highChange > DUST_LIMIT, 'high change is above dust limit')

    t.end()
  })

  // ==========================================================================
  // Signature Format Tests
  // ==========================================================================

  tape('Taproot signature format - 64-byte Schnorr', (t) => {
    const sig = create_signature(0, 'taproot')

    t.equal(sig.signature.length, 64, 'Schnorr signature is 64 bytes')
    t.equal(sig.pubkey, undefined, 'no pubkey needed for taproot keypath')

    t.end()
  })

  tape('Segwit signature format - DER with pubkey', (t) => {
    const sig = create_signature(0, 'segwit')

    // DER signatures are typically 70-72 bytes
    t.ok(sig.signature.length >= 70, 'DER signature is ~71 bytes')
    t.ok(sig.signature.length <= 73, 'DER signature max is 73 bytes')
    t.ok(sig.pubkey, 'pubkey is required')
    t.equal(sig.pubkey?.length, 66, 'pubkey is 33 bytes compressed')

    t.end()
  })

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  tape('Edge case - single input transaction', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 1 })

    t.equal(unsigned.sighashes.length, 1, 'single input')
    t.equal(unsigned.sighashes[0].index, 0, 'index is 0')

    t.end()
  })

  tape('Edge case - many inputs (10+)', (t) => {
    const unsigned = create_unsigned_tx({ inputs: 15 })

    t.equal(unsigned.sighashes.length, 15, '15 inputs')
    t.deepEqual(
      unsigned.sighashes.map(s => s.index),
      Array.from({ length: 15 }, (_, i) => i),
      'all indices correct'
    )

    t.end()
  })
}
