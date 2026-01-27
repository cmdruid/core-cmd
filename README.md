# Core Command

A suite of CI/CD friendly tools that plug into bitcoin core.

This library is designed for writing test cases that interact with the bitcoin blockchain.

## How to Install

```sh
# Using NPM
npm i --save-dev @vbyte/core-cmd
# Using Yarn
yarn add --dev @vbyte/core-cmd
```

## How to Use (v2 API)

The `CoreDaemon` class provides static factory methods to spawn or connect to Bitcoin Core:

### Quick Start

```typescript
import { CoreDaemon } from '@vbyte/core-cmd'

// Spawn a new Bitcoin Core process (regtest by default)
const core = await CoreDaemon.spawn({
  datapath : '/path/to/datadir',
  isolated : true  // Use random ports to avoid conflicts
})

// Use the client and faucet wallet
const client = core.client
const faucet = core.faucet

// Get blockchain info
const info = await client.get_chain_info()
console.log('Chain:', info.chain, 'Blocks:', info.blocks)

// Shut down when done
await core.shutdown()
```

### Connect to Existing Process

```typescript
// Connect to an already-running Bitcoin Core
const core = await CoreDaemon.connect({
  rpc_host : '127.0.0.1',
  rpc_port : 18443,
  rpc_user : 'user',
  rpc_pass : 'password'
})
```

### Auto Mode (Connect or Spawn)

```typescript
// Automatically connect if Bitcoin Core is running, otherwise spawn
const core = await CoreDaemon.auto({
  datapath : '/path/to/datadir',
  isolated : true
})

// You can also check if Bitcoin Core is running first
if (await CoreDaemon.exists()) {
  console.log('Bitcoin Core detected (bitcoind or bitcoin-qt)')
}

// Or check for a specific process
if (await CoreDaemon.exists('bitcoind')) {
  console.log('bitcoind is running')
}
```

### Configuration Options

```typescript
const config = {
  // Paths
  corepath?   : string   // Path to bitcoind binary
  clipath?    : string   // Path to bitcoin-cli binary
  confpath?   : string   // Path to bitcoin.conf file
  datapath?   : string   // Path to data directory
  cookiepath? : string   // Path to RPC cookie file

  // Network
  network?  : string   // 'regtest' (default), 'main', 'test', 'signet'
  isolated? : boolean  // Use random ports (recommended for testing)

  // RPC Connection
  rpc_host? : string   // RPC host (default: 127.0.0.1)
  rpc_port? : number   // RPC port
  rpc_user? : string   // RPC username
  rpc_pass? : string   // RPC password

  // Behavior
  debug?   : boolean   // Enable debug output
  verbose? : boolean   // Extra logging
  timeout? : number    // Startup timeout in milliseconds
}
```

### Using run() for Automatic Cleanup

The `run()` method executes callbacks and automatically shuts down the daemon:

```typescript
const core = await CoreDaemon.spawn({ isolated: true })

await core.run(async (client) => {
  // Load a wallet for Alice
  const aliceWallet = await client.load_wallet('alice_wallet')
  const aliceAddr = await aliceWallet.generate_address()

  // Load a wallet for Bob and ensure it has funds
  const bobWallet = await client.load_wallet('bob_wallet')
  await bobWallet.ensure_funds(1_000_000)  // 1M satoshis

  // Create and fund a transaction
  const template = {
    vout: [{
      value: 800_000,
      scriptPubKey: aliceAddr
    }]
  }
  const funded = await bobWallet.fund_tx(template)
  const signed = await bobWallet.sign_tx(funded)

  // Publish and confirm
  const txid = await client.publish_tx(signed)
  await client.mine_blocks(1)

  console.log('Transaction confirmed:', txid)
})
// Daemon is automatically shut down after run() completes
```

### Event-Driven Usage

```typescript
const core = new CoreDaemon({ isolated: true })

// Listen for ready event
core.on('ready', async (client) => {
  const wallet = await client.load_wallet('test_wallet')
  const balance = await wallet.get_balance()
  console.log('Balance:', balance, 'satoshis')

  await core.shutdown()
})

// Start the daemon
await core.startup()
```

### State Machine Events

The daemon uses a state machine for lifecycle management:

```typescript
const core = new CoreDaemon({ isolated: true })

// Listen to state changes
core.stateMachine.on('state:change', (event) => {
  console.log(`State: ${event.from} -> ${event.to}`)
})

core.stateMachine.on('state:error', (error) => {
  console.error('Daemon error:', error.message)
})

await core.startup()
```

