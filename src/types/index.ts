export * from './config.js'
export * from './core.js'
export * from './descriptors.js'
export * from './events.js'
export * from './info.js'
export * from './scan.js'
export * from './wallet.js'

export type Literal = string | number | boolean | null

export type MethodArgs = Literal | Literal[] | Record<string, any>
