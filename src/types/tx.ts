export type TxStatus = TxStatusUnconfimed | TxStatusConfirmed

export interface TxStatusUnconfimed {
  confirmed : false
}

export interface TxStatusConfirmed {
  confirmed    : true
  block_hash   : string
  block_height : number
  block_time   : number
}