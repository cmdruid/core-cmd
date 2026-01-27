/**
 * Fixture data types for core-cmd test framework
 */

import type {
  UTXO,
  TxResult,
  BlockData,
  BlockHeader,
  WalletInfo,
  TxStatus,
  ScanResults
} from '../../../src/index.js'

// ============================================================================
// RPC Response Fixtures
// ============================================================================

/**
 * Default RPC response fixture set
 */
export interface RPCResponseFixtures {
  getblockchaininfo : ChainInfoFixture
  getblockcount     : number
  getblock          : BlockFixture
  getblockhash      : string
  getrawtransaction : TxFixture
  listwallets       : string[]
  listdescriptorwallets : string[]
  listunspent       : UTXO[]
  getnewaddress     : string
  generatetoaddress : string[]
  getwalletinfo     : WalletInfoFixture
  estimatesmartfee  : FeeEstimateFixture
  sendrawtransaction: string
  testmempoolaccept : MempoolAcceptFixture[]
  getmempoolinfo    : MempoolInfoFixture
  getnetworkinfo    : NetworkInfoFixture
}

/**
 * Chain info fixture
 */
export interface ChainInfoFixture {
  chain                : string
  blocks               : number
  headers              : number
  bestblockhash        : string
  difficulty           : number
  time                 : number
  mediantime           : number
  verificationprogress : number
  initialblockdownload : boolean
  chainwork            : string
  size_on_disk         : number
  pruned               : boolean
  warnings             : string
}

/**
 * Block fixture (full block data)
 */
export interface BlockFixture extends BlockData {
  // Inherits all BlockData fields
}

/**
 * Transaction fixture
 */
export interface TxFixture extends TxResult {
  // Inherits all TxResult fields
}

/**
 * Wallet info fixture
 */
export interface WalletInfoFixture extends WalletInfo {
  // Inherits all WalletInfo fields
}

/**
 * Fee estimate fixture
 */
export interface FeeEstimateFixture {
  feerate? : number
  errors?  : string[]
  blocks   : number
}

/**
 * Mempool accept fixture
 */
export interface MempoolAcceptFixture {
  txid           : string
  wtxid          : string
  allowed        : boolean
  vsize          : number
  fees?          : { base: number; effective_feerate: number }
  'reject-reason'?: string
}

/**
 * Mempool info fixture
 */
export interface MempoolInfoFixture {
  loaded           : boolean
  size             : number
  bytes            : number
  usage            : number
  total_fee        : number
  maxmempool       : number
  mempoolminfee    : number
  minrelaytxfee    : number
  incrementalrelayfee : number
  unbroadcastcount : number
  fullrbf          : boolean
}

/**
 * Network info fixture
 */
export interface NetworkInfoFixture {
  version         : number
  subversion      : string
  protocolversion : number
  localservices   : string
  localrelay      : boolean
  timeoffset      : number
  networkactive   : boolean
  connections     : number
  connections_in  : number
  connections_out : number
  networks        : NetworkInterfaceFixture[]
  relayfee        : number
  incrementalfee  : number
  localaddresses  : unknown[]
  warnings        : string
}

/**
 * Network interface fixture
 */
export interface NetworkInterfaceFixture {
  name                    : string
  limited                 : boolean
  reachable               : boolean
  proxy                   : string
  proxy_randomize_credentials : boolean
}

// ============================================================================
// UTXO Fixtures
// ============================================================================

/**
 * Minimal UTXO fixture data
 */
export interface UTXOFixtureData {
  txid           : string
  vout           : number
  address?       : string
  amount?        : number
  sats           : number
  confirmations? : number
  spendable?     : boolean
  scriptPubKey?  : string
}

/**
 * Wallet fixture data
 */
export interface WalletFixtureData {
  name    : string
  balance : number
  utxos   : import('../../src/index.js').UTXO[]
}

/**
 * Block fixture data
 */
export interface BlockFixtureData {
  height : number
  hash   : string
  txids  : string[]
  time   : number
}

/**
 * Transaction fixture data
 */
export interface TxFixtureData {
  txid          : string
  hex           : string
  confirmations?: number
  fee?          : number
  blockhash?    : string
}

/**
 * UTXO set fixture
 */
export interface UTXOSetFixture {
  utxos        : UTXO[]
  total_amount : number
  total_sats   : number
}

// ============================================================================
// Transaction Fixtures
// ============================================================================

/**
 * Transaction input fixture
 */
export interface TxInputFixture {
  txid        : string
  vout        : number
  scriptSig   : { asm: string; hex: string }
  txinwitness?: string[]
  sequence    : number
}

/**
 * Transaction output fixture
 */
export interface TxOutputFixture {
  value        : number
  n            : number
  scriptPubKey : {
    asm     : string
    desc    : string
    hex     : string
    address?: string
    type    : string
  }
}

/**
 * Complete transaction fixture
 */
export interface TransactionFixture {
  txid          : string
  hash          : string
  version       : number
  size          : number
  vsize         : number
  weight        : number
  locktime      : number
  vin           : TxInputFixture[]
  vout          : TxOutputFixture[]
  hex           : string
  blockhash?    : string
  confirmations?: number
  time?         : number
  blocktime?    : number
  fee?          : number
}

// ============================================================================
// Block Fixtures
// ============================================================================

/**
 * Block header fixture
 */
export interface BlockHeaderFixture extends BlockHeader {
  // Inherits all BlockHeader fields
}

/**
 * Full block fixture
 */
export interface FullBlockFixture {
  header : BlockHeaderFixture
  txids  : string[]
  txs?   : TransactionFixture[]
}

// ============================================================================
// Wallet Fixtures
// ============================================================================

/**
 * Wallet descriptor fixture
 */
export interface DescriptorFixture {
  desc     : string
  timestamp: number
  active   : boolean
  internal : boolean
  range    : [number, number]
  next     : number
}

/**
 * Full wallet fixture
 */
export interface FullWalletFixture {
  name        : string
  info        : WalletInfoFixture
  descriptors : DescriptorFixture[]
  utxos       : UTXO[]
  addresses   : string[]
}

// ============================================================================
// Config Fixtures
// ============================================================================

/**
 * Core config fixture
 */
export interface CoreConfigFixture {
  corepath  : string
  clipath   : string
  datapath  : string
  confpath  : string
  network   : 'regtest' | 'testnet' | 'signet' | 'main'
  isolated  : boolean
  debug     : boolean
  verbose   : boolean
  timeout   : number
}

// ============================================================================
// Error Fixtures
// ============================================================================

/**
 * RPC error fixture
 */
export interface RPCErrorFixture {
  code    : number
  message : string
}

/**
 * Common RPC error codes
 */
export const RPC_ERROR_CODES = {
  INVALID_REQUEST      : -32600,
  METHOD_NOT_FOUND     : -32601,
  INVALID_PARAMS       : -32602,
  INTERNAL_ERROR       : -32603,
  PARSE_ERROR          : -32700,
  MISC_ERROR           : -1,
  WALLET_NOT_FOUND     : -18,
  WALLET_NOT_LOADED    : -18,
  INVALID_ADDRESS      : -5,
  INVALID_PARAMETER    : -8,
  DATABASE_ERROR       : -20,
  DESERIALIZATION_ERROR: -22,
  VERIFY_ERROR         : -25,
  VERIFY_REJECTED      : -26,
  VERIFY_ALREADY_IN_CHAIN : -27,
  IN_WARMUP            : -28
} as const
