import { Buff }        from '@cmdcode/buff'
import { Transaction } from '@scure/btc-signer'
import { CoreDaemon }  from '../src/index.js'

const core = new CoreDaemon({ verbose : true })

const client = await core.startup()
const wallet = await client.load_wallet('faucet')
const pubkey = await wallet.gen_pubkey('bech32m')

console.log(pubkey)

let psbt = 'cHNidP8BAMoCAAAAAaurq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urAAAAAAD/////BAAAAAAAAAAAKCdqWAAU/USUpaBGaGdrUnxft9lDcCakqg4EAAJJ8AQAAknwBGaG5HQAAAAAAAAAABMSal0PAKvXrt16q9eu3XrQhgMBgNHwCAAAAAAiUSD3I18dEucPTZ7uceT+sTBq9zwQ39HqP+qT6pAuKG+XpyICAAAAAAAAFgAUiAuEq8dz+Jjh2W2wSgom9SUaQ1cAAAAAAAEBK4DR8AgAAAAAIlEgq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6siFcBQkpt0waBJVLeLS2A16XpeB4paDyjsltVHv+6azoA6wDx2qRT9RJSloEZoZ2tSfF+32UNwJqSqDoitIJmXpJfZZPwaYohbBaURZqZakN8ASSyNfPYdasz1SAO+rMABFyBQkpt0waBJVLeLS2A16XpeB4paDyjsltVHv+6azoA6wAAAAAAA'

psbt = await wallet.add_taproot_desc(psbt, pubkey, 0)

console.log(psbt)

// const funded = await wallet.fund_psbt(psbt)

// console.log('funded:', funded)

// console.dir(Transaction.fromPSBT(Buff.base64(funded)), { depth : null })

// const tx = Transaction.fromPSBT(Buff.base64(funded))

//const txhex = tx.extract()

//const txid = await client.publish_tx(txhex)

//console.log('txid:', txid)
