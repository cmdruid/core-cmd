# Architecture

This document describes the internal architecture of `@vbyte/core-cmd`.

## Overview

The library follows a three-layer architecture for Bitcoin Core automation:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  (Your code: tests, scripts, applications)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CoreDaemon                                │
│  - Process lifecycle management                                  │
│  - State machine coordination                                    │
│  - Event bus management (ZMQ/Polling)                           │
│  - Provides: client, faucet, events                             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   CoreClient    │ │   CoreWallet    │ │    EventBus     │
│  - RPC calls    │ │  - Wallet ops   │ │  - ZMQ events   │
│  - bitcoin-cli  │ │  - UTXO mgmt    │ │  - Polling      │
│  - Caching      │ │  - Signing      │ │  - Block/Tx     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Bitcoin Core                              │
│  (bitcoind / bitcoin-qt)                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### CoreDaemon (`src/class/core.ts`)

The `CoreDaemon` is the main entry point and orchestrates all other components:

**Responsibilities:**
- Spawning or connecting to Bitcoin Core processes
- Managing the lifecycle state machine
- Initializing the faucet wallet (regtest)
- Coordinating graceful shutdown
- Providing access to client and wallet instances

**Static Factory Methods:**
```typescript
CoreDaemon.spawn(config)   // Start new bitcoind process
CoreDaemon.connect(config) // Connect to existing process
CoreDaemon.auto(config)    // Connect if running, spawn if not
CoreDaemon.exists(name?)   // Check if Bitcoin Core is running
```

**Key Properties:**
```typescript
daemon.client      // CoreClient instance
daemon.faucet      // CoreWallet (regtest faucet)
daemon.events      // EventBus instance (or null)
daemon.events_type // 'zmq' | 'poll' | 'none'
daemon.isReady     // boolean
daemon.daemonState // DaemonState enum
```

### CoreClient (`src/class/client.ts`)

The `CoreClient` handles all RPC communication with Bitcoin Core:

**Responsibilities:**
- Executing bitcoin-cli commands
- Command result caching
- Wallet loading and creation
- High-level RPC method wrappers

**Command Execution:**
```typescript
// Low-level: any RPC command
const result = await client.cmd('getblockchaininfo')

// With wallet context
const result = await client.cmd('getbalance', [], 'wallet_name')

// High-level wrappers
const count = await client.get_block_count()
const tx = await client.get_tx(txid)
```

**Caching:**
The client implements intelligent caching for frequently accessed data:
- Block data (immutable once confirmed)
- Transaction data (immutable once confirmed)
- Chain info (short TTL)

### CoreWallet (`src/class/wallet.ts`)

The `CoreWallet` provides wallet operations and transaction building:

**Responsibilities:**
- Balance and UTXO management
- Address generation
- Transaction funding and signing
- External signing API support
- Automatic fund management

**Transaction Flow:**
```typescript
// 1. Build transaction template
const template = { vout: [{ value: 50000, scriptPubKey: address }] }

// 2. Fund with inputs and change
const funded = await wallet.fund_tx(template)

// 3. Sign
const signed = await wallet.sign_tx(funded)

// 4. Broadcast
const txid = await client.publish_tx(signed)
```

**External Signing:**
```typescript
// For hardware wallets, FROST, MuSig2, etc.
const keypair = await wallet.export_keypair(address)
const unsigned = await wallet.build_tx(template)
// Sign externally using unsigned.sighashes
const signed = await wallet.add_signature(unsigned, { index, signature })
const hex = await wallet.finalize_tx(signed)
```

## State Machine

The daemon uses a finite state machine for lifecycle management (`src/class/state.ts`):

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
┌─────────┐    ┌──────────┐    ┌────────────────┐    ┌────────────────┐
│ Created │───▶│ Starting │───▶│ ProcessRunning │───▶│ Initializing   │
└─────────┘    └──────────┘    └────────────────┘    └────────────────┘
                                                              │
                    ┌─────────────────────────────────────────┤
                    │                                         │
                    ▼                                         ▼
             ┌─────────────┐                           ┌───────────┐
             │    Error    │◀──────────────────────────│   Ready   │
             └─────────────┘                           └───────────┘
                    │                                         │
                    │                                         │
                    ▼                                         ▼
             ┌─────────────┐                           ┌──────────────┐
             │   Stopped   │◀──────────────────────────│ ShuttingDown │
             └─────────────┘                           └──────────────┘
```

**States:**
- `Created` - Initial state, not yet started
- `Starting` - Process spawn initiated
- `ProcessRunning` - Bitcoin Core process is running
- `Initializing` - Setting up wallets and event bus
- `Ready` - Fully operational
- `ShuttingDown` - Graceful shutdown in progress
- `Stopped` - Process terminated
- `Error` - Unrecoverable error occurred

**Events:**
```typescript
daemon.on('state:change', ({ from, to }) => {
  console.log(`${from} -> ${to}`)
})

daemon.on('ready', () => console.log('Daemon ready'))
daemon.on('shutdown', () => console.log('Daemon stopped'))
```

## Process Management

### SpawnedProcess (`src/class/process.ts`)

Manages Bitcoin Core processes started by the library:

```typescript
// Spawns bitcoind with configured arguments
const process = new SpawnedProcess(config)
await process.start()

// Process provides:
process.get_state()  // 'idle' | 'running' | 'stopped' | 'error'
process.get_client() // CoreClient instance
await process.cleanup()
```

### ConnectedProcess (`src/class/process.ts`)

Manages connections to existing Bitcoin Core processes:

```typescript
// Connects to already-running bitcoind
const process = new ConnectedProcess(config)
await process.start()

