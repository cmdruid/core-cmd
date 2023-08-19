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
  hdmasterfingerprint: string
}

export interface TxResult {
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
  }]
}

export interface ScriptKeyResult {
  asm     : string,
  desc    : string,
  hex     : string,
  address : string,
  type    : string
}
