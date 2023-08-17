import { ExtKey, hash, hd } from '@cmdcode/crypto-utils'

import {
  DescriptorData,
  DescriptorItem,
  DescriptorMeta
} from '../types/index.js'

const DESC_REGEX = /^(?<keytype>\w+\()+(\[(?<parent_label>[0-9a-fA-F]+)(?<parent_path>[0-9\/\']+)\])*(?<keystr>\w+)+((?<path>\/[0-9'\/]+)(\/\*)*)*\)+#(?<checksum>\w+)$/

export function parse_descriptor (
 item : DescriptorItem
) : DescriptorData {
  const meta = parse_desc(item.desc)
  return { ...item, ...meta }
}

export function parse_desc (
  desc : string
) : DescriptorMeta {
  const matches = desc.match(DESC_REGEX)

  if (matches === null) {
    throw new Error('Unable to parse descriptor:' + desc)
  }

  const { keytype, keystr, path, parent_path, parent_label, checksum } = matches.groups ?? {}

  const is_parent   = (parent_label === undefined)
  const is_extended = (keystr.startsWith('x') || keystr.startsWith('t'))

  let relpath = '', fullpath = ''

  if (parent_path !== undefined) {
    fullpath += parent_path
  }

  if (path !== undefined) {
    relpath  += path
    fullpath += path
  }

  let pathdata = fullpath.split('/')

  if (pathdata[0] === 'm' || pathdata[0] === '') {
    pathdata = pathdata.slice(1)
  }

  if (pathdata.length < 4) {
    throw new Error('Full path is invalid.')
  }

  const [ purpose, cointype, account, sub ] = pathdata

  let extkey : ExtKey | undefined,
      label  : string

  if (is_extended) {
    extkey = hd.decode_extkey(keystr)
    label  = hash.hash160(extkey.pubkey).slice(0, 4).hex
  } else {
    extkey = undefined
    label  = hash.hash160(keystr).slice(0, 4).hex
  }

  return {
    extkey,
    keystr,
    checksum,
    relpath,
    fullpath,
    label,
    is_parent,
    is_extended,
    parent_label,
    is_private : (keystr.startsWith('xprv') || keystr.startsWith('tprv')),
    keytype    : keytype.replace('(', ''),
    purpose    : parseInt(purpose.replace('\'', '')),
    cointype   : parseInt(cointype.replace('\'', '')),
    account    : parseInt(account.replace('\'', '')),
    sub        : parseInt(sub.replace('\'', '')),
  }
}
