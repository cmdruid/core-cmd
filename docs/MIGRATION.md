# Migration Guide: v1 to v2

This guide covers the breaking changes when upgrading from v1 to v2 of `@cmdcode/core-cmd`.

## Overview of Changes

v2 introduces:
- **Static factory methods** for daemon creation (`spawn()`, `connect()`, `auto()`)
- **snake_case method naming** (camelCase removed entirely)
- **State machine** for lifecycle management
- **Typed error classes** for better error handling
- **Improved error propagation** (no more silent error swallowing)
- **Async getter removal** (replaced with explicit method calls)

## Breaking Changes

### 1. Daemon Initialization

**v1 (removed):**
```typescript
const core = new CoreDaemon(config)
const client = await core.startup()
// ... use client
await core.shutdown()
```

**v2 (required):**
```typescript
// Option 1: Spawn new process
const core = await CoreDaemon.spawn(config)
const client = core.client
// ... use client
await core.shutdown()

// Option 2: Connect to existing process
const core = await CoreDaemon.connect(config)

// Option 3: Auto-detect (connect if running, spawn if not)
const core = await CoreDaemon.auto(config)
```

The `create()` factory method and `startup()` pattern have been removed. Use static factory methods instead.

### 2. Method Naming Convention

All methods use snake_case. CamelCase aliases have been removed:

| v1 (removed) | v2 (required) |
|--------------|---------------|
| `client.getTx()` | `client.get_tx()` |
| `client.mineBlocks()` | `client.mine_blocks()` |
| `client.loadWallet()` | `client.load_wallet()` |
| `client.publishTx()` | `client.publish_tx()` |
| `client.getBlockCount()` | `client.get_block_count()` |
| `wallet.getBalance()` | `wallet.get_balance()` |
| `wallet.ensureFunds()` | `wallet.ensure_funds()` |
| `wallet.fundTx()` | `wallet.fund_tx()` |
| `wallet.signPsbt()` | `wallet.sign_psbt()` |
| `wallet.generateAddress()` | `wallet.generate_address()` |
| `wallet.sendFunds()` | `wallet.send_funds()` |

### 3. Async Getters Removed

Getters that returned Promises have been removed and replaced with explicit async methods:

**v1 (removed):**
```typescript
const balance = await wallet.balance
const blocks = await client.blocks
const info = await wallet.info
const utxos = await wallet.utxos
const address = await wallet.new_address
```

**v2 (required):**
```typescript
const balance = await wallet.get_balance()
const blocks = await client.get_block_count()
const info = await wallet.get_info()
const utxos = await wallet.list_utxos()
const address = await wallet.generate_address()
```

Full list of removed async getters:

| Removed Getter | Use Instead |
|----------------|-------------|
| `client.blocks` | `client.get_block_count()` |
| `client.chain_info` | `client.get_chain_info()` |
| `client.wallets_loaded` | `client.get_loaded_wallets()` |
| `client.wallets_created` | `client.get_created_wallets()` |
| `wallet.info` | `wallet.get_info()` |
| `wallet.is_created` | `wallet.is_created_check()` |
| `wallet.is_loaded` | `wallet.is_loaded_check()` |
| `wallet.balance` | `wallet.get_balance()` |
| `wallet.new_address` | `wallet.generate_address()` |
| `wallet.new_scriptkey` | `wallet.generate_script_key()` |
| `wallet.utxos` | `wallet.list_utxos()` |
| `wallet.xprvs` | `wallet.list_descriptors(true)` |
| `wallet.xpubs` | `wallet.list_descriptors(false)` |
| `wallet.xprv` | `wallet.get_wpkh_xprv()` |
| `wallet.xpub` | `wallet.get_wpkh_xpub()` |

### 4. Error Handling

**v1 behavior:**
- `get_tx()` returned `null` for ANY error (hiding real problems)
- `run()` swallowed errors (converted to return values)

**v2 behavior:**
- `get_tx()` returns `null` only for "not found" errors (code -5)
- `get_tx()` throws for other errors (connection issues, etc.)
- `run()` throws errors properly

