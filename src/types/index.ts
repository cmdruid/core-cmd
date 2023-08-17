export * from './events.js'
export * from './descriptors.js'
export * from './wallet.js'

export type CLIConfig = CoreConfig

export type MethodArgs = string | string[] | Record<string, any>

export interface CoreConfig {
  cmdpath   : string
  confpath ?: string
  datapath  : string
  network   : string
  params    : string[]
}
