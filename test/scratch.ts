import { Buff }        from '@vbyte/buff'
import { Transaction } from '@scure/btc-signer'
import { CoreDaemon }  from '../src/index.js'

const core = CoreDaemon.create({ verbose : true, isolated : true, safemode : true })

const client  = await core.startup()
const wallet  = await client.load_wallet('faucet')
const address = await wallet.generate_address({ address_type : 'bech32m' })
const desc    = await wallet.get_descriptor(address)

await core.shutdown()

console.log('desc:', desc)
