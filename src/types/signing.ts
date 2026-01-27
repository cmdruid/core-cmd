/**
 * External signing types for FROST, MuSig2, DLCs, adaptor signatures
 */

/**
 * Key types for explicit handling
 * - 'segwit': 33-byte compressed public key
 * - 'taproot': 32-byte x-only public key
 */
export type KeyType = 'segwit' | 'taproot'

/**
 * Exported keypair with explicit type information
 */
export interface KeyPair {
  /** Key type: 'segwit' (33-byte compressed) or 'taproot' (32-byte x-only) */
  type        : KeyType
  /** Public key in hex (33 bytes for segwit, 32 bytes for taproot) */
  pubkey      : string
  /** Private key in hex (32 bytes) */
  seckey      : string
  /** BIP32 derivation path */
  path        : string
  /** Master fingerprint */
  fingerprint : string
  /** Original descriptor string */
  descriptor  : string
}

/**
 * Computed sighash for a single input
 */
export interface InputSighash {
  /** Input index */
  index    : number
  /** Sighash bytes (32 bytes) */
  sighash  : Uint8Array
  /** Sighash type flag */
  sigflag  : number
  /** Key type required for signing */
  key_type : KeyType
  /** Public key that must sign (hex) */
  pubkey   : string
}

/**
 * Unsigned transaction ready for external signing
 */
export interface UnsignedTx {
  /** Serialized transaction hex (no signatures) */
  tx_hex     : string
  /** Pre-computed sighashes for each input */
  sighashes  : InputSighash[]
  /** Fee in satoshis */
  fee        : number
  /** Transaction virtual size estimate */
  vsize      : number
}

/**
 * External signature to inject
 */
export interface ExternalSignature {
  /** Input index to sign */
  index     : number
  /** Key type: 'taproot' or 'segwit' */
  key_type  : KeyType
  /** Signature bytes (64-byte Schnorr for taproot, DER for segwit) */
  signature : Uint8Array
  /** Sighash flag (default: SIGHASH_ALL = 0x01) */
  sigflag?  : number
  /** Public key (required for segwit witness) */
  pubkey?   : string
}

/**
 * Options for building transactions
 */
export interface BuildTxOptions {
  /** Fee in satoshis (default: 1000) */
  fee?      : number
  /** Sighash flag for all inputs (default: SIGHASH_ALL | ANYONECANPAY = 0x81) */
  sigflag?  : number
  /** Include change output (default: true) */
  change?   : boolean
}

/**
 * SigningContext state for multi-step signing workflows
 */
export interface SigningContextState {
  /** Transaction being signed */
  tx_hex         : string
  /** Computed sighashes */
  sighashes      : InputSighash[]
  /** Signatures collected so far */
  signatures     : ExternalSignature[]
  /** Inputs that still need signatures */
  pending_inputs : number[]
  /** Debug log entries */
  debug_log      : string[]
}
