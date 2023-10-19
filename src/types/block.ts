export interface BlockQuery {
  hash   ?: string
  height ?: number
}

export interface BlockHeader {
  hash              : string,
  confirmations     : number,
  height            : number,
  version           : number,
  versionHex        : string,
  merkleroot        : string,
  time              : number,
  mediantime        : number,
  nonce             : number,
  bits              : string,
  difficulty        : number,
  chainwork         : string,
  nTx               : number,
  previousblockhash : string
}

export interface BlockData extends BlockHeader {
  strippedsize : number,
  size         : number,
  weight       : number,
  tx           : string[]
}