### Real-Time Events (ZMQ / Polling)

The daemon provides real-time notifications for new blocks and transactions. It automatically selects the best available transport:

1. **ZMQ** (preferred) - Real-time push notifications from Bitcoin Core
2. **Polling** (fallback) - Periodic RPC polling when ZMQ is unavailable

```typescript
const core = await CoreDaemon.spawn({
  isolated: true,
  // Event bus is enabled by default
  // events_poll_interval: 1000  // Polling interval (ms)
})

// Listen for new blocks (works with both ZMQ and Polling)
core.on('block', (block) => {
  console.log('New block:', block.hash)
})

// Listen for new transactions
core.on('transaction', (tx) => {
  console.log('New transaction:', tx.txid)
})

// Check which event bus is in use
console.log('Event bus type:', core.events_type)  // 'zmq', 'poll', or 'none'
```

#### Enabling ZMQ

For real-time ZMQ support, install the optional zeromq package:

```bash
npm install zeromq
```

Then configure Bitcoin Core with ZMQ endpoints in `bitcoin.conf`:

```conf
zmqpubhashblock=tcp://127.0.0.1:28332
zmqpubhashtx=tcp://127.0.0.1:28332
```

And enable ZMQ in the daemon config:

```typescript
const core = await CoreDaemon.spawn({
  zmq_enabled: true,
  zmq_host: 'tcp://127.0.0.1',
  zmq_port: 28332
})

// ZMQ-specific events
core.on('zmq:block', (block) => console.log('ZMQ block:', block.hash))
core.on('zmq:transaction', (tx) => console.log('ZMQ tx:', tx.txid))
core.on('zmq:sequence', (seq) => console.log('Sequence:', seq))
```

## API Reference

### CoreClient Methods

| Method | Description |
|--------|-------------|
| `cmd(method, args?)` | Execute any RPC command |
| `get_block_count()` | Get current block height |
| `get_chain_info()` | Get blockchain info |
| `get_tx(txid)` | Get transaction (null if not found) |
| `mine_blocks(count, address?)` | Mine blocks (regtest only) |
| `load_wallet(name)` | Load or create a wallet |
| `publish_tx(hex)` | Broadcast transaction |
| `get_loaded_wallets()` | List loaded wallets |
| `get_created_wallets()` | List all wallets |

### CoreWallet Methods

| Method | Description |
|--------|-------------|
| `get_balance()` | Get balance in satoshis |
| `generate_address(config?)` | Generate new address |
| `list_utxos()` | List unspent outputs |
| `ensure_funds(amount)` | Ensure minimum balance |
| `fund_tx(template)` | Add inputs/change to tx |
| `sign_tx(hex)` | Sign transaction |
| `send_funds(amount, address)` | Send funds |

## Error Handling

The library uses a typed error hierarchy:

```typescript
import {
  CoreError,       // Base class
  ProcessError,    // Bitcoin Core process failures
  CommandError,    // RPC command failures
  ConnectionError, // Connection issues
  WalletError,     // Wallet operation failures
  ConfigError      // Configuration errors
} from '@vbyte/core-cmd'

try {
  await client.cmd('invalidcommand')
} catch (err) {
  if (err instanceof CommandError) {
    console.log('RPC failed:', err.message)
    console.log('stderr:', err.stderr)
  }
}
```

## CI/CD Testing

The included `test` and `.github` folders showcase how to use this library with GitHub Actions.

The example test located in `test/src/base.test.ts` uses the `tape` testing library.

## Migration from v1

If you're upgrading from v1, the v2 API now uses **snake_case** as the primary convention:

| v1 API (deprecated camelCase) | v2 API (snake_case) |
|-------------------------------|---------------------|
| `client.getTx()` | `client.get_tx()` |
| `client.mineBlocks()` | `client.mine_blocks()` |
| `client.getBlockCount()` | `client.get_block_count()` |
| `wallet.getBalance()` | `wallet.get_balance()` |
| `wallet.fundTx()` | `wallet.fund_tx()` |
| `wallet.signTx()` | `wallet.sign_tx()` |
| `wallet.ensureFunds()` | `wallet.ensure_funds()` |
| `wallet.generateAddress()` | `wallet.generate_address()` |

Legacy camelCase methods are still available but deprecated.

## Development & Testing

```bash
npm install && npm test
```

## Bugs / Issues

Please post any questions or bug reports on the issues page.

## Contributions

All contributions are welcome!

## License

Use this code however you like! No warranty!
