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
