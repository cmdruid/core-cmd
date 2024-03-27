import { access, constants, mkdir, writeFile } from 'fs/promises'

import { TxOutput } from '../types/index.js'

export const sleep = (ms = 1000) => new Promise(res => setTimeout(res, ms))

export function now () {
  return Math.floor(Date.now() / 1000)
}

export async function path_exists (filepath : string) {
  try {
    await access(filepath, constants.R_OK | constants.W_OK)
    return true
  } catch (err) {
    return false
  }
}

export async function ensure_path(path : string) {
  if (!await path_exists(path)) {
    await mkdir(path)
  }
}

export async function ensure_file(filepath : string) {
  if (!await path_exists(filepath)) {
    await writeFile(filepath, '')
  }
}

export function convert_value (value : number) {
  return Math.round(value * 100_000_000)
}

export function convert_vout (vout : TxOutput[]) {
  return vout.map(e => {
    return { ...e, value : convert_value(e.value) }
  })
}

export function clone <T> (data : T) {
  // Handle null, undefined, and non-objects (primitives)
  if (data === null) return null

  if (typeof data === 'string')  return String(data)
  if (typeof data === 'number')  return Number(data)
  if (typeof data === 'bigint')  return BigInt(data)
  if (typeof data === 'boolean') return Boolean(data)

  if (data instanceof Date) {
    return new Date(data.getTime())
  }

  if (Array.isArray(data)) {
    const arrCopy : any[] = []
    data.forEach((val, i) => {
      arrCopy[i] = clone(val)
    })
    return arrCopy
  }

  if (typeof data === 'object') {
    const objCopy : Record<any, any> = {}
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        objCopy[key] = clone(data[key])
      }
    }
    return objCopy;
  }
  
  throw new TypeError('Content type not supported: ' + typeof data)
}
