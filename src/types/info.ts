export type TxResult = TxConfirmedResult | TxUnconfirmedResult
export type TxStatus = TxUnconfimed | TxConfirmed

export interface AddressInfo {
  address         : string
  scriptPubKey    : string
  ismine          : boolean
  solvable        : boolean
  desc            : string
  iswatchonly     : boolean,
  isscript        : boolean,
  iswitness       : boolean,
  witness_version : number,
  witness_program : string
  pubkey          : string
  ischange        : boolean
  timestamp       : number
  hdkeypath       : string
  hdseedid        : string
  labels          : string[]
  hdmasterfingerprint : string
}

export interface TxResultData {
  txid     : string,
  hash     : string,
  version  : number,
  size     : number,
  vsize    : number,
  weight   : number,
  locktime : number,
  hex      : string
  vin: [{
    txid        : string,
    vout        : number,
    scriptSig   : { asm : string, hex : string },
    txinwitness : string[],
    sequence    : number
  }],
  vout: [{
    n     : number
    value : number, 
    scriptPubKey : ScriptKeyResult
  }],
}

export interface TxUnconfirmedResult extends TxResultData {
  blockhash     ?: string
  confirmations ?: number
  time          ?: number
  blocktime     ?: number
}

export interface TxConfirmedResult extends TxResultData {
  blockhash     : string
  confirmations : number
  time          : number
  blocktime     : number
}

export interface TxUnconfimed {
  confirmed      : false
}

export interface TxConfirmed {
  confirmed     : true
  blockhash     : string
  confirmations : number
  time          : number
}

export interface ScriptKeyResult {
  asm     : string,
  desc    : string,
  hex     : string,
  address : string,
  type    : string
}
