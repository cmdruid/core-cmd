export * from '@/types/address.js'
export * from '@/types/block.js'
export * from '@/types/config.js'
export * from '@/types/core.js'
export * from '@/types/descriptors.js'
export * from '@/types/events.js'
export * from '@/types/info.js'
export * from '@/types/scan.js'
export * from '@/types/tx.js'
export * from '@/types/wallet.js'

export type Literal = string | number | boolean | null

export type MethodArgs = Literal | Literal[] | Record<string, any>
