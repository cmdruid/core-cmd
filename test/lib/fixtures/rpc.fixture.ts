/**
 * RPC response fixtures for mock testing
 */

import type { RPCResponseFixtures } from '../types/fixture.types.js'
import { CommandError, ConnectionError, RPCError } from '../../../src/index.js'

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_BLOCKHASH = '0000000000000000000000000000000000000000000000000000000000000001'
const SAMPLE_TXID = 'a'.repeat(64)
const SAMPLE_ADDRESS = 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080'

// ============================================================================
// Default RPC Responses
// ============================================================================

/**
 * Get default RPC responses for mock client
 */
export function get_default_rpc_responses(): Record<string, unknown> {
  return {
    // Blockchain info
    getblockchaininfo: {
      chain                : 'regtest',
      blocks               : 150,
      headers              : 150,
      bestblockhash        : SAMPLE_BLOCKHASH,
      difficulty           : 4.656542373906925e-10,
      time                 : Math.floor(Date.now() / 1000),
      mediantime           : Math.floor(Date.now() / 1000) - 300,
      verificationprogress : 1,
      initialblockdownload : false,
      chainwork            : '0'.repeat(64),
      size_on_disk         : 1000000,
      pruned               : false,
      warnings             : ''
    },

    // Block count
    getblockcount: 150,

    // Best block hash (for polling)
    getbestblockhash: SAMPLE_BLOCKHASH,

    // Raw mempool (for polling)
    getrawmempool: [],

    // Block hash
    getblockhash: SAMPLE_BLOCKHASH,

    // Block data
    getblock: {
      hash              : SAMPLE_BLOCKHASH,
      confirmations     : 1,
      height            : 150,
      version           : 536870912,
      versionHex        : '20000000',
      merkleroot        : '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
      time              : Math.floor(Date.now() / 1000),
      mediantime        : Math.floor(Date.now() / 1000) - 300,
      nonce             : 0,
      bits              : '207fffff',
      difficulty        : 4.656542373906925e-10,
      chainwork         : '0'.repeat(64),
      nTx               : 1,
      previousblockhash : '0'.repeat(64),
      strippedsize      : 250,
      size              : 286,
      weight            : 1036,
      tx                : [SAMPLE_TXID]
    },

    // Block header
    getblockheader: {
      hash              : SAMPLE_BLOCKHASH,
      confirmations     : 1,
      height            : 150,
      version           : 536870912,
      versionHex        : '20000000',
      merkleroot        : '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
      time              : Math.floor(Date.now() / 1000),
      mediantime        : Math.floor(Date.now() / 1000) - 300,
      nonce             : 0,
      bits              : '207fffff',
      difficulty        : 4.656542373906925e-10,
      chainwork         : '0'.repeat(64),
      nTx               : 1,
      previousblockhash : '0'.repeat(64)
    },

    // Raw transaction
    getrawtransaction: {
      txid          : SAMPLE_TXID,
      hash          : SAMPLE_TXID,
      version       : 2,
      size          : 225,
      vsize         : 144,
      weight        : 573,
      locktime      : 0,
      vin           : [],
      vout          : [
        {
          value        : 50,
          n            : 0,
          scriptPubKey : {
            asm     : 'OP_HASH160 mock_hash OP_EQUAL',
            desc    : 'addr(mock_address)',
            hex     : '00' + '14' + '0'.repeat(40),
            address : SAMPLE_ADDRESS,
            type    : 'witness_v0_keyhash'
          }
        }
      ],
      hex           : '0'.repeat(450),
      blockhash     : SAMPLE_BLOCKHASH,
      confirmations : 6,
      time          : Math.floor(Date.now() / 1000),
      blocktime     : Math.floor(Date.now() / 1000)
    },

    // Wallet list
    listwallets: ['faucet'],

    // Wallet directory
    listwalletdir: {
      wallets: [{ name: 'faucet' }]
    },

    // List unspent
    listunspent: [
      {
        txid          : SAMPLE_TXID,
        vout          : 0,
        address       : SAMPLE_ADDRESS,
        label         : 'faucet',
        scriptPubKey  : '0014' + '0'.repeat(40),
        amount        : 50,
        confirmations : 100,
        spendable     : true,
        solvable      : true,
        desc          : 'wpkh([mock/84h/1h/0h]mock_pubkey)#checksum',
        parent_descs  : [],
        safe          : true,
        sats          : 5000000000
      }
    ],

    // New address
    getnewaddress: SAMPLE_ADDRESS,

    // Generate to address
    generatetoaddress: [SAMPLE_BLOCKHASH],

    // Wallet info
    getwalletinfo: {
      walletname             : 'faucet',
      walletversion          : 169900,
      format                 : 'sqlite',
      balance                : 1000,
      unconfirmed_balance    : 0,
      immature_balance       : 0,
      txcount                : 100,
      keypoololdest          : Math.floor(Date.now() / 1000),
      keypoolsize            : 1000,
      keypoolsize_hd_internal: 1000,
      hdseedid               : 'mock_seed_id',
      paytxfee               : 0,
      private_keys_enabled   : true,
      avoid_reuse            : false,
      scanning               : false,
      descriptors            : true,
      external_signer        : false
    },

    // Fee estimate
    estimatesmartfee: {
      feerate : 0.00001,
      blocks  : 6
    },

    // Send raw transaction
    sendrawtransaction: SAMPLE_TXID,

    // Test mempool accept
    testmempoolaccept: [
      {
        txid    : SAMPLE_TXID,
        wtxid   : SAMPLE_TXID,
        allowed : true,
        vsize   : 144,
        fees    : { base: 0.00001, effective_feerate: 0.00001 }
      }
    ],

    // Mempool info
    getmempoolinfo: {
      loaded              : true,
      size                : 0,
      bytes               : 0,
      usage               : 0,
      total_fee           : 0,
      maxmempool          : 300000000,
      mempoolminfee       : 0.00001,
      minrelaytxfee       : 0.00001,
      incrementalrelayfee : 0.00001,
      unbroadcastcount    : 0,
      fullrbf             : false
    },

    // Network info
    getnetworkinfo: {
      version           : 250000,
      subversion        : '/Satoshi:25.0.0/',
      protocolversion   : 70016,
      localservices     : '0000000000000409',
      localrelay        : true,
      timeoffset        : 0,
      networkactive     : true,
      connections       : 0,
      connections_in    : 0,
      connections_out   : 0,
      networks          : [],
      relayfee          : 0.00001,
      incrementalfee    : 0.00001,
      localaddresses    : [],
      warnings          : ''
    },

    // UTXO scan
    scantxoutset: {
      success      : true,
      txouts       : 1,
      height       : 150,
      bestblock    : SAMPLE_BLOCKHASH,
      unspents     : [],
      total_amount : 0
    },

    // Get txout
    gettxout: {
      bestblock     : SAMPLE_BLOCKHASH,
      confirmations : 6,
      value         : 50,
      scriptPubKey  : {
        asm     : 'OP_HASH160 mock OP_EQUAL',
        desc    : 'addr(mock)',
        hex     : '0014' + '0'.repeat(40),
        address : SAMPLE_ADDRESS,
        type    : 'witness_v0_keyhash'
      },
      coinbase      : false
    },

    // Set mock time
    setmocktime: null,

    // Load wallet
    loadwallet: { name: 'faucet', warning: '' },

    // Create wallet
    createwallet: { name: 'test', warning: '' },

    // Unload wallet
    unloadwallet: { warning: '' },

    // Get address info
    getaddressinfo: {
      address         : SAMPLE_ADDRESS,
      scriptPubKey    : '0014' + '0'.repeat(40),
      ismine          : true,
      iswatchonly     : false,
      isscript        : false,
      iswitness       : true,
      witness_version : 0,
      witness_program : '0'.repeat(40)
    },

    // Sign PSBT
    walletprocesspsbt: {
      psbt     : 'mock_signed_psbt',
      complete : true
    },

    // Fund PSBT
    walletcreatefundedpsbt: {
      psbt       : 'mock_funded_psbt',
      fee        : 0.00001,
      changepos  : 1
    },

    // Decode PSBT
    decodepsbt: {
      tx   : {},
      fee  : 0.00001
    },

    // List descriptors
    listdescriptors: {
      wallet_name : 'faucet',
      descriptors : []
    }
  }
}

