export * from './config.js'
export * from './events.js'
export * from './descriptors.js'
export * from './core.js'
export * from './wallet.js'

export type MethodArgs = string | string[] | Record<string, any>

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
