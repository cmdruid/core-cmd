import { Buff }        from '@cmdcode/buff'
import { Transaction } from '@scure/btc-signer'
import { CoreDaemon }  from '../src/index.js'

const core = new CoreDaemon({ verbose : true })

const client  = await core.startup()
const wallet  = await client.load_wallet('faucet')
const address = await wallet.gen_address({ address_type : 'bech32m' })
const desc    = await wallet.get_descriptor(address)

const utxo = await wallet.create_utxo(100_000, address)

console.log('utxo:', utxo)