// ============================================================================
// Error RPC Responses
// ============================================================================

/**
 * Get error responses for testing error handling
 */
export function get_error_rpc_responses(): Record<string, Error> {
  return {
    // Connection error
    connection_error: new ConnectionError(
      'Could not connect to Bitcoin Core',
      'localhost',
      18443,
      5000
    ),

    // RPC error - wallet not found
    wallet_not_found: new RPCError(
      'Wallet not found',
      'loadwallet',
      ['nonexistent'],
      -18,
      'Wallet "nonexistent" not found.'
    ),

    // RPC error - invalid address
    invalid_address: new RPCError(
      'Invalid address',
      'validateaddress',
      ['invalid'],
      -5,
      'Invalid address'
    ),

    // RPC error - insufficient funds
    insufficient_funds: new RPCError(
      'Insufficient funds',
      'sendtoaddress',
      [],
      -6,
      'Insufficient funds'
    ),

    // RPC error - transaction not found
    tx_not_found: new RPCError(
      'Transaction not found',
      'getrawtransaction',
      [SAMPLE_TXID],
      -5,
      'No such mempool or blockchain transaction'
    ),

    // Command error
    command_error: new CommandError(
      'bitcoin-cli command failed',
      'getblockcount',
      '',
      'error: Could not connect to the server',
      1
    ),

    // RPC warming up
    warming_up: new RPCError(
      'Bitcoin Core is warming up',
      'getblockcount',
      [],
      -28,
      'Loading block index...'
    )
  }
}

// ============================================================================
// Response Builders
// ============================================================================

/**
 * Create a custom block response
 */
export function create_block_response(
  height : number,
  hash?  : string,
  txids? : string[]
): Record<string, unknown> {
  const defaults = get_default_rpc_responses().getblock as Record<string, unknown>
  return {
    ...defaults,
    height,
    hash  : hash ?? SAMPLE_BLOCKHASH,
    tx    : txids ?? [SAMPLE_TXID]
  }
}

/**
 * Create a custom transaction response
 */
export function create_tx_response(
  txid          : string,
  confirmations : number = 6,
  value         : number = 50
): Record<string, unknown> {
  const defaults = get_default_rpc_responses().getrawtransaction as Record<string, unknown>
  return {
    ...defaults,
    txid,
    hash: txid,
    confirmations,
    vout: [
      {
        value,
        n: 0,
        scriptPubKey: {
          asm     : 'OP_HASH160 mock OP_EQUAL',
          desc    : 'addr(mock)',
          hex     : '0014' + '0'.repeat(40),
          address : SAMPLE_ADDRESS,
          type    : 'witness_v0_keyhash'
        }
      }
    ]
  }
}

/**
 * Create chain info for specific height
 */
export function create_chain_info_response(
  height : number,
  chain  : string = 'regtest'
): Record<string, unknown> {
  const defaults = get_default_rpc_responses().getblockchaininfo as Record<string, unknown>
  return {
    ...defaults,
    chain,
    blocks  : height,
    headers : height
  }
}

// ============================================================================
// Export Types
// ============================================================================

export type { RPCResponseFixtures }
