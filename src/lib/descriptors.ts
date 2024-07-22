import { ExtKey }       from '@cmdcode/crypto-tools'
import { parse_extkey } from '@cmdcode/crypto-tools/hd'
import { hash160 }      from '@cmdcode/crypto-tools/hash'
import { is_uint }      from './util.js'

import {
  DescriptorData,
  DescriptorItem,
  DescriptorMeta
} from '../types/index.js'

const DESC_REGEX = /^(?<keytype>[\w\(]+)\((?:\[(?<parent_label>[0-9a-zA-Z]+)(?<parent_path>[0-9h\/\'\*]+)\]*)*(?<keystr>\w+)+((?<path>\/[0-9h\/\'\*]+)(\/\*)*)*\)+#(?<checksum>\w+)$/

export function parse_desc_item (
 item : DescriptorItem
) : DescriptorData {
  const meta = parse_descriptor(item.desc)
  return { ...item, ...meta }
}

export function parse_descriptor (
  desc : string
) : DescriptorMeta {
  const matches = desc.match(DESC_REGEX)

  if (matches === null) {
    throw new Error('Unable to parse descriptor:' + desc)
  }

  let { keytype, keystr, path, parent_path, parent_label, checksum } = matches.groups ?? {}

  const is_parent   = (parent_label === undefined)
  const is_extended = (keystr.startsWith('x') || keystr.startsWith('t'))

  let relpath = '', fullpath = ''

  if (parent_path !== undefined) {
    parent_path = parent_path.replace(/h/g, '\'')
    fullpath += parent_path
  }

  if (path !== undefined) {
    path = path.replace(/h/g, '\'')
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

  const [ purpose, network, account, cointype, idx ] = pathdata

  const index = (idx === undefined || idx === '*') ? '0' : idx

  let extkey : ExtKey | undefined,
      label  : string

  if (is_extended) {
    extkey = parse_extkey(keystr)
    label  = hash160(extkey.pubkey).slice(0, 4).hex
  } else {
    extkey = undefined
    label  = hash160(keystr).slice(0, 4).hex
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
    descriptor : desc,
    is_private : (keystr.startsWith('xprv') || keystr.startsWith('tprv')),
    keytype    : keytype.replace('(', '-'),
    purpose    : parse_segment(purpose),
    network    : parse_segment(network),
    account    : parse_segment(account),
    cointype   : parse_segment(cointype),
    index      : parse_segment(index)
  }
}

export function parse_segment (segment : string) {
  // Set default harden state to false.
  let hardened = false
  // Check if segment contains hardening.
  if (segment.endsWith('\'') || segment.endsWith('h')) {
    // Set hardened flag to true.
    hardened = true
    // Remove the hardening flag.
    segment = segment.slice(0, -1)
  }
  // Check if the remaining value is a number.
  if (!is_uint(segment)) {
    throw new Error('invalid descriptor path segment: ' + segment)
  }
  // Return the proper number value.
  return (hardened)
    ? Number(segment) * -1
    : Number(segment)
}
