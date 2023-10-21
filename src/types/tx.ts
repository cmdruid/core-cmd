export type TxStatus = TxConfirmed | TxUnconfirmed

export interface ScriptKey {
  asm     : string
  desc    : string
  hex     : string
  address : string
  type    : string
}

export interface TxInput {
  txid        : string,
  vout        : number,
  scriptSig   : { asm : string, hex : string },
  txinwitness : string[],
  sequence    : number
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
  blockhash     ?: string
  confirmations ?: number
  time          ?: number
  blocktime     ?: number
}

export interface TxUnconfirmed {
  confirmed : false
}

export interface TxConfirmed {
  confirmed    : true
  block_hash   : string
  block_height : number
  block_time   : number
}

export interface TxOutpoint {
  bestblock     : string
  confirmations : number
  value         : number
  scriptPubKey  : ScriptKey
  coinbase      : boolean
}