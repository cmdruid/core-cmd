// External dependencies
import { EventEmitter, sleep } from '@vbyte/util'

// Internal modules
import * as CONST                from '@/const.js'
import { core_config }           from '@/config.js'
import { check_process }         from '@/lib/cmd.js'
import { create_core_debug }     from '@/util/debug.js'
import { CoreClient }            from '@/class/client.js'
import { CoreWallet }            from '@/class/wallet.js'
import { ProcessError, WalletError } from '@/class/errors.js'
import { DaemonStateMachine, DaemonState, StateChangeEvent } from '@/class/state.js'
import { ZMQEventBus, BlockEvent, TransactionEvent, SequenceEvent } from '@/class/zmq.js'
import { createEventBus, startEventBus, stopEventBus, EventBus, EventBusType } from '@/class/events.js'
import {
  ProcessController,
  SpawnedProcess,
  ConnectedProcess,
  ProcessState
} from '@/class/process.js'

// Type imports
import type {
  CoreConfig,
  CoreEvent,
  RunMethod
} from '@/types/index.js'

const debug = create_core_debug('daemon')

const { FALLBACK_FEE, FAUCET_MIN_BAL, INIT_BLOCK_CT, SAT_MULTI } = CONST

export class CoreDaemon extends EventEmitter<CoreEvent> {
  readonly _client: CoreClient
  readonly _opt: CoreConfig
  readonly params: string[]
  readonly tasks: RunMethod[]

  private _controller: ProcessController
  private _closing: boolean
  private _faucet: CoreWallet | null
  private _stateMachine: DaemonStateMachine
  private _zmq: ZMQEventBus | null
  private _events: EventBus | null
  private _events_type: EventBusType
  private _errorHandler?: (err: Error) => void

  private constructor(controller: ProcessController, opt: CoreConfig, params: string[]) {
    super()

    this._controller = controller
    this._client = controller.get_client()
    this._opt = opt
    this.params = params
    this._closing = false
    this._faucet = null
    this._stateMachine = new DaemonStateMachine()
    this._zmq = null
    this._events = null
    this._events_type = 'none'
    this.tasks = []

    // Setup safemode handlers if enabled
    if (opt.safemode) {
      this._setupErrorHandling()
    }

    // Forward state machine events
    this._stateMachine.on('state:change', (event: StateChangeEvent) => {
      debug('state transition: %s -> %s', event.from, event.to)
      this.emit('state:change', event)
    })

    this._stateMachine.on('state:error', (error: Error) => {
      this.emit('state:error', error)
    })
  }

  // ============================================================
  // Static factory methods
  // ============================================================

  /**
   * Spawn a new Bitcoin Core process and wait until ready
   */
  static async spawn(config?: Partial<CoreConfig>): Promise<CoreDaemon> {
    const opt = prepare_config(config)
    const params = build_params(opt)
    const client = new CoreClient(null as any, opt)

    const controller = new SpawnedProcess(opt, client, params)
    const daemon = new CoreDaemon(controller, opt, params)

    // Fix circular dependency
    client._core = daemon

    try {
      debug('spawning new Bitcoin Core process')
      daemon._stateMachine.transition(DaemonState.Starting)
      await controller.start()
      daemon._stateMachine.transition(DaemonState.ProcessRunning)
      daemon._stateMachine.transition(DaemonState.Initializing)
      await daemon._init()
      daemon._stateMachine.transition(DaemonState.Ready)
    } catch (err) {
      daemon._stateMachine.setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }

    return daemon
  }

  /**
   * Connect to an existing Bitcoin Core process
   */
  static async connect(config?: Partial<CoreConfig>): Promise<CoreDaemon> {
    const opt = prepare_config(config)
    const params = build_params(opt)
    const client = new CoreClient(null as any, opt)

    const controller = new ConnectedProcess(opt, client)
    const daemon = new CoreDaemon(controller, opt, params)

    // Fix circular dependency
    client._core = daemon

    try {
      debug('connecting to existing Bitcoin Core process')
      daemon._stateMachine.transition(DaemonState.Starting)
      await controller.start()
      daemon._stateMachine.transition(DaemonState.ProcessRunning)
      daemon._stateMachine.transition(DaemonState.Initializing)
      await daemon._init()
      daemon._stateMachine.transition(DaemonState.Ready)
    } catch (err) {
      daemon._stateMachine.setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }

    return daemon
  }

  /**
   * Check if a Bitcoin Core process is running
   * @param name Process name to check. If not specified, checks for both 'bitcoind' and 'bitcoin-qt'
   * @returns true if the specified process (or either default) is detected
   */
  static async exists(name?: string): Promise<boolean> {
    if (name !== undefined) {
      return check_process(name)
    }
    const has_daemon = await check_process('bitcoind')
    const has_qt     = await check_process('bitcoin-qt')
    return has_daemon || has_qt
  }

