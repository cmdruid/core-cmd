import { access, constants, mkdir, writeFile } from 'fs/promises'

export async function check_path_exists (filepath : string) {
  try {
    await access(filepath, constants.R_OK | constants.W_OK)
    return true
  } catch (err) {
    return false
  }
}

export async function ensure_path_exists(path : string) {
  if (!await check_path_exists(path)) {
    console.log('path does not exist:', path)
    await mkdir(path)
  }
}

export async function ensure_file_exists(filepath : string) {
  if (!await check_path_exists(filepath)) {
    await writeFile(filepath, '')
  }
}
