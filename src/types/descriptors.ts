import { ExtKey } from '@cmdcode/crypto-utils'

export type DescriptorData = DescriptorItem & DescriptorMeta

export interface DescriptorItem {
  desc      : string
  timestamp : number
  active    : boolean
  internal  : boolean
  range     : number[]
  next      : number
}

export interface DescriptorMeta {
  extkey      ?: ExtKey
  keystr       : string
  is_extended  : boolean
  is_parent    : boolean
  is_private   : boolean
  parent_label : string
  checksum     : string
  relpath      : string
  fullpath     : string
  label        : string
  keytype      : string
  purpose      : number
  cointype     : number
  account      : number
  sub          : number
}
