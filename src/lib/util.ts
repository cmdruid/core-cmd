import { access, constants, mkdir, writeFile } from 'fs/promises'

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
