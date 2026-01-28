# @vbyte/core-cmd

A TypeScript library for automating Bitcoin Core. Designed for CI/CD testing, integration tests, and building applications that interact with the Bitcoin blockchain.

[![npm version](https://img.shields.io/npm/v/@vbyte/core-cmd.svg)](https://www.npmjs.com/package/@vbyte/core-cmd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Process Management** - Spawn, connect to, or auto-detect Bitcoin Core
- **Wallet Operations** - Balance, UTXOs, addresses, transactions
- **Transaction Building** - Templates, funding, signing, PSBTs
- **External Signing** - Support for hardware wallets, FROST, MuSig2
- **Real-time Events** - Block and transaction notifications via ZMQ or polling
- **Typed Errors** - Comprehensive error hierarchy for handling failures
- **CI/CD Ready** - Isolated mode for parallel test execution

## Installation

```bash
npm install @vbyte/core-cmd
```

For real-time ZMQ events (optional):
```bash
npm install zeromq
```

## Quick Start

```typescript
import { CoreDaemon } from '@vbyte/core-cmd'

// Spawn Bitcoin Core in isolated mode (regtest)
const daemon = await CoreDaemon.spawn({ isolated: true })

// Get blockchain info
const info = await daemon.client.get_chain_info()
console.log('Chain:', info.chain, 'Blocks:', info.blocks)

// Create a wallet and send funds
const wallet = await daemon.client.load_wallet('my_wallet')
await wallet.ensure_funds(100_000_000)  // 1 BTC

const address = await wallet.generate_address()
const txid = await wallet.send_funds(50_000_000, address)
console.log('Transaction:', txid)

// Clean up
await daemon.shutdown()
```

## Connection Methods

```typescript
// Spawn new process
const daemon = await CoreDaemon.spawn({ isolated: true })

// Connect to existing
const daemon = await CoreDaemon.connect({
  rpc_port: 18443,
  rpc_user: 'user',
  rpc_pass: 'password'
})

// Auto-detect: connect if running, spawn if not
const daemon = await CoreDaemon.auto({ isolated: true })

// Check if running
const running = await CoreDaemon.exists()
```

## Transaction Workflow

```typescript
// Simple send
const txid = await wallet.send_funds(50_000_000, recipientAddress)

// Custom transaction
const template = {
  vout: [
    { value: 30_000_000, scriptPubKey: address1 },
    { value: 20_000_000, scriptPubKey: address2 }
  ]
}
const funded = await wallet.fund_tx(template)
const signed = await wallet.sign_tx(funded)
const txid = await daemon.client.publish_tx(signed)
```

## Real-time Events

```typescript
const daemon = await CoreDaemon.spawn({ isolated: true })

daemon.on('block', (block) => {
  console.log('New block:', block.hash)
})

daemon.on('transaction', (tx) => {
  console.log('New tx:', tx.txid)
})

// Check event bus type: 'zmq', 'poll', or 'none'
console.log('Events via:', daemon.events_type)
```

## Error Handling

```typescript
import { WalletError, CommandError } from '@vbyte/core-cmd'

try {
  await wallet.send_funds(amount, address)
} catch (err) {
  if (err instanceof WalletError) {
    console.log('Wallet:', err.wallet, 'Op:', err.operation)
  }
}
```

## Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - System design, components, state machine
- **[API Reference](docs/API.md)** - Complete method documentation
- **[Usage Guide](docs/GUIDE.md)** - Tutorials, patterns, best practices

## API Overview

### CoreClient

| Method | Description |
|--------|-------------|
| `cmd(method, args?)` | Execute any RPC command |
| `get_block_count()` | Get current block height |
| `get_tx(txid)` | Get transaction details |
| `mine_blocks(count)` | Mine blocks (regtest) |
| `load_wallet(name)` | Load or create wallet |
| `publish_tx(hex)` | Broadcast transaction |

### CoreWallet

| Method | Description |
|--------|-------------|
| `get_balance()` | Balance in satoshis |
| `generate_address()` | New receiving address |
| `list_utxos()` | Unspent outputs |
| `send_funds(amount, addr)` | Send transaction |
| `fund_tx(template)` | Add inputs/change |
| `sign_tx(hex)` | Sign transaction |
| `ensure_funds(amount)` | Ensure minimum balance |

## Configuration

```typescript
const daemon = await CoreDaemon.spawn({
  // Paths (auto-detected if not specified)
  corepath: '/path/to/bitcoind',
  clipath: '/path/to/bitcoin-cli',
  datapath: '/path/to/datadir',

  // Network
  network: 'regtest',  // 'main', 'test', 'signet'
  isolated: true,      // Random ports, no P2P

  // Behavior
  debug: true,
  timeout: 30000,

  // Events
  events_enabled: true,
  zmq_enabled: true,
  zmq_port: 28332
})
```

## Testing

```bash
# Run all tests
npm test

# Unit tests only (no Bitcoin Core needed)
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## Requirements

- Node.js 18+
- Bitcoin Core 22+ (for testing and runtime)
- TypeScript 5+ (for development)

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE) for details.
