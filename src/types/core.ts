import { CoreClient } from '../index.js'

export type RunMethod = (client : CoreClient) => void | Promise<void>