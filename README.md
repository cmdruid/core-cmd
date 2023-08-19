# Core Command

A suite of CI/CD friendly tools that plug into bitcoin core.

This library is designed for writing test cases that interact with the bitcoin blockchain.

## How to Install

```sh
# Using NPM
npm i --save-dev @cmdcode/core-cmd
# Using Yarn
yarn add --dev @cmdcode/core-cmd
```

## How to Use

The `CoreDaemon` class is designed to connect to an existing core node, or spawn a new one.

By default, the startup script will search for a running process of `bitcoind` or `bitcoin-qt`, and connect to it.

If no bitcoin core process is running, the startup script will spawn a new one.

The shutdown script will gracefully shut down any bitcoin core process started by the startup script. It will not affect any existing running process of bitcoin core.

```ts
import { CoreDaemon } from '@cmdcode/core-cmd'

const config : {
  cookiepath : string    // Path to your cookie file (if different than datapath).
  corepath   : string    // Path to your bitcoind binary (if not available in PATH).
  clipath    : string    // Path to your bitcoin-cli (if not available in PATH).
  confpath   : string    // Path to your bitcoin.conf file (if exists).
  datapath   : string    // Path to your bitcoin data directory.
  isolated   : boolean   // Starts bitcoind with random ports so it doesn't conflict.
  network    : string    // Network to use (default is regetest).
  params     : string[]  // Additional params to use when starting bitcoind.
} = {}

// Create a new daemon instance (with optional config).
const core = new CoreDaemon(config)
```

The basic way to run a script through bitcoin core is to use the `startup` and `shutdown` methods. These methods help ensure that bitcoin core is cleaned up properly once the test completes.

```ts
const core   = new CoreDaemon({ datapath: `${process.env.HOME}/.bitcoin` })
const client = await core.startup()

console.log(await client.get_info)
core.shutdown()
```

To auto-magically wrap your code with `startup` and `shutdown`, you can use the `run` method.

The `run` method will take any number of callback methods, and pass a `CoreClient` object into each one.

```ts
await core.run(async (client : CoreClient) => {
  // Load a wallet for Alice and generate an address.
  const alice_wallet = await client.get_wallet('alice_wallet')
  const alice_recv   = await alice_wallet.newaddress
  console.log('receive address:', alice_recv.address)
  // Create a tx template that pays to Alice.
  const template = {
    vout : [{
      value : 800_000,
      scriptPubKey : alice_recv.scriptPubKey
    }]
  }
  // Load a wallet for Bob and ensure it has funds.
  const bob_wallet = await client.get_wallet('bob_wallet')
  await bob_wallet.ensure_funds(1_000_000)
  // Fund the tx from Alice using Bob's wallet
  const txdata = await bob_wallet.fund_tx(template)
  // Print the txdata to console.
  console.log('txdata:', txdata)
  // Publish the tx.
  const txid = await client.publish_tx(txdata)
  // Mine a few blocks to confirm the tx.
  await client.mine_blocks(1)
  // Print the txid to console.
  console.log('txid:', txid)
})
```

For better flow control, you may want to use the `ready` event to execute code.

The `ready` event will emit after a sucessful run of the `startup` script.

```ts
// When core is started, it will emit a 'ready' event with a client object.
core.on('ready', async (client) => {
  // You can use the client to run commands.
  console.log(await client.cmd('getblockchaininfo'))
  // The client can load/create a wallet.
  const wallet = await client.get_wallet('test_wallet')
  // You can use the wallet to perform wallet-specific features.
  const addr = await wallet.newaddress
  console.log('addr:', addr)
  // Once your script is finished, you can gracefully shut down the daemon.
  await core.shutdown()
})
// To kick-off the above logic, start up core.
await core.startup()
```

## CI/CD Testing

The included `test` and `.github` folders are a showcase and example of how to use this library with github actions.

The example test located in `test/src/base.test.ts` uses a basic testing library called `tape`.

Feel free to copy this code and apply it to your own testing framework and CI/CD pipeline.

## Bugs / Issues

Please post any questions or bug reports on the issues page.

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
