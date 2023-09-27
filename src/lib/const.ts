export const DUST_LIMIT     = 1_000
export const FALLBACK_FEE   = 5_000
export const FAUCET_MIN_BAL = 10_000_000_000
export const MIN_TX_FEE     = 1_000
export const RATE_LIMIT     = 0
export const SAT_MULTI      = 100_000_000

export const RANDOM_PORT = () => Math.floor((Math.random() * 10 ** 5 % 25_000) + 25_000)
export const RANDOM_SORT = () => Math.random() > 0.5 ? 1 : -1
