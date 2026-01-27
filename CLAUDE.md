# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Run full test suite (requires Bitcoin Core)
npm test

# Run unit tests only (no Bitcoin Core needed)
npm run test:unit

# Run integration tests (requires Bitcoin Core)
npm run test:integration

# Run development/scratch file for testing
npm run scratch

# Clean build artifacts
npm run clean

# Full release cycle (clean, test, build)
npm run release

# Run a single test file
tsx test/cases/unit/class/specific.unit.test.ts

# Run tests with debug output
DEBUG=true npm test
```

## Architecture Overview

This is a TypeScript library for automating Bitcoin Core operations, designed for CI/CD testing environments. The architecture follows a three-layer pattern:

### Core Components Relationship

1. **CoreDaemon** (`src/class/core.ts`) - Process lifecycle manager
   - Spawns or connects to existing Bitcoin Core process
   - Manages initialization with faucet wallet
   - Uses state machine for lifecycle tracking
   - Emits 'ready' event when initialized
   - Handles graceful shutdown
   - Manages event bus (ZMQ or Polling)

2. **CoreClient** (`src/class/client.ts`) - RPC communication layer
   - Executes bitcoin-cli commands via `cmd()` method
   - Implements command caching for performance
   - Provides high-level methods wrapping RPC calls (snake_case naming)
   - Manages wallet loading/creation

3. **CoreWallet** (`src/class/wallet.ts`) - Wallet abstraction
   - Transaction building with `fund_tx()` and `build_tx()`
   - External signing API with `export_keypair()`, `add_signature()`
   - UTXO management and address generation
   - Automatic balance ensuring with `ensure_funds()`
   - Integrates with @vbyte/btc-dev for script handling

4. **SigningContext** (`src/class/signing.ts`) - Multi-step signing workflows
   - State management for external signing protocols
   - Supports FROST, MuSig2, DLCs, adaptor signatures
   - Debug logging for signature collection

### Critical Implementation Details

- **Import Convention**: Always use `.js` extension for local imports even though files are `.ts`
- **Network Modes**: Default is `regtest` for testing. Production uses `main` or `test`
- **Process Isolation**: Use `isolated: true` to avoid port conflicts with existing Bitcoin Core
- **Error Handling**: Custom error classes in `src/class/errors.ts`. Methods return `null` for missing data, throw for critical errors
- **Type System**: All RPC responses have TypeScript interfaces in `src/types/`
- **Naming Convention**: All public methods use snake_case.

## API Patterns (v2)

### Daemon Initialization

```typescript
// Preferred: Static factory methods
const daemon = await CoreDaemon.spawn(config)   // Spawn new process
const daemon = await CoreDaemon.connect(config) // Connect to existing
const daemon = await CoreDaemon.auto(config)    // Connect if running, spawn if not

// Check if Bitcoin Core is running
const running = await CoreDaemon.exists()              // Checks bitcoind and bitcoin-qt
const daemon_running = await CoreDaemon.exists('bitcoind')  // Check specific process
```

### Client Methods (snake_case)

```typescript
const blocks = await client.get_block_count()
const wallets = await client.get_loaded_wallets()
const tx = await client.get_tx(txid)
await client.mine_blocks(10, address)
```

### Wallet Methods (snake_case)

```typescript
const balance = await wallet.get_balance()
const address = await wallet.generate_address()
const utxos = await wallet.list_utxos()
await wallet.send_funds(amount, address)
```

### Transaction Flow

```typescript
// Standard transaction pattern
const template: TxTemplate = { vout: [{ value, scriptPubKey }] }
const funded = await wallet.fund_tx(template)
const txid = await client.publish_tx(funded, true) // true = mine block
```

### External Signing API

```typescript
// Export keypair for external signing (FROST, MuSig2, etc.)
const keypair = await wallet.export_keypair(address)
// keypair.type === 'taproot' | 'segwit'
// keypair.pubkey (32 or 33 bytes hex)
// keypair.seckey (32 bytes hex)

// Build transaction with pre-computed sighashes
const unsigned = await wallet.build_tx(template)
// unsigned.sighashes[0].sighash - 32-byte hash to sign
// unsigned.sighashes[0].key_type - 'taproot' or 'segwit'

// Add external signatures
const signed = await wallet.add_signature(unsigned, {
  index: 0,
  key_type: 'taproot',
  signature: schnorrSignature  // 64-byte Uint8Array
})

// Finalize and broadcast
const txhex = await wallet.finalize_tx(signed)
const txid = await client.publish_tx(txhex)