  /**
   * Automatically connect to an existing Bitcoin Core process if running,
   * otherwise spawn a new one
   * @param config Configuration options
   * @returns CoreDaemon instance (connected or spawned)
   */
  static async auto(config?: Partial<CoreConfig>): Promise<CoreDaemon> {
    if (await CoreDaemon.exists()) {
      return CoreDaemon.connect(config)
    } else {
      return CoreDaemon.spawn(config)
    }
  }

  // ============================================================
  // Getters
  // ============================================================

  get client(): CoreClient {
    return this._client
  }

  get faucet(): CoreWallet {
    if (this._faucet === null) {
      throw new WalletError('Faucet wallet is not loaded', 'faucet', 'get_faucet')
    }
    return this._faucet
  }

  get opt(): CoreConfig {
    return this._opt
  }

  /**
   * Check if daemon is ready for operations
   */
  get isReady(): boolean {
    return this._stateMachine.isReady
  }

  /**
   * Get the current process state
   */
  get state(): ProcessState {
    return this._controller.get_state()
  }

  /**
   * Get the daemon state machine state
   */
  get daemonState(): DaemonState {
    return this._stateMachine.state
  }

  get zmq(): ZMQEventBus | null {
    return this._zmq
  }

  /**
   * Get the active event bus (ZMQ or Polling)
   */
  get events(): EventBus | null {
    return this._events
  }

  /**
   * Get the type of event bus in use
   */
  get events_type(): EventBusType {
    return this._events_type
  }

  // ============================================================
  // Private methods
  // ============================================================

