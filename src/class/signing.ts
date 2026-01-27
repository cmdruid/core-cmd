import type {
  ExternalSignature,
  InputSighash,
  KeyType,
  SigningContextState,
  UnsignedTx
} from '../types/signing.js'

// Forward reference to avoid circular import
// The actual CoreWallet type will be inferred at runtime
interface WalletInterface {
  add_signature(unsigned: UnsignedTx, signature: ExternalSignature): Promise<UnsignedTx>
  finalize_tx(unsigned: UnsignedTx): Promise<string>
}

/**
 * SigningContext for multi-step signing workflows
 *
 * Provides state management and debugging for external signing protocols
 * like FROST, MuSig2, DLCs, and adaptor signatures.
 *
 * @example
 * const ctx = await wallet.create_signing_context(template)
 *
 * // Inspect what needs signing
 * ctx.pending_inputs  // [0, 1, 2]
 * ctx.get_sighash(0)  // InputSighash for input 0
 *
 * // Sign externally and add signatures
 * ctx.add_signature({ index: 0, key_type: 'taproot', signature: sig1 })
 * ctx.add_signature({ index: 1, key_type: 'taproot', signature: sig2 })
 *
 * // Debug log
 * ctx.debug_log  // ['Created context', 'Added sig for input 0', ...]
 *
 * // Finalize when ready
 * const txhex = await ctx.finalize()
 */
export class SigningContext {
  private _state     : SigningContextState
  private _wallet    : WalletInterface
  private _finalized : boolean = false

  constructor(wallet: WalletInterface, unsigned: UnsignedTx) {
    this._wallet = wallet
    this._state = {
      tx_hex         : unsigned.tx_hex,
      sighashes      : unsigned.sighashes,
      signatures     : [],
      pending_inputs : unsigned.sighashes.map(s => s.index),
      debug_log      : [`Created SigningContext with ${unsigned.sighashes.length} inputs`]
    }
  }

  // ============================================================
  // Getters
  // ============================================================

  /** Inputs still awaiting signatures */
  get pending_inputs(): number[] {
    return [...this._state.pending_inputs]
  }

  /** Check if all inputs are signed */
  get is_complete(): boolean {
    return this._state.pending_inputs.length === 0
  }

  /** Check if context is finalized */
  get is_finalized(): boolean {
    return this._finalized
  }

  /** Debug log entries */
  get debug_log(): string[] {
    return [...this._state.debug_log]
  }

  /** All sighashes */
  get sighashes(): InputSighash[] {
    return [...this._state.sighashes]
  }

  /** Current transaction hex */
  get tx_hex(): string {
    return this._state.tx_hex
  }

  /** Signatures collected so far */
  get signatures(): ExternalSignature[] {
    return [...this._state.signatures]
  }

  // ============================================================
  // Methods
  // ============================================================

  /** Get sighash for specific input */
  get_sighash(index: number): InputSighash | undefined {
    return this._state.sighashes.find(s => s.index === index)
  }

  /** Get all sighashes of a specific key type */
  get_sighashes_by_type(type: KeyType): InputSighash[] {
    return this._state.sighashes.filter(s => s.key_type === type)
  }

  /** Add signature for an input */
  add_signature(sig: ExternalSignature): void {
    if (this._finalized) {
      throw new Error('SigningContext is already finalized')
    }

    const sighash = this._state.sighashes.find(s => s.index === sig.index)
    if (!sighash) {
      throw new Error(`No input at index ${sig.index}`)
    }

    // Check for duplicate
    if (this._state.signatures.some(s => s.index === sig.index)) {
      throw new Error(`Signature already added for input ${sig.index}`)
    }

    // Validate key type matches
    if (sighash.key_type !== sig.key_type) {
      throw new Error(`Key type mismatch: input ${sig.index} expects ${sighash.key_type}, got ${sig.key_type}`)
    }

    // Validate segwit requires pubkey
    if (sig.key_type === 'segwit' && !sig.pubkey) {
      throw new Error(`SegWit input ${sig.index} requires pubkey in signature`)
    }

    this._state.signatures.push(sig)
    this._state.pending_inputs = this._state.pending_inputs.filter(i => i !== sig.index)
    this._log(`Added signature for input ${sig.index} (${sig.key_type})`)
  }

  /** Finalize and return signed transaction hex */
  async finalize(): Promise<string> {
    if (this._finalized) {
      throw new Error('SigningContext is already finalized')
    }

    if (!this.is_complete) {
      throw new Error(`Cannot finalize: inputs ${this.pending_inputs.join(', ')} still need signatures`)
    }

    // Apply all signatures to the transaction
    let unsigned: UnsignedTx = {
      tx_hex    : this._state.tx_hex,
      sighashes : this._state.sighashes,
      fee       : 0,
      vsize     : 0
    }

    for (const sig of this._state.signatures) {
      unsigned = await this._wallet.add_signature(unsigned, sig)
    }

    const txhex = await this._wallet.finalize_tx(unsigned)

    this._finalized = true
    this._log('Finalized transaction')

    return txhex
  }

  /** Internal logging */
  private _log(message: string): void {
    const timestamp = new Date().toISOString()
    this._state.debug_log.push(`[${timestamp}] ${message}`)
  }
}
