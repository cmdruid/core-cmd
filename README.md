# Core Command

Take command of Bitcoin Core using a suite of automation tools and APIs.

## How to Install

```sh
# Using NPM
npm i --save-dev @cmdcode/core-cmd
# Using Yarn
yarn add --dev @cmdcode/core-cmd
```

## How to Use

Configuring a core daemon instance.

```ts
import { CoreDaemon } from '@cmdcode/core-cmd'

const config : {
  corepath   : string    // Path to your bitcoind binary (if not available in PATH).
  cookiepath : string    // Path to your cookie file (if different than datapath).
  clipath    : string    // Path to your bitcoin-cli (if not available in PATH).
  confpath   : string    // Path to your bitcoin.conf file (if exists).
  datapath   : string    // Path to your bitcoin data directory.
  network    : string    // Network to use (default is regetest).
  params     : string[]  // Additional params to use when starting bitcoind.
} = {}

// To start, create a new CoreDaemon object (with optional config).
const core = new CoreDaemon(config)

// Once core is initialized, it will emit a 'ready' event with a client.
core.on('ready', async (client) => {
  // You can use the client to run commands.
  console.log(await client.cmd('getblockchaininfo'))

  // The client can load/create a wallet.
  const wallet = await client.get_wallet('test_wallet')

  // You can use the wallet to perform wallet-specific features.
  const addr = await wallet.newaddress
  console.log('addr:', addr)

  // Once your script is finished, you can gracefully shut down core.
  await core.shutdown()
})

// To kick-off the above logic, start up core.
await core.startup()
```

## Script Examples

```ts
import { Address }    from '@scrow/tapscript'
import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({ datapath: '/home/cscott/.bitcoin' })

core.on('ready', async (client) => {

  // Load a wallet for Alice and generate an address.
  const alice_wallet = await client.get_wallet('alice_wallet')
  const alice_recv   = await alice_wallet.newaddress

  console.log('Alice receive address:', alice_recv)

  // Create a tx template that pays to Alice.
  const template = {
    vout : [{
      value : 800_000,
      scriptPubKey : Address.parse(alice_recv).script
    }]
  }

  // Load a wallet for Bob and ensure it has funds.
  const bob_wallet = await client.get_wallet('bob_wallet')
  await bob_wallet.ensure_funds(1_000_000)

  // Fund the tx from Alice using Bob's wallet
  const txdata = await bob_wallet.fund_tx(template)

  console.log('txdata:', txdata)

  // Publish the tx.
  const txid = await client.publish_tx(txdata)

  console.log('txid:', txid)

  // Mine a few blocks to confirm the tx.
  await client.mine_blocks(6)

  // We can scan Alice's address for UTXOs.
  const utxos = await client.scan_addr(alice_recv)

  console.log('utxos:', utxos)

  // Once we are done, shutdown core.
  await core.shutdown()
})

await core.startup()
```

## Bugs / Issues

Please feel free to post any questions or bug reports on the issues page!

There will likely be a number of cross-platform issues since I only have access to a linux machine for development. I will greatly appreciate any help and feedback from devs running into issues on Windows and OSX!

## Development & Testing

This project uses `typescript` for development and `tape` for testing.

```bash
yarn install && yarn test
npm  install && npm run test
```

## Contributions

All contributions are welcome!

## License

Use this code however you like! No warranty!
