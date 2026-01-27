/**
 * Unit tests for SigningContext
 */

import type { TestFunction as TapeTest } from 'tape'
import type { MockTestContext } from '../../../lib/types/test.types.js'
import { SigningContext } from '../../../../src/class/signing.js'
import type {
  ExternalSignature,
  InputSighash,
  UnsignedTx
} from '../../../../src/types/signing.js'

// ============================================================================
// Test Fixtures
// ============================================================================

function create_mock_sighash(index: number, key_type: 'taproot' | 'segwit' = 'taproot'): InputSighash {
  return {
    index,
    sighash  : new Uint8Array(32).fill(index + 1),
    sigflag  : 0x01,
    key_type,
    pubkey   : key_type === 'taproot' ? 'a'.repeat(64) : '02' + 'a'.repeat(64)
  }
}

function create_mock_unsigned_tx(count: number = 2, key_type: 'taproot' | 'segwit' = 'taproot'): UnsignedTx {
  return {
    tx_hex    : '0200000000' + '00'.repeat(100),
    sighashes : Array.from({ length: count }, (_, i) => create_mock_sighash(i, key_type)),
    fee       : 1000,
    vsize     : 200
  }
}

function create_mock_signature(index: number, key_type: 'taproot' | 'segwit' = 'taproot'): ExternalSignature {
  const sig: ExternalSignature = {
    index,
    key_type,
    signature : new Uint8Array(key_type === 'taproot' ? 64 : 71).fill(index + 1)
  }
  if (key_type === 'segwit') {
    sig.pubkey = '02' + 'a'.repeat(64)
  }
  return sig
}