**Migration:**
```typescript
// v1: Could mask connection errors
const tx = await client.get_tx(txid)
if (!tx) {
  console.log('Not found or error')
}

// v2: Explicit error handling
try {
  const tx = await client.get_tx(txid)
  if (!tx) {
    console.log('Transaction not found')
  }
} catch (err) {
  if (err instanceof CommandError) {
    console.error('RPC error:', err.message)
  }
}
```

### 5. Error Classes

v2 introduces a typed error hierarchy. Import and use specific error types:

```typescript
import {
  CoreError,       // Base class for all errors
  ProcessError,    // Bitcoin Core process failures
  CommandError,    // RPC command execution failures
  ConnectionError, // Network/RPC connection issues
  WalletError,     // Wallet operation failures
  ConfigError      // Configuration validation errors
} from '@cmdcode/core-cmd'

try {
  await client.cmd('somecommand')
} catch (err) {
  if (err instanceof ProcessError) {
    // Handle process crash
  } else if (err instanceof CommandError) {
    // Handle RPC failure
    console.log('Exit code:', err.code)
    console.log('stderr:', err.stderr)
  } else if (err instanceof ConnectionError) {
    // Handle connection failure
  }
}
```

### 6. State Machine

v2 adds a state machine for tracking daemon lifecycle:

```typescript
import { DaemonState } from '@cmdcode/core-cmd'

const core = await CoreDaemon.spawn(config)

// Check current state
console.log(core.stateMachine.state)  // DaemonState.Ready

// Listen to state changes
core.stateMachine.on('state:change', (event) => {
  console.log(`${event.from} -> ${event.to}`)
})

// Wait for specific states
await core.stateMachine.wait_for_ready(30000)
```

### 7. Configuration Changes

Some configuration options have changed:

| v1 Config | v2 Config | Notes |
|-----------|-----------|-------|
| `params` | Removed | Use specific config options |
| `core_params` | Removed | Use specific config options |
| `cli_params` | Removed | Use specific config options |
| `no_spawn` | Use `CoreDaemon.connect()` | Clearer API |
| `safemode` | Refined | Only catches Bitcoin-related errors |
| `use_cache` | Removed | No longer needed |

### 8. run() Method Changes

The `run()` method now properly propagates errors:

**v1:**
```typescript
// Errors were swallowed
const results = await core.run(
  async (c) => { throw new Error('fail') }
)
// results contained the error, but didn't throw
```

**v2:**
```typescript
// Errors are thrown
try {
  await core.run(
    async (c) => { throw new Error('fail') }
  )
} catch (err) {
  // Error is properly thrown
  console.error('Task failed:', err.message)
}
```

### 9. Removed gen_* Prefix Methods

Legacy `gen_*` prefix methods have been removed:

| Removed | Use Instead |
|---------|-------------|
| `wallet.gen_address()` | `wallet.generate_address()` |
| `wallet.gen_pubkey()` | `wallet.generate_pubkey()` |
| `wallet.gen_descriptor()` | `wallet.generate_descriptor()` |

### 10. Removed Exports

The following exports have been removed from the package:

| Removed | Use Instead |
|---------|-------------|
| `resolvePath()` | `resolve_path()` |
| `normalizeNetwork()` | `normalize_network()` |
| `normalizeNetworkConfig` | `normalize_network()` |

## Quick Migration Checklist

1. [ ] Replace `CoreDaemon.create(config) + startup()` with `CoreDaemon.spawn(config)`
2. [ ] Replace all camelCase method calls with snake_case
3. [ ] Replace async getter access (`wallet.balance`) with method calls (`wallet.get_balance()`)
4. [ ] Replace `gen_*` methods with `generate_*` methods
5. [ ] Add try/catch around `get_tx()` calls (no longer masks all errors)
6. [ ] Update `run()` usage to expect thrown errors
7. [ ] Import and use typed error classes for better error handling
8. [ ] Remove deprecated config options (`params`, `no_spawn`, `use_cache`)
9. [ ] Update state machine method calls to snake_case (`wait_for_ready()`)

## Questions?

If you encounter migration issues, please open an issue on GitHub.
