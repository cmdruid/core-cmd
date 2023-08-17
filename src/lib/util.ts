import fs from 'fs/promises'

export async function ensure_path_exists(path : string) {
  try {
    await fs.access(path)
  } catch (err) {
    await fs.mkdir(path)
  }
}
