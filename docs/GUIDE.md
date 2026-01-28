# Usage Guide

Practical guide to using `@vbyte/core-cmd` for Bitcoin Core automation.

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Usage](#basic-usage)
- [Transaction Workflows](#transaction-workflows)
- [Testing Patterns](#testing-patterns)
- [External Signing](#external-signing)
- [Event Handling](#event-handling)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Getting Started

### Installation

```bash
npm install @vbyte/core-cmd
```

For real-time ZMQ events (optional):
```bash
npm install zeromq
```

### Prerequisites

You need Bitcoin Core installed on your system:

- **Linux**: `sudo apt install bitcoind` or build from source
- **macOS**: `brew install bitcoin` or download from [bitcoin.org](https://bitcoin.org)
- **Windows**: Download from [bitcoin.org](https://bitcoin.org)

### Verify Installation

```typescript
import { CoreDaemon } from '@vbyte/core-cmd'

// Check if Bitcoin Core is available
const running = await CoreDaemon.exists()
console.log('Bitcoin Core running:', running)
```

---

## Basic Usage

### Spawning a Daemon

The simplest way to start:

```typescript
import { CoreDaemon } from '@vbyte/core-cmd'

// Spawn with isolated mode (recommended for testing)
const daemon = await CoreDaemon.spawn({
  isolated: true
})

// Access the client
const client = daemon.client
const blockCount = await client.get_block_count()
console.log('Block count:', blockCount)

// Always shut down when done
await daemon.shutdown()
```

### Connecting to Existing Process

If Bitcoin Core is already running:

```typescript
const daemon = await CoreDaemon.connect({
  rpc_port: 18443,
  rpc_user: 'your_user',
  rpc_pass: 'your_password'
})
```

### Auto Mode

Let the library decide:

```typescript
// Connects if running, spawns if not
const daemon = await CoreDaemon.auto({
  datapath: '/path/to/data',
  isolated: true
})
```

### Using the Faucet (Regtest)

On regtest, a pre-funded faucet wallet is available:

```typescript
const daemon = await CoreDaemon.spawn({
  network: 'regtest',
  isolated: true
})

const faucet = daemon.faucet
const balance = await faucet.get_balance()
console.log('Faucet balance:', balance, 'sats')

// Send funds from faucet
const address = 'bcrt1q...'
const txid = await faucet.send_funds(100000000, address)  // 1 BTC
```

---

## Transaction Workflows

### Simple Send

```typescript
// Create a wallet
const wallet = await client.load_wallet('my_wallet')

// Fund it from faucet
await wallet.drain_faucet(200000000)  // 2 BTC

// Send to address
const recipient = 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080'
const txid = await wallet.send_funds(50000000, recipient)  // 0.5 BTC

console.log('Transaction:', txid)
```

### Custom Transaction

For more control over transaction building:

```typescript
// Build a transaction template
const template = {
  vout: [
    { value: 30000000, scriptPubKey: address1 },  // 0.3 BTC
    { value: 20000000, scriptPubKey: address2 }   // 0.2 BTC
  ]
}

// Fund (adds inputs and change output)
const funded = await wallet.fund_tx(template)

// Sign
const signed = await wallet.sign_tx(funded)

// Broadcast
const txid = await client.publish_tx(signed)

// Optionally mine to confirm
await client.mine_blocks(1)
```

### Using PSBTs

For complex signing workflows:

```typescript
// Create PSBT
const psbt = await wallet.create_psbt(template)

// Sign PSBT
const signedPsbt = await wallet.sign_psbt(psbt)

// Finalize to raw transaction
const hex = await wallet.finalize_psbt(signedPsbt)

// Broadcast
const txid = await client.publish_tx(hex)
```

### All-in-One

```typescript
// Create, sign, and finalize in one call
const hex = await wallet.create_and_sign_tx(template)
const txid = await client.publish_tx(hex)
```

---

## Testing Patterns

### Test Structure

```typescript
import tape from 'tape'
import { CoreDaemon } from '@vbyte/core-cmd'

tape('My Bitcoin test', async (t) => {
  const daemon = await CoreDaemon.spawn({ isolated: true })

  try {
    const wallet = await daemon.client.load_wallet('test')
    await wallet.ensure_funds(100000000)

    const balance = await wallet.get_balance()
    t.ok(balance >= 100000000, 'Wallet has funds')

  } finally {
    await daemon.shutdown()
  }

  t.end()
})
```

### Using run() for Cleanup

The `run()` method automatically shuts down:

```typescript
tape('Transaction test', async (t) => {
  const daemon = await CoreDaemon.spawn({ isolated: true })

  await daemon.run(async (client) => {
    const wallet = await client.load_wallet('test')
    const address = await wallet.generate_address()
    t.ok(address.startsWith('bcrt1'), 'Generated regtest address')
  })
  // Daemon is shut down automatically

  t.end()
})
```

### Shared Daemon Across Tests

For performance, reuse the daemon:

```typescript
let daemon: CoreDaemon

tape('Setup', async (t) => {
  daemon = await CoreDaemon.spawn({ isolated: true })
  t.ok(daemon.isReady, 'Daemon started')
  t.end()
})

tape('Test 1', async (t) => {
  const balance = await daemon.faucet.get_balance()
  t.ok(balance > 0, 'Faucet has balance')
  t.end()
})

tape('Test 2', async (t) => {
  const wallet = await daemon.client.load_wallet('test')
  const address = await wallet.generate_address()
  t.ok(address, 'Generated address')
  t.end()
})

tape('Teardown', async (t) => {
  await daemon.shutdown()
  t.end()
})
```

### Unique Wallet Names

Avoid conflicts with unique names:

```typescript
function unique_wallet_name(prefix: string): string {
  const suffix = Date.now() + '_' + Math.random().toString(36).slice(2)
  return `${prefix}_${suffix}`
}

tape('Parallel tests', async (t) => {
  const wallet = await client.load_wallet(unique_wallet_name('test'))
  // ...
})
```

---

## External Signing

For hardware wallets, FROST, MuSig2, or custom signing.

### Export Keypair

```typescript
const address = await wallet.generate_address({ type: 'bech32m' })
const keypair = await wallet.export_keypair(address)

console.log('Type:', keypair.type)      // 'taproot'
console.log('Pubkey:', keypair.pubkey)  // 32 bytes hex
console.log('Seckey:', keypair.seckey)  // 32 bytes hex
```

### Build with Sighashes

```typescript
// Build transaction with sighash data
const unsigned = await wallet.build_tx(template)

console.log('Transaction hex:', unsigned.hex)
console.log('Inputs to sign:', unsigned.sighashes.length)

for (const input of unsigned.sighashes) {
  console.log(`Input ${input.index}:`)
  console.log('  Sighash:', input.sighash)    // 32-byte hash to sign
  console.log('  Key type:', input.key_type)  // 'taproot' or 'segwit'
}
```

### Add External Signatures

```typescript
import { schnorr } from '@noble/secp256k1'

// Sign externally (e.g., with hardware wallet or FROST)
const signature = schnorr.sign(
  Buffer.from(unsigned.sighashes[0].sighash, 'hex'),
  Buffer.from(keypair.seckey, 'hex')
)

// Add signature to transaction
const signed = await wallet.add_signature(unsigned, {
  index: 0,
  key_type: 'taproot',
  signature: signature  // 64-byte Uint8Array
})

// Finalize and broadcast
const hex = await wallet.finalize_tx(signed)
const txid = await client.publish_tx(hex)
```

### Multiple Inputs

```typescript
// Sign all inputs
let tx = unsigned
for (const input of unsigned.sighashes) {
  const sig = signExternally(input.sighash, input.key_type)
  tx = await wallet.add_signature(tx, {
    index: input.index,
    key_type: input.key_type,
    signature: sig
  })
}

const hex = await wallet.finalize_tx(tx)
```

---

## Event Handling

### Block and Transaction Events

```typescript
const daemon = await CoreDaemon.spawn({
  isolated: true,
  events_enabled: true
})

// Listen for new blocks
daemon.on('block', (block) => {
  console.log('New block:', block.hash)
  console.log('Height:', block.height)
})

// Listen for new transactions
daemon.on('transaction', (tx) => {
  console.log('New tx:', tx.txid)
})

// Check which backend is active
console.log('Event type:', daemon.events_type)  // 'zmq', 'poll', or 'none'
```

### State Events

```typescript
daemon.on('state:change', ({ from, to }) => {
  console.log(`State changed: ${from} -> ${to}`)
})

daemon.on('ready', () => {
  console.log('Daemon is ready!')
})

daemon.on('shutdown', () => {
  console.log('Daemon shut down')
})
```

### Waiting for Confirmations

```typescript
async function wait_for_confirmation(
  daemon: CoreDaemon,
  txid: string,
  confirmations: number = 1
): Promise<void> {
  return new Promise((resolve) => {
    const check = async () => {
      const status = await daemon.client.get_tx_status(txid)
      if (status?.confirmed && status.confirmations >= confirmations) {
        daemon.off('block', check)
        resolve()
      }
    }

    daemon.on('block', check)
    check()  // Check immediately
  })
}

// Usage
const txid = await wallet.send_funds(50000, address)
await wait_for_confirmation(daemon, txid, 6)
console.log('Transaction has 6 confirmations!')
```

---

## Error Handling

### Try/Catch Pattern

```typescript
import { CommandError, WalletError, ConnectionError } from '@vbyte/core-cmd'

try {
  await wallet.send_funds(1000000000000, address)  // Too much
} catch (err) {
  if (err instanceof WalletError) {
    console.log('Wallet error:', err.message)
    console.log('Wallet:', err.wallet)
    console.log('Operation:', err.operation)
  } else if (err instanceof CommandError) {
    console.log('RPC error:', err.message)
    console.log('Command:', err.command)
    console.log('stderr:', err.stderr)
  } else {
    throw err
  }
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `WalletError: Insufficient funds` | Not enough balance | Use `ensure_funds()` first |
| `CommandError: wallet not found` | Wallet not loaded | Use `load_wallet()` |
| `NetworkError: requires regtest` | Wrong network | Check `network` config |
| `ConnectionError` | Can't reach Bitcoin Core | Check RPC settings |
| `ProcessError` | Daemon failed to start | Check paths and ports |

### Graceful Error Recovery

```typescript
async function send_with_retry(
  wallet: CoreWallet,
  amount: number,
  address: string,
  retries: number = 3
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      return await wallet.send_funds(amount, address)
    } catch (err) {
      if (err instanceof WalletError && err.message.includes('Insufficient')) {
        // Try to get more funds
        await wallet.ensure_funds(amount * 2)
      } else if (i === retries - 1) {
        throw err
      }
    }
  }
  throw new Error('Send failed after retries')
}
```

---

## Best Practices

### 1. Always Use Isolated Mode for Testing

```typescript
// Good - uses random ports, no conflicts
const daemon = await CoreDaemon.spawn({ isolated: true })

// Bad - may conflict with other instances
const daemon = await CoreDaemon.spawn({})
```

### 2. Clean Up Resources

```typescript
// Good - explicit cleanup
const daemon = await CoreDaemon.spawn({ isolated: true })
try {
  // ... your code
} finally {
  await daemon.shutdown()
}

// Also good - automatic cleanup
await daemon.run(async (client) => {
  // ... your code
})
```

### 3. Use Satoshis Consistently

```typescript
const SATS_PER_BTC = 100_000_000

// Good - clear and consistent
const amount = 1.5 * SATS_PER_BTC  // 1.5 BTC in sats
await wallet.send_funds(amount, address)

// Bad - BTC values are error-prone
await wallet.send_funds(1.5, address)  // Wrong! This is 1.5 sats
```

### 4. Check Balances Before Sending

```typescript
// Good - ensure funds first
await wallet.ensure_funds(amount + 10000)  // Amount + fee buffer
await wallet.send_funds(amount, address)

// Bad - may fail on insufficient funds
await wallet.send_funds(amount, address)
```

### 5. Handle Network Differences

```typescript
// Good - check network before regtest operations
const info = await client.get_chain_info()
if (info.chain === 'regtest') {
  await client.mine_blocks(1)
}

// Bad - will throw on mainnet/testnet
await client.mine_blocks(1)
```

### 6. Use Unique Names in Tests

```typescript
// Good - unique wallet names
const suffix = Date.now()
const wallet = await client.load_wallet(`test_${suffix}`)

// Bad - may conflict with parallel tests
const wallet = await client.load_wallet('test')
```

### 7. Wait for State When Needed

```typescript
// Good - ensure daemon is ready
await daemon.wait_for_ready()
const client = daemon.client

// Or check state
if (daemon.isReady) {
  // Safe to use
}
```

### 8. Log for Debugging

```typescript
// Enable debug output
const daemon = await CoreDaemon.spawn({
  isolated: true,
  debug: true,
  verbose: true
})
```

---

## Configuration Reference

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BITCOIN_DATADIR` | Default data directory |
| `BITCOIN_CLI_PATH` | Path to bitcoin-cli |
| `BITCOIN_DAEMON_PATH` | Path to bitcoind |
| `BITCOIN_CONF_PATH` | Path to bitcoin.conf |

### Bitcoin.conf for Testing

```conf
# Minimal regtest config
regtest=1
server=1
rpcuser=test
rpcpassword=test

# For ZMQ events
zmqpubhashblock=tcp://127.0.0.1:28332
zmqpubhashtx=tcp://127.0.0.1:28332

# Useful for testing
txindex=1
fallbackfee=0.0001
```

### Full Configuration Example

```typescript
const daemon = await CoreDaemon.spawn({
  // Paths
  corepath: '/usr/local/bin/bitcoind',
  clipath: '/usr/local/bin/bitcoin-cli',
  datapath: '/tmp/bitcoin-test',
  confpath: '/path/to/bitcoin.conf',

  // Network
  network: 'regtest',
  isolated: true,

  // RPC (usually auto-detected)
  rpc_host: '127.0.0.1',
  rpc_port: 18443,

  // Behavior
  debug: true,
  verbose: true,
  timeout: 30000,

  // Events
  events_enabled: true,
  events_poll_interval: 500,
  zmq_enabled: true,
  zmq_port: 28332,

  // Extra bitcoind arguments
  core_params: ['-txindex=1', '-fallbackfee=0.0001']
})
```
