import { dirname }       from 'path'
import { fileURLToPath } from 'url'

export const ROOT_PATH = dirname(dirname(fileURLToPath(import.meta.url)))