  private _setupErrorHandling(): void {
    // Only handle errors that are clearly related to our daemon
    this._errorHandler = (err: Error) => {
      if (this._isOurError(err)) {
        debug('daemon-related error, shutting down: %s', err.message)
        this.shutdown().catch(console.error)
      }
      // Let other errors propagate normally
    }

    process.once('uncaughtException', this._errorHandler)

    process.once('unhandledRejection', async (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason))
      if (this._isOurError(err)) {
        debug('daemon caught a promise rejection, exiting...')
        await this.shutdown()
      }
    })
  }

  private _isOurError(err: Error): boolean {
    return (
      err instanceof ProcessError ||
      err.name === 'ProcessError' ||
      err.name === 'ConnectionError' ||
      err.name === 'RPCError' ||
      (err.message?.includes('Bitcoin') ?? false) ||
      (err.message?.includes('bitcoind') ?? false) ||
      (err.message?.includes('bitcoin-cli') ?? false)
    )
  }

  // ============================================================
  // Initialization
  // ============================================================

  private async _init() {
    const delay = this.opt.init_delay
    const min_bal = FAUCET_MIN_BAL / SAT_MULTI

    if (delay > 0) {
      debug('init process sleeping for %d seconds...', delay)
      const ms = Math.floor(delay * 1000)
      await sleep(ms)
    }

    debug('loading faucet wallet')
    this._faucet = await this.client.load_wallet('faucet')
    const addr = await this.faucet.get_address('faucet')
    let bal = await this.faucet.get_balance()

    if (this.opt.network === 'regtest' && bal <= min_bal) {
      debug('faucet generating blocks...')
      const end = debug.time('mine-blocks')
      await this.client.mine_blocks(INIT_BLOCK_CT, addr)
      end()
      bal = await this.faucet.get_balance()
    }

    debug('faucet address: %s', addr)
    debug.info('faucet balance: %d sats', bal)

    if (bal <= min_bal) {
      throw new WalletError('Faucet has insufficient funds', 'faucet', '_init')
    }

    await Promise.all(this.tasks.map(t => t(this.client)))

    // Initialize event bus using factory
    const { type, bus } = await createEventBus(this._client, this.opt)
    this._events_type = type
    this._events = bus

    if (bus) {
      // Forward events to CoreDaemon
      bus.on('block', (block: BlockEvent) => {
        this.emit('block', block)
        // Also emit with zmq: prefix for backward compatibility
        if (type === 'zmq') {
          this.emit('zmq:block', block)
        }
      })

      bus.on('transaction', (tx: TransactionEvent) => {
        this.emit('transaction', tx)
        if (type === 'zmq') {
          this.emit('zmq:transaction', tx)
        }
      })

      // ZMQ-only events
      if (type === 'zmq') {
        bus.on('sequence', (seq: SequenceEvent) => {
          this.emit('zmq:sequence', seq)
        })

        // Keep reference to ZMQ bus for backward compatibility
        this._zmq = bus as unknown as ZMQEventBus

        this._zmq.on('connected', () => {
          this.emit('zmq:connected', undefined)
        })

        this._zmq.on('disconnected', () => {
          this.emit('zmq:disconnected', undefined)
        })
      }

      bus.on('error', (err: Error) => {
        debug('event bus error: %O', err)
        this.emit('events:error', err)
      })

      // Start the event bus
      try {
        await startEventBus(bus)
        debug('%s event bus started', type)
      } catch (err) {
        debug('event bus start failed: %O', err)
        // Non-fatal: events are optional
      }
    }

    debug('daemon ready')
    this.emit('ready', this.client)
  }

  // ============================================================
  // Public methods
  // ============================================================

  /**
   * Start up the Bitcoin Core daemon (for backward compatibility)
   */
  async startup(): Promise<CoreClient> {
    try {
      this._stateMachine.transition(DaemonState.Starting)
      await this._controller.start()
      this._stateMachine.transition(DaemonState.ProcessRunning)
      this._stateMachine.transition(DaemonState.Initializing)
      await this._init()
      this._stateMachine.transition(DaemonState.Ready)
    } catch (err) {
      this._stateMachine.setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
    return this._client
  }

  /**
   * Gracefully shut down the daemon
   */
  async shutdown(): Promise<void> {
    if (!this._closing) {
      this._closing = true
      debug('shutting down daemon')

      if (this._stateMachine.isRunning) {
        this._stateMachine.transition(DaemonState.ShuttingDown)
      }

      // Stop event bus if running
      if (this._events?.is_connected()) {
        await stopEventBus(this._events)
      }

      await this._controller.cleanup()

      if (this._stateMachine.state === DaemonState.ShuttingDown) {
        this._stateMachine.transition(DaemonState.Stopped)
      }

      debug('shutdown complete')
      this.emit('shutdown', undefined)
    }
  }

  /**
   * Wait for the daemon to become ready
   * @param timeout Maximum time to wait in milliseconds
   */
  async wait_for_ready(timeout?: number): Promise<void> {
    return this._stateMachine.wait_for_ready(timeout)
  }

  /**
   * Run methods with the client, then shutdown
   *
   * Unlike the previous implementation, this does NOT swallow errors.
   * If any method throws, the error will be propagated after shutdown.
   *
   * @param methods Functions to run with the client
   * @returns Array of results (errors are thrown, not returned)
   */
  async run(...methods: RunMethod[]): Promise<void[]> {
    const results: void[] = []
    const errors: Error[] = []

    for (const fn of methods) {
      try {
        await fn(this.client)
        results.push(undefined)
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)))
      }
    }

    await this.shutdown()

    if (errors.length > 0) {
      // Throw an AggregateError if multiple errors, otherwise throw the single error
      if (errors.length === 1) {
        throw errors[0]
      }
      throw new AggregateError(errors, `${errors.length} task(s) failed`)
    }

    return results
  }

  /**
   * Run methods in parallel, then shutdown
   * Returns PromiseSettledResult array so caller can inspect failures
   */
  async run_parallel(...methods: RunMethod[]): Promise<PromiseSettledResult<void>[]> {
    const results = await Promise.allSettled(
      methods.map(fn => fn(this.client))
    )
    await this.shutdown()
    return results
  }
}

// ============================================================
// Helper functions
// ============================================================

function prepare_config(config?: Partial<CoreConfig>): CoreConfig {
  const opt = core_config(config)

  if (opt.network === 'bitcoin') {
    opt.network = 'main'
  }

  if (opt.network === 'testnet') {
    opt.network = 'test'
  }

  // Isolated mode: use random RPC port to avoid conflicts with other instances
  if (opt.isolated && opt.rpc_port === undefined) {
    opt.rpc_port = CONST.randomPort()
    debug('isolated mode: using random RPC port %d', opt.rpc_port)
  }

  return opt
}

function build_params(opt: CoreConfig): string[] {
  const params = [
    `-chain=${opt.network}`,
    `-fallbackfee=${FALLBACK_FEE / SAT_MULTI}`,
    ...opt.params,
    ...opt.core_params
  ]

  // Isolated mode: disable P2P listening to avoid port conflicts
  if (opt.isolated) {
    params.push('-listen=0')
  }

  if (opt.peer_port !== undefined) {
    params.push(`-port=${opt.peer_port}`)
  }

  if (opt.rpc_port !== undefined) {
    params.push(`-rpcport=${opt.rpc_port}`)
  }

  if (opt.confpath !== undefined) {
    params.push(`-conf=${opt.confpath}`)
  }

  if (opt.datapath !== undefined) {
    params.push(`-datadir=${opt.datapath}`)
  }

  return params
}
