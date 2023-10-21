export type ScanAction = 'start' | 'abort' | 'status'

export interface ScanObject {
  desc  : string
  range : number | number[]
}

export interface ScanOptions {
  address ?: string
  pubkey  ?: string
  script  ?: string
}

export interface ScanResults {
  success      : boolean
  txouts       : number
  height       : number
  bestblock    : string
  unspents     : UTXOResult[]
  total_amount : number
}

export interface UTXOResult {
  txid         : string
  vout         : number
  desc         : string
  amount       : number
  height       : number
  coinbase     : boolean
  scriptPubKey : string
}