// Health checking
process.is_healthy()  // boolean
```

### Process Log Buffer

Captures stdout/stderr with automatic sanitization:

```typescript
const buffer = new ProcessLogBuffer(100)  // Keep last 100 lines
buffer.add_stdout('block connected')
buffer.add_stderr('warning: ...')

const recent = buffer.get_recent(10)  // Last 10 log entries
```

Sensitive data (private keys, passwords) is automatically redacted.

## Event Bus System

The library provides real-time event notifications via a hybrid event bus:

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         EventBus                                 │
│  - Unified event interface                                       │
│  - Automatic backend selection                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│      ZMQEventBus        │     │     PollEventBus        │
│  - Real-time push       │     │  - Periodic polling     │
│  - Requires zeromq      │     │  - Always available     │
│  - Lower latency        │     │  - Higher latency       │
└─────────────────────────┘     └─────────────────────────┘
```

### ZMQ Events (`src/class/zmq.ts`)

When the `zeromq` package is installed and ZMQ is configured:

```typescript
// Bitcoin Core emits:
// - hashblock: New block hash
// - hashtx: New transaction hash
// - sequence: Mempool sequence number

daemon.on('zmq:block', (block) => { ... })
daemon.on('zmq:transaction', (tx) => { ... })
```

### Polling Events (`src/class/poll.ts`)

Fallback when ZMQ is unavailable:

```typescript
// Polls Bitcoin Core RPC periodically:
// - getbestblockhash (detect new blocks)
// - getrawmempool (detect new transactions)

daemon.on('block', (block) => { ... })
daemon.on('transaction', (tx) => { ... })
```

### Configuration

```typescript
const daemon = await CoreDaemon.spawn({
  // Event bus settings
  events_enabled: true,           // Enable event bus (default: true)
  events_poll_interval: 1000,     // Polling interval ms (default: 1000)
  polling_enabled: true,          // Enable polling fallback (default: true)

  // ZMQ settings (requires zeromq package)
  zmq_enabled: true,
  zmq_host: 'tcp://127.0.0.1',
  zmq_port: 28332,
  zmq_topics: ['hashblock', 'hashtx']
})
```

## Error Handling

All errors extend the `CoreError` base class (`src/class/errors.ts`):

```
CoreError (base)
├── ProcessError      - Bitcoin Core process failures
├── CommandError      - bitcoin-cli execution failures
├── ConnectionError   - RPC connection issues
├── RPCError          - RPC-level errors
├── WalletError       - Wallet operation failures
├── ConfigError       - Configuration validation errors
└── NetworkError      - Network-related errors
```

**Error Properties:**
```typescript
try {
  await client.cmd('invalidmethod')
} catch (err) {
  if (err instanceof CommandError) {
    err.message    // Human-readable message
    err.command    // The RPC command that failed
    err.stderr     // stderr output
    err.exitCode   // Process exit code
  }
}
```

## Configuration Resolution

Configuration is resolved in layers:

```
1. Explicit config values (highest priority)
2. Environment variables
3. Bitcoin Core config file (bitcoin.conf)
4. Platform defaults (lowest priority)
```

**Platform Defaults (`src/config.ts`):**
```typescript
// Linux
corepath: '/usr/bin/bitcoind'
clipath: '/usr/bin/bitcoin-cli'
datapath: '~/.bitcoin'

// macOS
corepath: '/usr/local/bin/bitcoind'
datapath: '~/Library/Application Support/Bitcoin'

// Windows
corepath: 'C:\\Program Files\\Bitcoin\\daemon\\bitcoind.exe'
datapath: '%APPDATA%\\Bitcoin'
```

## Isolated Mode

When `isolated: true` is set:

1. **Random RPC Port**: Avoids conflicts with other instances
2. **Listen Disabled**: `-listen=0` prevents P2P connections
3. **Unique Data Directory**: Each instance gets isolated state

```typescript
const daemon = await CoreDaemon.spawn({
  isolated: true  // Recommended for testing
})
// Uses random port, no P2P, isolated data
```

## Type System

All RPC responses have TypeScript interfaces (`src/types/`):

```
src/types/
├── core.ts     - Blockchain types (Block, ChainInfo, etc.)
├── wallet.ts   - Wallet types (UTXO, Address, etc.)
├── config.ts   - Configuration types
├── events.ts   - Event payload types
└── index.ts    - Re-exports
```

**Conventions:**
- All types use PascalCase
- RPC responses match Bitcoin Core JSON structure
- Optional fields use `?` suffix
- Amounts are in satoshis (number)

## Dependencies

**Runtime:**
- `@vbyte/btc-dev` - Bitcoin script utilities
- `@vbyte/buff` - Buffer encoding
- `@vbyte/crypto` - Cryptographic functions
- `@scure/bip32` - HD key derivation
- `@scure/btc-signer` - Transaction signing

**Optional:**
- `zeromq` - Real-time ZMQ events

## Directory Structure

```
src/
├── class/           # Core classes
│   ├── core.ts      # CoreDaemon
│   ├── client.ts    # CoreClient
│   ├── wallet.ts    # CoreWallet
│   ├── process.ts   # Process management
│   ├── state.ts     # State machine
│   ├── events.ts    # Event emitter
│   ├── poll.ts      # Polling event bus
│   ├── zmq.ts       # ZMQ event bus
│   └── errors.ts    # Error classes
├── lib/             # Utilities
│   ├── cmd.ts       # CLI execution
│   ├── descriptors.ts # Descriptor parsing
│   └── util.ts      # Helpers
├── types/           # TypeScript types
├── util/            # Shared utilities
├── config.ts        # Configuration
└── index.ts         # Public exports
```
