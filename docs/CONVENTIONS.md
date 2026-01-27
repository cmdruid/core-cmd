# Code Conventions

Coding conventions for the btc-dev Bitcoin development library. Reference this when writing or editing code.

## Quick Reference

| Element | Convention | Example |
|---------|------------|---------|
| Functions | `snake_case` | `encode_address`, `parse_witness`, `create_tx_input` |
| Variables | `snake_case` | `txid`, `witness`, `sequence`, `prevout` |
| Types/Interfaces | `PascalCase` | `TxData`, `AddressInfo`, `SigHashOptions` |
| Constants | `SCREAMING_SNAKE_CASE` | `SIGHASH_DEFAULT`, `COINBASE`, `LOCK_SCRIPT_TYPE` |
| Files | `snake_case.ts` | `encode.ts`, `parse.ts`, `create.ts` |
| Directories | `snake_case` | `address/`, `script/`, `tx/`, `signer/` |

## Naming Conventions

### Functions and Variables

Use `snake_case` for all functions, variables, and object properties:

```typescript
// Functions
export function create_tx_input(config: TxInputTemplate) { }
export function sign_segwit_tx(seckey: string, txdata: TxData) { }

// Variables
const sequence = normalize_sequence(config.sequence)
const witness  = config.witness ?? []
const prevout  = normalize_prevout(config.prevout)
```

### Types and Interfaces

Use `PascalCase` with semantic suffixes:

| Suffix | Purpose | Example |
|--------|---------|---------|
| `Config` | User-provided configuration | `TaprootConfig`, `AddressConfig` |
| `Template` | Input structure for creation | `TxTemplate`, `TxInputTemplate` |
| `Data` | Generic data structure | `TxData`, `TxDecodedData` |
| `Info` | Enriched/parsed information | `AddressInfo`, `ScriptInfo` |
| `Options` | Optional parameters | `SigHashOptions` |

```typescript
// Template (user input for creation)
export interface TxInputTemplate extends TxOutpoint {
  coinbase?   : string   | null
  prevout?    : TxOutput | null
  script_sig? : string   | null
  sequence?   : number
  witness?    : string[]
}

// Data (normalized output)
export interface TxData {
  locktime : number
  vin      : TxInput[]
  vout     : TxOutput[]
  version  : number
}

// Options (configuration for operations)
export interface SigHashOptions {
  extension?     : string
  sigflag?       : number
  txindex?       : number
  pubkey?        : string
  script?        : string
}
```

### Constants

Use `SCREAMING_SNAKE_CASE`:

```typescript
export const SIGHASH_DEFAULT = 0x01
export const TAPLEAF_DEFAULT_VERSION = 0xc0

// Grouped constants use nested objects
export const COINBASE = {
  TXID : '00'.repeat(32),
  VOUT : 0xFFFFFFFF,
}

export const LOCK_SCRIPT_TYPE = {
  P2PKH    : 'p2pkh',
  P2SH     : 'p2sh',
  P2WPKH   : 'p2wpkh',
  P2WSH    : 'p2wsh',
  P2TR     : 'p2tr',
  OPRETURN : 'opreturn',
} as const
```

## API Namespace Pattern

Each module exports a namespace using `export * as NAMESPACE`:

```typescript
// src/index.ts
export * as ADDRESS from './lib/address/index.js'
export * as SCRIPT  from './lib/script/index.js'
export * as SIGNER  from './lib/signer/index.js'
export * as TX      from './lib/tx/index.js'

export * as CONST  from './const.js'
export * as SCHEMA from './schema/index.js'

export type * from './types/index.js'
```

**Usage pattern:**
```typescript
import { ADDRESS, TX, SCRIPT } from '@vbyte/btc-dev'

// Access module functions via namespace
const address_info = ADDRESS.P2PKH.decode(address)
const tx_data      = TX.create_tx(template)
const script_hex   = SCRIPT.encode_script(script)
```

## Import Organization

Three groups in order, with aligned `from` keywords:

```typescript
// 1. External dependencies
import { Buff }            from '@vbyte/buff'
import { Assert }          from '@vbyte/util'
import { ECC }             from '@vbyte/crypto'
import { schnorr }         from '@noble/curves/secp256k1'

// 2. Internal imports (path alias)
import { COINBASE, DEFAULT }   from '@/const.js'
import { parse_tx }            from '@/lib/tx/parse.js'
import { hash_segwit_tx }      from '@/lib/sighash/segwit.js'

// 3. Type imports (separate block)
import type {
  TxData,
  TxInputTemplate,
  SigHashOptions
} from '@/types/index.js'
```

