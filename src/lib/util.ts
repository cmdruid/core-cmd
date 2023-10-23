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
  return (is_float(value)) ? value * 100_000_000 : value
}

export function convert_vout (vout : TxOutput[]) {
  return vout.map(e => {
    return { ...e, value : convert_value(e.value) }
  })
}

function is_float(value : number) {
    return Number(value) === value && value % 1 !== 0
}
