import { access, constants, mkdir, writeFile } from 'fs/promises'

import { TxOutput } from '../types/index.js'

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

export function is_uint (
  value : unknown,
  max_val = Number.MAX_SAFE_INTEGER
) : value is number {
  if (typeof value === 'string') {
    value = Number(value)
  }
  if (typeof value !== 'number') {
    return false
  }
  return (
    typeof value === 'number' &&
    !isNaN(value)             &&
    value >= 0                &&
    value <= max_val          &&
    Math.floor(value) === value
  )
}