// Mock wallet interface for testing
function create_mock_wallet() {
  let lastSignedTx: UnsignedTx | null = null

  return {
    async add_signature(unsigned: UnsignedTx, _signature: ExternalSignature): Promise<UnsignedTx> {
      // Simulate adding a signature to the tx
      lastSignedTx = {
        ...unsigned,
        tx_hex: unsigned.tx_hex + '01' // Append something to simulate modification
      }
      return lastSignedTx
    },

    async finalize_tx(unsigned: UnsignedTx): Promise<string> {
      return unsigned.tx_hex
    },

    get_last_signed_tx() {
      return lastSignedTx
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

/**
 * SigningContext unit tests
 */
export default function signing_unit_tests(
  tape: TapeTest,
  _ctx: MockTestContext
): void {

  tape('SigningContext - constructor initializes state correctly', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(3)

    const ctx = new SigningContext(wallet, unsigned)

    t.equal(ctx.tx_hex, unsigned.tx_hex, 'tx_hex is set')
    t.equal(ctx.sighashes.length, 3, 'sighashes are stored')
    t.deepEqual(ctx.pending_inputs, [0, 1, 2], 'pending_inputs initialized from sighashes')
    t.equal(ctx.is_complete, false, 'not complete initially')
    t.equal(ctx.is_finalized, false, 'not finalized initially')
    t.equal(ctx.signatures.length, 0, 'no signatures initially')

    t.end()
  })

  tape('SigningContext - pending_inputs returns correct indices', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(3)
    const ctx = new SigningContext(wallet, unsigned)

    t.deepEqual(ctx.pending_inputs, [0, 1, 2], 'all inputs pending initially')

    // Add signature for input 1
    ctx.add_signature(create_mock_signature(1))
    t.deepEqual(ctx.pending_inputs, [0, 2], 'input 1 removed from pending')

    // Add signature for input 0
    ctx.add_signature(create_mock_signature(0))
    t.deepEqual(ctx.pending_inputs, [2], 'inputs 0,1 removed from pending')

    t.end()
  })

  tape('SigningContext - is_complete returns false when signatures pending', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2)
    const ctx = new SigningContext(wallet, unsigned)

    t.equal(ctx.is_complete, false, 'not complete initially')

    ctx.add_signature(create_mock_signature(0))
    t.equal(ctx.is_complete, false, 'not complete with 1 of 2 signatures')

    t.end()
  })

  tape('SigningContext - is_complete returns true when all signed', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2)
    const ctx = new SigningContext(wallet, unsigned)

    ctx.add_signature(create_mock_signature(0))
    ctx.add_signature(create_mock_signature(1))

    t.equal(ctx.is_complete, true, 'complete when all inputs signed')
    t.equal(ctx.pending_inputs.length, 0, 'no pending inputs')

    t.end()
  })

  tape('SigningContext - is_finalized tracks finalization state', async (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(1)
    const ctx = new SigningContext(wallet, unsigned)

    t.equal(ctx.is_finalized, false, 'not finalized initially')

    ctx.add_signature(create_mock_signature(0))
    t.equal(ctx.is_finalized, false, 'not finalized after adding signatures')

    await ctx.finalize()
    t.equal(ctx.is_finalized, true, 'finalized after calling finalize()')

    t.end()
  })

  tape('SigningContext - debug_log captures events', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2)
    const ctx = new SigningContext(wallet, unsigned)

    t.ok(ctx.debug_log.length > 0, 'debug_log has initial entry')
    t.ok(ctx.debug_log[0].includes('Created'), 'initial entry mentions creation')

    ctx.add_signature(create_mock_signature(0))
    t.ok(ctx.debug_log.length > 1, 'debug_log grows')
    t.ok(ctx.debug_log.some(e => e.includes('signature')), 'logs signature addition')

    t.end()
  })

  tape('SigningContext - get_sighash() returns correct sighash by index', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(3)
    const ctx = new SigningContext(wallet, unsigned)

    const sh0 = ctx.get_sighash(0)
    t.ok(sh0, 'found sighash at index 0')
    t.equal(sh0?.index, 0, 'correct index')
    t.equal(sh0?.key_type, 'taproot', 'correct key type')

    const sh2 = ctx.get_sighash(2)
    t.ok(sh2, 'found sighash at index 2')
    t.equal(sh2?.index, 2, 'correct index')

    t.end()
  })

  tape('SigningContext - get_sighash() returns undefined for invalid index', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2)
    const ctx = new SigningContext(wallet, unsigned)

    t.equal(ctx.get_sighash(5), undefined, 'returns undefined for non-existent index')
    t.equal(ctx.get_sighash(-1), undefined, 'returns undefined for negative index')

    t.end()
  })

  tape('SigningContext - get_sighashes_by_type() filters by taproot/segwit', (t) => {
    const wallet = create_mock_wallet()
    // Create mixed inputs
    const unsigned: UnsignedTx = {
      tx_hex    : '0200000000' + '00'.repeat(100),
      sighashes : [
        create_mock_sighash(0, 'taproot'),
        create_mock_sighash(1, 'segwit'),
        create_mock_sighash(2, 'taproot'),
        create_mock_sighash(3, 'segwit')
      ],
      fee       : 1000,
      vsize     : 300
    }
    const ctx = new SigningContext(wallet, unsigned)

    const taprootSigs = ctx.get_sighashes_by_type('taproot')
    t.equal(taprootSigs.length, 2, 'found 2 taproot sighashes')
    t.deepEqual(taprootSigs.map(s => s.index), [0, 2], 'correct taproot indices')

    const segwitSigs = ctx.get_sighashes_by_type('segwit')
    t.equal(segwitSigs.length, 2, 'found 2 segwit sighashes')
    t.deepEqual(segwitSigs.map(s => s.index), [1, 3], 'correct segwit indices')

    t.end()
  })

  tape('SigningContext - add_signature() adds valid signature', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2)
    const ctx = new SigningContext(wallet, unsigned)

    t.equal(ctx.signatures.length, 0, 'no signatures initially')

    const sig = create_mock_signature(0)
    ctx.add_signature(sig)

    t.equal(ctx.signatures.length, 1, 'one signature after adding')
    t.equal(ctx.signatures[0].index, 0, 'correct signature index')

    t.end()
  })

  tape('SigningContext - add_signature() throws on finalized context', async (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(1)
    const ctx = new SigningContext(wallet, unsigned)

    ctx.add_signature(create_mock_signature(0))
    await ctx.finalize()

    try {
      ctx.add_signature(create_mock_signature(0))
      t.fail('should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'threw Error')
      t.ok((err as Error).message.includes('finalized'), 'error mentions finalized')
    }

    t.end()
  })

  tape('SigningContext - add_signature() throws on duplicate signature', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2)
    const ctx = new SigningContext(wallet, unsigned)

    ctx.add_signature(create_mock_signature(0))

    try {
      ctx.add_signature(create_mock_signature(0))
      t.fail('should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'threw Error')
      t.ok((err as Error).message.includes('already added'), 'error mentions duplicate')
    }

    t.end()
  })

  tape('SigningContext - add_signature() throws on key type mismatch', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2, 'taproot')
    const ctx = new SigningContext(wallet, unsigned)

    // Try to add segwit signature to taproot input
    const wrongSig: ExternalSignature = {
      index     : 0,
      key_type  : 'segwit',
      signature : new Uint8Array(71).fill(1),
      pubkey    : '02' + 'a'.repeat(64)
    }

    try {
      ctx.add_signature(wrongSig)
      t.fail('should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'threw Error')
      t.ok((err as Error).message.includes('mismatch'), 'error mentions mismatch')
    }

    t.end()
  })

  tape('SigningContext - add_signature() throws when segwit missing pubkey', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2, 'segwit')
    const ctx = new SigningContext(wallet, unsigned)

    // Segwit signature without pubkey
    const sig: ExternalSignature = {
      index     : 0,
      key_type  : 'segwit',
      signature : new Uint8Array(71).fill(1)
      // No pubkey!
    }

    try {
      ctx.add_signature(sig)
      t.fail('should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'threw Error')
      t.ok((err as Error).message.includes('pubkey'), 'error mentions pubkey')
    }

    t.end()
  })

  tape('SigningContext - finalize() throws when incomplete', async (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2)
    const ctx = new SigningContext(wallet, unsigned)

    // Only add 1 of 2 required signatures
    ctx.add_signature(create_mock_signature(0))

    try {
      await ctx.finalize()
      t.fail('should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'threw Error')
      t.ok((err as Error).message.includes('still need'), 'error mentions incomplete')
    }

    t.end()
  })

  tape('SigningContext - finalize() throws when already finalized', async (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(1)
    const ctx = new SigningContext(wallet, unsigned)

    ctx.add_signature(create_mock_signature(0))
    await ctx.finalize()

    try {
      await ctx.finalize()
      t.fail('should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'threw Error')
      t.ok((err as Error).message.includes('already finalized'), 'error mentions already finalized')
    }

    t.end()
  })

  tape('SigningContext - finalize() returns signed tx hex', async (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2)
    const ctx = new SigningContext(wallet, unsigned)

    ctx.add_signature(create_mock_signature(0))
    ctx.add_signature(create_mock_signature(1))

    const txhex = await ctx.finalize()

    t.ok(typeof txhex === 'string', 'returns string')
    t.ok(txhex.length > 0, 'non-empty string')
    t.equal(ctx.is_finalized, true, 'context is finalized')

    t.end()
  })

  tape('SigningContext - getters return copies (immutable)', (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(2)
    const ctx = new SigningContext(wallet, unsigned)

    // Modify returned arrays
    const pending = ctx.pending_inputs
    pending.push(999)
    t.notDeepEqual(ctx.pending_inputs, pending, 'pending_inputs returns copy')

    const sighashes = ctx.sighashes
    sighashes.push(create_mock_sighash(99))
    t.equal(ctx.sighashes.length, 2, 'sighashes returns copy')

    const debugLog = ctx.debug_log
    debugLog.push('injected')
    t.notOk(ctx.debug_log.includes('injected'), 'debug_log returns copy')

    t.end()
  })

  tape('SigningContext - handles single input case', async (t) => {
    const wallet = create_mock_wallet()
    const unsigned = create_mock_unsigned_tx(1)
    const ctx = new SigningContext(wallet, unsigned)

    t.deepEqual(ctx.pending_inputs, [0], 'single pending input')

    ctx.add_signature(create_mock_signature(0))
    t.equal(ctx.is_complete, true, 'complete after single signature')

    const txhex = await ctx.finalize()
    t.ok(txhex, 'finalized successfully')

    t.end()
  })
}
