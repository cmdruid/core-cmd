import { Buff } from '@vbyte/buff'

// Encoding/decoding utilities
export function encode_base64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64')
}

export function decode_base64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64'))
}

export function encode_hex(data: Uint8Array): string {
  return new Buff(data).hex
}

export function decode_hex(hex: string): Uint8Array {
  return Buff.hex(hex)
}

export function encode_utf8(str: string): Uint8Array {
  return Buff.str(str)
}

export function decode_utf8(data: Uint8Array): string {
  return new Buff(data).str
}

// Number encoding
export function encode_varint(num: number): Uint8Array {
  if (num < 0xfd) {
    return new Uint8Array([num])
  } else if (num <= 0xffff) {
    const buf = new Uint8Array(3)
    buf[0] = 0xfd
    buf[1] = num & 0xff
    buf[2] = (num >> 8) & 0xff
    return buf
  } else if (num <= 0xffffffff) {
    const buf = new Uint8Array(5)
    buf[0] = 0xfe
    buf[1] = num & 0xff
    buf[2] = (num >> 8) & 0xff
    buf[3] = (num >> 16) & 0xff
    buf[4] = (num >> 24) & 0xff
    return buf
  } else {
    throw new Error('Number too large for varint encoding')
  }
}

export function decode_varint(data: Uint8Array): { value: number; size: number } {
  const first = data[0]
  
  if (first < 0xfd) {
    return { value: first, size: 1 }
  } else if (first === 0xfd) {
    const value = data[1] | (data[2] << 8)
    return { value, size: 3 }
  } else if (first === 0xfe) {
    const value = data[1] | (data[2] << 8) | (data[3] << 16) | (data[4] << 24)
    return { value, size: 5 }
  } else {
    throw new Error('64-bit varint not supported')
  }
}

// Little-endian number encoding
export function encode_uint32_le(num: number): Uint8Array {
  const buf = new Uint8Array(4)
  buf[0] = num & 0xff
  buf[1] = (num >> 8) & 0xff
  buf[2] = (num >> 16) & 0xff
  buf[3] = (num >> 24) & 0xff
  return buf
}

export function decode_uint32_le(data: Uint8Array): number {
  return data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)
}

export function encode_uint64_le(num: bigint): Uint8Array {
  const buf = new Uint8Array(8)
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((num >> BigInt(i * 8)) & 0xffn)
  }
  return buf
}

export function decode_uint64_le(data: Uint8Array): bigint {
  let result = 0n
  for (let i = 0; i < 8; i++) {
    result |= BigInt(data[i]) << BigInt(i * 8)
  }
  return result
}