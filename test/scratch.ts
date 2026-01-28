
import { CoreDaemon }  from '../src/index.js'

const core = await CoreDaemon.spawn({ verbose : true, isolated : true, safemode : true, network: 'regtest' })

const client  = core.client
const wallet  = await client.load_wallet('faucet')
const address = await wallet.generate_address({ address_type : 'bech32m' })
const descriptors = await wallet.list_descriptors()

await core.shutdown()

console.log('descriptors:', descriptors)
console.log('address:', address)
