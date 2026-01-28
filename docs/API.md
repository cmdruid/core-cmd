# API Reference

Complete API reference for `@vbyte/core-cmd`.

## Table of Contents

- [CoreDaemon](#coredaemon)
- [CoreClient](#coreclient)
- [CoreWallet](#corewallet)
- [Error Classes](#error-classes)
- [Types](#types)
- [Constants](#constants)

---

## CoreDaemon

The main entry point for Bitcoin Core automation.

### Static Methods

#### `CoreDaemon.spawn(config)`

Spawn a new Bitcoin Core process.

```typescript
const daemon = await CoreDaemon.spawn({
  datapath: '/path/to/data',
  isolated: true
})
```

**Parameters:**
- `config` - [DaemonConfig](#daemonconfig)

**Returns:** `Promise<CoreDaemon>`

**Throws:** `ProcessError` if spawn fails

---

#### `CoreDaemon.connect(config)`

Connect to an existing Bitcoin Core process.

```typescript
const daemon = await CoreDaemon.connect({
  rpc_host: '127.0.0.1',
  rpc_port: 18443,
  rpc_user: 'user',
  rpc_pass: 'password'
})
```

**Parameters:**
- `config` - [DaemonConfig](#daemonconfig)

**Returns:** `Promise<CoreDaemon>`

**Throws:** `ConnectionError` if connection fails

---

#### `CoreDaemon.auto(config)`

Connect if Bitcoin Core is running, otherwise spawn a new process.

```typescript
const daemon = await CoreDaemon.auto({
  datapath: '/path/to/data',
  isolated: true
})
```

**Parameters:**
- `config` - [DaemonConfig](#daemonconfig)

**Returns:** `Promise<CoreDaemon>`

---

#### `CoreDaemon.exists(processName?)`

Check if Bitcoin Core is running.

```typescript
// Check for any Bitcoin Core process
const running = await CoreDaemon.exists()

// Check for specific process
const bitcoindRunning = await CoreDaemon.exists('bitcoind')
const qtRunning = await CoreDaemon.exists('bitcoin-qt')
```

**Parameters:**
- `processName` (optional) - `'bitcoind'` | `'bitcoin-qt'`

**Returns:** `Promise<boolean>`

---

### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `client` | `CoreClient` | RPC client instance |
| `faucet` | `CoreWallet` | Faucet wallet (regtest) |
| `events` | `EventBus \| null` | Event bus instance |
| `events_type` | `'zmq' \| 'poll' \| 'none'` | Active event bus type |
| `isReady` | `boolean` | Whether daemon is ready |
| `daemonState` | `DaemonState` | Current state |
| `state` | `ProcessState` | Process controller state |

---

### Instance Methods

#### `shutdown()`

Gracefully shut down the daemon.

```typescript
await daemon.shutdown()
```

**Returns:** `Promise<void>`

---

#### `wait_for_ready(timeout?)`

Wait for daemon to reach ready state.

```typescript
await daemon.wait_for_ready(30000)  // 30 second timeout
```

**Parameters:**
- `timeout` (optional) - Timeout in milliseconds

**Returns:** `Promise<void>`

**Throws:** `ProcessError` on timeout

---

#### `run(...callbacks)`

Execute callbacks sequentially, then shut down.

```typescript
await daemon.run(
  async (client) => {
    const wallet = await client.load_wallet('test')
    await wallet.ensure_funds(100000)
  },
  async (client) => {
    const balance = await client.cmd('getbalance')
    console.log('Balance:', balance)
  }
)
// Daemon shuts down automatically
```

**Parameters:**
- `...callbacks` - Functions receiving `CoreClient`

**Returns:** `Promise<void>`

---

#### `run_parallel(...callbacks)`

Execute callbacks concurrently.

```typescript
const results = await daemon.run_parallel(
  async (client) => client.get_block_count(),
  async (client) => client.get_chain_info()
)
```

**Parameters:**
- `...callbacks` - Functions receiving `CoreClient`

**Returns:** `Promise<PromiseSettledResult<any>[]>`

---

### Events

```typescript
daemon.on('ready', () => { ... })
daemon.on('shutdown', () => { ... })
daemon.on('state:change', ({ from, to }) => { ... })
daemon.on('block', (block) => { ... })
daemon.on('transaction', (tx) => { ... })
```

---

## CoreClient

RPC client for Bitcoin Core communication.

### Methods

#### `cmd(method, args?, wallet?)`

Execute any RPC command.

```typescript
// Simple command
const count = await client.cmd('getblockcount')

// Command with arguments
const block = await client.cmd('getblock', [hash, 2])

// Command with wallet context
const balance = await client.cmd('getbalance', [], 'my_wallet')
```

**Parameters:**
- `method` - RPC method name
- `args` (optional) - Array of arguments
- `wallet` (optional) - Wallet name for wallet-specific commands

**Returns:** `Promise<any>`

**Throws:** `CommandError` on failure

---

#### `get_block_count()`

Get current block height.

```typescript
const height = await client.get_block_count()
// 150
```

**Returns:** `Promise<number>`

---

#### `get_chain_info()`

Get blockchain information.

```typescript
const info = await client.get_chain_info()
// { chain: 'regtest', blocks: 150, headers: 150, ... }
```

**Returns:** `Promise<ChainInfo>`

---

#### `get_block(hash)`

Get block by hash.

```typescript
const block = await client.get_block(hash)
```

**Returns:** `Promise<Block | null>`

---

#### `get_block_hash(height)`

Get block hash at height.

```typescript
const hash = await client.get_block_hash(100)
```

**Returns:** `Promise<string | null>`

---

#### `get_tx(txid)`

Get transaction by txid.

```typescript
const tx = await client.get_tx(txid)
```

**Returns:** `Promise<Transaction | null>`

---

#### `get_tx_status(txid)`

Get transaction confirmation status.

```typescript
const status = await client.get_tx_status(txid)
// { confirmed: true, block_height: 150, ... }
```

**Returns:** `Promise<TxStatus | null>`

---

#### `mine_blocks(count, address?)`

Mine blocks (regtest only).

```typescript
// Mine to random address
const hashes = await client.mine_blocks(10)

// Mine to specific address
const hashes = await client.mine_blocks(10, address)
```

**Parameters:**
- `count` - Number of blocks to mine
- `address` (optional) - Coinbase address

**Returns:** `Promise<string[]>` - Block hashes

**Throws:** `NetworkError` if not regtest

---

#### `publish_tx(hex, mine?)`

Broadcast transaction.

```typescript
// Broadcast only
const txid = await client.publish_tx(signedHex)

// Broadcast and mine
const txid = await client.publish_tx(signedHex, true)
```

**Parameters:**
- `hex` - Signed transaction hex
- `mine` (optional) - Mine a block after broadcast

**Returns:** `Promise<string>` - Transaction ID

---

#### `load_wallet(name, config?)`

Load or create a wallet.

```typescript
const wallet = await client.load_wallet('my_wallet')

// With options
const wallet = await client.load_wallet('my_wallet', {
  descriptors: true,
  disable_private_keys: false
})
```

**Parameters:**
- `name` - Wallet name
- `config` (optional) - Wallet creation options

**Returns:** `Promise<CoreWallet>`

---

#### `get_loaded_wallets()`

List currently loaded wallets.

```typescript
const wallets = await client.get_loaded_wallets()
// ['default', 'my_wallet']
```

**Returns:** `Promise<string[]>`

---

#### `get_created_wallets()`

List all created wallets.

```typescript
const wallets = await client.get_created_wallets()
// ['default', 'my_wallet', 'old_wallet']
```

**Returns:** `Promise<string[]>`

---

#### `generate_funds(amount, address)`

Generate funds (regtest only).

```typescript
await client.generate_funds(100000000, address)  // 1 BTC
```

**Parameters:**
- `amount` - Amount in satoshis
- `address` - Destination address

**Returns:** `Promise<void>`

**Throws:** `NetworkError` if not regtest

---

## CoreWallet

Wallet operations and transaction building.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | Wallet name |
| `client` | `CoreClient` | Associated client |

---

### Balance & UTXOs

#### `get_balance()`

Get wallet balance in satoshis.

```typescript
const balance = await wallet.get_balance()
// 150000000  (1.5 BTC)
```

**Returns:** `Promise<number>`

---

#### `list_utxos()`

List unspent transaction outputs.

```typescript
const utxos = await wallet.list_utxos()
// [{ txid, vout, sats, address, ... }, ...]
```

**Returns:** `Promise<UTXO[]>`

---

#### `select_utxos(amount, sorter?)`

Select UTXOs for a target amount.

```typescript
const selected = await wallet.select_utxos(50000)
```

**Parameters:**
- `amount` - Target amount in satoshis
- `sorter` (optional) - Custom UTXO sorter function

**Returns:** `Promise<UTXO[]>`

**Throws:** `WalletError` if insufficient funds

---

### Addresses

#### `generate_address(config?)`

Generate a new receiving address.

```typescript
const address = await wallet.generate_address()

// With options
const address = await wallet.generate_address({
  type: 'bech32m',  // taproot
  label: 'payment'
})
```

**Parameters:**
- `config` (optional) - Address options
  - `type`: `'legacy'` | `'p2sh-segwit'` | `'bech32'` | `'bech32m'`
  - `label`: Address label

**Returns:** `Promise<string>`

---

#### `get_address(index?, label?)`

Get address by index or label.

```typescript
const address = await wallet.get_address(0)
const labeled = await wallet.get_address(undefined, 'payment')
```

**Returns:** `Promise<string>`

---

#### `parse_address(address)`

Get address information.

```typescript
const info = await wallet.parse_address(address)
// { address, scriptPubKey, ismine, ... }
```

**Returns:** `Promise<AddressInfo>`

---

#### `get_pubkey(address)`

Get public key for an address.

```typescript
const pubkey = await wallet.get_pubkey(address)
// '02abc123...'
```

**Returns:** `Promise<string>`

---

### Transactions

#### `send_funds(amount, address, mine?)`

Send funds to an address.

```typescript
const txid = await wallet.send_funds(50000, address)

// Send and mine
const txid = await wallet.send_funds(50000, address, true)
```

**Parameters:**
- `amount` - Amount in satoshis
- `address` - Destination address
- `mine` (optional) - Mine block after broadcast

**Returns:** `Promise<string>` - Transaction ID

---

#### `fund_tx(template)`

Add inputs and change to a transaction template.

```typescript
const template = {
  vout: [{
    value: 50000,
    scriptPubKey: address
  }]
}
const funded = await wallet.fund_tx(template)
```

**Parameters:**
- `template` - [TxTemplate](#txtemplate)

**Returns:** `Promise<string>` - Funded transaction hex

---

#### `sign_tx(hex)`

Sign a transaction.

```typescript
const signed = await wallet.sign_tx(fundedHex)
```

**Parameters:**
- `hex` - Transaction hex

**Returns:** `Promise<string>` - Signed transaction hex

---

### PSBT Methods

#### `create_psbt(template)`

Create a PSBT from template.

```typescript
const psbt = await wallet.create_psbt(template)
```

**Returns:** `Promise<string>` - PSBT base64

---

#### `sign_psbt(psbt)`

Sign a PSBT.

```typescript
const signed = await wallet.sign_psbt(psbt)
```

**Returns:** `Promise<string>` - Signed PSBT base64

---

#### `finalize_psbt(psbt)`

Finalize a PSBT to raw transaction.

```typescript
const hex = await wallet.finalize_psbt(signedPsbt)
```

**Returns:** `Promise<string>` - Transaction hex

---

#### `create_and_sign_tx(template)`

Create, sign, and finalize in one step.

```typescript
const hex = await wallet.create_and_sign_tx(template)
```

**Returns:** `Promise<string>` - Signed transaction hex

---

### External Signing

For hardware wallets, FROST, MuSig2, and other external signing scenarios.

#### `export_keypair(address)`

Export keypair for external signing.

```typescript
const keypair = await wallet.export_keypair(address)
// {
//   type: 'taproot' | 'segwit',
//   pubkey: '02abc...',
//   seckey: 'abc123...'
// }
```

**Returns:** `Promise<KeyPair>`

---

#### `build_tx(template)`

Build unsigned transaction with sighash data.

```typescript
const unsigned = await wallet.build_tx(template)
// {
//   hex: '0100...',
//   sighashes: [{
//     index: 0,
//     sighash: 'abc123...',  // 32-byte hash to sign
//     key_type: 'taproot'
//   }]
// }
```

**Returns:** `Promise<UnsignedTx>`

---

#### `add_signature(unsigned, sig)`

Add an external signature.

```typescript
const signed = await wallet.add_signature(unsigned, {
  index: 0,
  key_type: 'taproot',
  signature: schnorrSig  // 64-byte Uint8Array
})
```

**Parameters:**
- `unsigned` - From `build_tx()`
- `sig` - Signature data

**Returns:** `Promise<UnsignedTx>` - Updated transaction

---

#### `finalize_tx(unsigned)`

Finalize externally signed transaction.

```typescript
const hex = await wallet.finalize_tx(signed)
const txid = await client.publish_tx(hex)
```

**Returns:** `Promise<string>` - Transaction hex

**Throws:** `WalletError` if signatures incomplete

---

### Funding

#### `ensure_funds(amount)`

Ensure wallet has minimum balance.

```typescript
await wallet.ensure_funds(100000000)  // Ensure 1 BTC
```

**Parameters:**
- `amount` - Required balance in satoshis

**Returns:** `Promise<void>`

---

#### `drain_faucet(amount)`

Request funds from faucet (regtest).

```typescript
await wallet.drain_faucet(50000000)  // Request 0.5 BTC
```

**Returns:** `Promise<void>`

---

## Error Classes

All errors extend `CoreError`:

### CoreError

Base error class.

```typescript
class CoreError extends Error {
  name: string
  cause?: Error
}
```

### ProcessError

Bitcoin Core process failures.

```typescript
class ProcessError extends CoreError {
  pid?: number
  signal?: string
}
```

### CommandError

bitcoin-cli execution failures.

```typescript
class CommandError extends CoreError {
  command: string
  args?: any[]
  stderr?: string
  exitCode?: number
}
```

### ConnectionError

RPC connection issues.

```typescript
class ConnectionError extends CoreError {
  host?: string
  port?: number
}
```

### RPCError

RPC-level errors.

```typescript
class RPCError extends CoreError {
  code: number
  data?: any
}
```

### WalletError

Wallet operation failures.

```typescript
class WalletError extends CoreError {
  wallet: string
  operation: string
}
```

### ConfigError

Configuration validation errors.

```typescript
class ConfigError extends CoreError {
  key: string
  value?: any
}
```

### NetworkError

Network-related errors.

```typescript
class NetworkError extends CoreError {
  network: string
}
```

---

## Types

### DaemonConfig

```typescript
interface DaemonConfig {
  // Paths
  corepath?: string      // Path to bitcoind
  clipath?: string       // Path to bitcoin-cli
  confpath?: string      // Path to bitcoin.conf
  datapath?: string      // Path to data directory
  cookiepath?: string    // Path to RPC cookie

  // Network
  network?: 'regtest' | 'main' | 'test' | 'signet'
  isolated?: boolean     // Use random ports

  // RPC
  rpc_host?: string
  rpc_port?: number
  rpc_user?: string
  rpc_pass?: string

  // Behavior
  debug?: boolean
  verbose?: boolean
  timeout?: number       // Startup timeout (ms)
  safemode?: boolean     // Auto-shutdown on errors

  // Events
  events_enabled?: boolean
  events_poll_interval?: number
  polling_enabled?: boolean
  zmq_enabled?: boolean
  zmq_host?: string
  zmq_port?: number
  zmq_topics?: string[]

  // Process
  core_params?: string[] // Extra bitcoind arguments
}
```

### TxTemplate

```typescript
interface TxTemplate {
  vin?: TxInput[]
  vout: TxOutput[]
  locktime?: number
}

interface TxInput {
  txid: string
  vout: number
  sequence?: number
}

interface TxOutput {
  value: number           // Satoshis
  scriptPubKey: string    // Address or hex script
}
```

### UTXO

```typescript
interface UTXO {
  txid: string
  vout: number
  sats: number
  address: string
  scriptPubKey: string
  confirmations: number
  spendable: boolean
  solvable: boolean
  safe: boolean
}
```

### ChainInfo

```typescript
interface ChainInfo {
  chain: string
  blocks: number
  headers: number
  bestblockhash: string
  difficulty: number
  time: number
  mediantime: number
  verificationprogress: number
  pruned: boolean
}
```

### DaemonState

```typescript
enum DaemonState {
  Created = 'Created',
  Starting = 'Starting',
  ProcessRunning = 'ProcessRunning',
  Initializing = 'Initializing',
  Ready = 'Ready',
  ShuttingDown = 'ShuttingDown',
  Stopped = 'Stopped',
  Error = 'Error'
}
```

---

## Constants

```typescript
import {
  SATS_PER_BTC,        // 100_000_000
  DUST_LIMIT,          // 1_000 sats
  MIN_TX_FEE,          // 1_000 sats
  randomPort,          // () => number (random port 10000-60000)
  normalize_network,   // (alias) => network
  DEFAULT_PATHS        // Platform-specific defaults
} from '@vbyte/core-cmd'
```

### Namespace Imports

```typescript
import { CONST, ERRORS } from '@vbyte/core-cmd'

CONST.SATS_PER_BTC
ERRORS.WalletError
```
