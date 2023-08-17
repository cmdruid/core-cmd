import fs from 'fs/promises'

export async function check_path_exists (filepath : string) {
  try {
    await fs.access(filepath)
    return true
  } catch (err) {
    return false
  }
}

export async function ensure_path_exists(path : string) {
  if (!await check_path_exists(path)) {
    await fs.mkdir(path)
  }
}

export async function ensure_file_exists(filepath : string) {
  if (!await check_path_exists(filepath)) {
    await fs.writeFile(filepath, '')
  }
}