### Path Aliases

| Alias | Resolves To | Used In |
|-------|-------------|---------|
| `@/`  | `src/`      | All code (`src/`, `test/`) |

```typescript
// In src/ files
import { DEFAULT } from '@/const.js'

// In test/ files
import { TX } from '@/index.js'
```

## Export Patterns

```typescript
// Flat re-exports in index.ts
export * from './encode.js'
export * from './decode.js'
export * from './parse.js'

// Namespaced exports for modules
export * as SCHEMA from './schema/index.js'

// Type-only exports
export type * from './types/index.js'
```

## Error Handling

### Assertions

Use `Assert` from `@vbyte/util`:

```typescript
import { Assert } from '@vbyte/util'

Assert.exists(config.prevout, 'prevout is required')
Assert.is_empty(config.coinbase, 'coinbase is not allowed')
```

### Zod Validation

Use Zod schemas for runtime validation:

```typescript
import { z } from 'zod'

export const tx_output = z.object({
  value     : z.bigint().min(0n).max(2_100_000_000_000_000n),
  script_pk : hex,
}) satisfies z.ZodType<TxOutput>

export const tx_input = z.object({
  coinbase   : hex.nullable(),
  txid       : hex32,
  vout       : uint,
  prevout    : tx_output.nullable(),
  script_sig : hex.nullable(),
  sequence   : uint,
  witness    : z.array(hex)
})
```

## Formatting

### Vertical Alignment

Align colons in interfaces, objects, and parameters:

```typescript
// Interface properties
export interface TxSize {
  base   : number
  total  : number
  vsize  : number
  weight : number
}

// Function parameters
export function sign_segwit_tx (
  seckey  : string,
  txdata  : TxData,
  options : SigHashOptions,
) : string { }

// Object literals
const input = {
  txid       : config.txid,
  vout       : config.vout,
  prevout    : normalize_prevout(config.prevout),
  sequence   : normalize_sequence(config.sequence),
  witness    : config.witness ?? []
}
```

### Indentation

- 2 spaces (no tabs)
- Multi-line parameters aligned

### Numbers

Use underscores for readability:

```typescript
const MAX_SATS = 2_100_000_000_000_000n
const TIMEOUT_MS = 30_000
```

### File Extensions

Always use `.js` in imports (ES module compatibility):

```typescript
import { DEFAULT } from '@/const.js'
import type { TxData } from '../types/index.js'
```

## Domain Abbreviations

| Abbrev | Meaning |
|--------|---------|
| `psbt` | Partially Signed Bitcoin Transaction |
| `txid` | Transaction ID (hex string) |
| `utxo` | Unspent Transaction Output |
| `sats` | Satoshis (1 BTC = 100,000,000 sats) |
| `vout` | Output index in transaction |
| `vin` | Input index in transaction |
| `tx` | Transaction |
| `sig` | Signature |
| `seckey` | Secret/private key |
| `pubkey` | Public key |
| `script_pk` | Script pubkey (locking script) |
| `script_sig` | Script signature (unlocking script) |
| `prevout` | Previous output (spent by input) |
| `segwit` | Segregated Witness |
| `taproot` | Taproot (BIP340/341/342) |

## Comments

- Explain "why" not "what"
- Use `//` with space, sentence case
- JSDoc for exported functions

```typescript
/**
 * Sign a transaction input using segwit (BIP143) signature hashing.
 * @param seckey  - 32-byte secret key as hex string (64 characters)
 * @param txdata  - Transaction data
 * @param options - Sighash options including txindex, sigflag, pubkey/script
 * @returns ECDSA signature with sighash flag appended
 * @throws Error if secret key format is invalid
 */
export function sign_segwit_tx (
  seckey  : string,
  txdata  : TxData,
  options : SigHashOptions,
) {
  // Validate inputs before processing.
  validate_seckey(seckey)
  validate_sighash_options(options, SIGHASH_SEGWIT)
  // Hash and sign the transaction.
  const tx  = parse_tx(txdata)
  const msg = hash_segwit_tx(tx, options)
  return ECC.sign_ecdsa(seckey, msg).hex + format_sigflag(options.sigflag)
}
```
