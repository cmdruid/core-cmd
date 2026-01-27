import { CoreClient } from '../class/client.js'
import type { BlockEvent, TransactionEvent, SequenceEvent } from '../class/zmq.js'
import type { StateChangeEvent } from '../class/state.js'

export interface CoreEvent {
  // Lifecycle events
  'ready': CoreClient
  'shutdown': void

  // State events (forwarded from DaemonStateMachine)
  'state:change': StateChangeEvent
  'state:error': Error

  // Generic block/transaction events (from either ZMQ or Polling)
  'block': BlockEvent
  'transaction': TransactionEvent
  'events:error': Error

  // ZMQ-specific events (forwarded from ZMQEventBus)
  'zmq:block': BlockEvent
  'zmq:transaction': TransactionEvent
  'zmq:sequence': SequenceEvent
  'zmq:connected': void
  'zmq:disconnected': void
}
