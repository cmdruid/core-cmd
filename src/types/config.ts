export type CLIConfig = CoreConfig

export interface CoreConfig {
  corepath    : string
  cookiepath ?: string
  clipath     : string
  confpath   ?: string
  datapath    : string
  isolated    : boolean
  network     : string
  rpcport     : number
  params      : string[]
}

export interface AddressConfig {
  label ?: string
  type  ?: 'legacy' | 'p2sh-segwit' | 'bech32'
}
