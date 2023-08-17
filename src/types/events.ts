import { CoreClient } from '../lib/client.js'

export type CoreEvent = ReadyEvent

interface ReadyEvent {
  'ready' : CoreClient
}