// Alternative: Use SigningContext for multi-step workflows
const ctx = await wallet.create_signing_context(template)
ctx.pending_inputs  // [0, 1, 2]
ctx.add_signature({ index: 0, key_type: 'taproot', signature: sig })
const txhex = await ctx.finalize()
```

## Error Classes

All errors extend `CoreError` from `src/class/errors.ts`:

- `ProcessError` - Bitcoin Core process failures
- `CommandError` - bitcoin-cli command failures
- `ConnectionError` - RPC connection issues
- `RPCError` - RPC-specific errors
- `WalletError` - Wallet operation failures
- `ConfigError` - Configuration validation errors
- `NetworkError` - Network-related errors

## State Machine

The daemon uses a state machine (`src/class/state.ts`) for lifecycle tracking:

```
Created -> Starting -> ProcessRunning -> Initializing -> Ready -> ShuttingDown -> Stopped
                                                           |
                                                         Error
```

Access state via:
```typescript
daemon.daemonState  // DaemonState enum
daemon.isReady      // boolean
daemon.state        // ProcessState from controller
```

## Event Bus (ZMQ + Polling)

The daemon provides real-time notifications via a hybrid event bus:

```typescript
// Events work with both ZMQ and Polling backends
daemon.on('block', (block) => console.log('New block:', block.hash))
daemon.on('transaction', (tx) => console.log('New tx:', tx.txid))

// Check which backend is active
daemon.events_type  // 'zmq', 'poll', or 'none'
daemon.events       // EventBus instance or null
```

### Event Bus Configuration

```typescript
const daemon = await CoreDaemon.spawn({
  // Event bus options
  events_enabled: true,           // Enable event bus (default: true)
  events_poll_interval: 1000,     // Polling interval in ms (default: 1000)
  polling_enabled: true,          // Enable polling fallback (default: true)

  // ZMQ-specific (requires zeromq package)
  zmq_enabled: true,
  zmq_host: 'tcp://127.0.0.1',
  zmq_port: 28332,
  zmq_topics: ['hashblock', 'hashtx']
})
```

### ZMQ Setup (Optional)

For real-time ZMQ events, install zeromq:
```bash
npm install zeromq
```

Configure Bitcoin Core in `bitcoin.conf`:
```conf
zmqpubhashblock=tcp://127.0.0.1:28332
zmqpubhashtx=tcp://127.0.0.1:28332
```

## Testing Patterns

- Tests use `tape` framework with async support
- Test files organized by type:
  - `test/cases/unit/**/*.test.ts` - Unit tests (no Bitcoin Core)
  - `test/cases/integration/**/*.test.ts` - Integration tests (requires Bitcoin Core)
  - `test/cases/e2e/**/*.test.ts` - End-to-end tests
- Test runners:
  - `npm run test:unit` - Run unit tests only
  - `npm run test:integration` - Run integration tests
  - `npm test` - Run all tests
- Use `test/scratch.ts` for interactive development
- Test helpers in `test/lib/helpers/` provide assertions, mocks, etc.
- Mock implementations in `test/lib/mocks/` for unit testing

## Regtest-Specific Operations

When `network: 'regtest'`:
- `client.mine_blocks(count, address)` - Generate blocks instantly
- Initial faucet funding happens automatically
- Time manipulation available via `client.set_time(timestamp)`

## Key Configuration

```typescript
const daemon = await CoreDaemon.spawn({
  corepath : '/path/to/bitcoind',     // Bitcoin Core binary
  clipath  : '/path/to/bitcoin-cli',  // CLI binary
  datapath : '/path/to/datadir',      // Blockchain data
  confpath : '/path/to/bitcoin.conf', // Config file
  network  : 'regtest',               // Network type
  isolated : true,                    // Use random ports
  debug    : true,                    // Enable debug output
  verbose  : true,                    // Extra logging
  timeout  : 30000,                   // Startup timeout (ms)
  safemode : true                     // Auto-shutdown on errors
})
```

## Constants

Key constants exported from `src/const.ts`:

```typescript
import {
  SATS_PER_BTC,        // 100_000_000
  DUST_LIMIT,          // 1_000 sats
  MIN_TX_FEE,          // 1_000 sats
  randomPort,          // Function to get random port
  normalize_network,   // Convert network aliases
  DEFAULT_PATHS        // Platform-specific default paths
} from '@vbyte/core-cmd'

// Namespace imports also available
import { CONST, ERRORS } from '@vbyte/core-cmd'
```

## Dependencies

- **@vbyte/btc-dev**: Bitcoin script and transaction utilities
- **@vbyte/buff**: Buffer encoding/decoding
- **@vbyte/crypto**: Cryptographic functions (SHA256, ECDSA, Schnorr)
- **@scure/bip32**: HD key derivation
- **@scure/btc-signer**: Transaction signing
- **zeromq** (optional): ZMQ event bus support
- Uses Bitcoin Core's wallet for key management
