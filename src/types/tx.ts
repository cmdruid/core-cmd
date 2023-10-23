export type TxStatus = TxConfirmed | TxUnconfirmed
export type TxInput  = BaseInput | CoinInput

export interface ScriptKey {
  asm      : string
  desc     : string
  hex      : string
  address ?: string
  type     : string
}

interface BaseInput {
  txid        : undefined,
  vout        : undefined,
  scriptSig   : undefined
  txinwitness : string[],
  sequence    : number,
  coinbase    : string
}

interface CoinInput {
  txid        : string,
  vout        : number,
  scriptSig   : { asm : string, hex : string },
  txinwitness : string[],
  sequence    : number
  coinbase    : undefined
}

export interface TxOutput {
  n            : number
  value        : number
  scriptPubKey : ScriptKey
}

export interface TxResult {
  txid     : string
  hash     : string
  version  : number
  size     : number
  vsize    : number
  weight   : number
  locktime : number
  hex      : string
  vin      : TxInput[]
  vout     : TxOutput[]
  fee           ?: number
  blockhash     ?: string
  confirmations ?: number
  time          ?: number
  blocktime     ?: number
}

export interface TxConfirmed {
  confirmed    : true
  block_hash   : string
  block_height : number
  block_time   : number
}

export interface TxUnconfirmed {
  confirmed : false
}

export interface TxOutpoint {
  bestblock     : string
  confirmations : number
  value         : number
  scriptPubKey  : ScriptKey
  coinbase      : boolean
}