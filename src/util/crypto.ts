import { ECC, Hash } from '@vbyte/crypto'

// Hash utilities
export function hash256(data: Uint8Array): Uint8Array {
  return Hash.hash256(data)
}

export function hash160(data: Uint8Array): Uint8Array {
  return Hash.hash160(data)
}

export function sha256_hash(data: Uint8Array): Uint8Array {
  return Hash.sha256(data)
}

// Key utilities
export function get_public_key(private_key: Uint8Array, compressed = true): Uint8Array {
  const format = compressed ? 'ecdsa' : 'ecdsa'  // ecdsa is always compressed in @vbyte/crypto
  return ECC.get_pubkey(private_key, format)
}

export function sign_message(private_key: Uint8Array, message: Uint8Array): Uint8Array {
  return ECC.sign_ecdsa(private_key, message)
}

export function sign_schnorr(private_key: Uint8Array, message: Uint8Array): Uint8Array {
  return ECC.sign_bip340(private_key, message)
}

export function verify_signature(
  public_key: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  try {
    return ECC.verify_ecdsa(signature, message, public_key)
  } catch {
    return false
  }
}

export function verify_schnorr(
  public_key: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  try {
    return ECC.verify_bip340(signature, message, public_key)
  } catch {
    return false
  }
}

// Key validation
export function is_valid_private_key(key: Uint8Array): boolean {
  try {
    ECC.verify_seckey(key)
    return true
  } catch {
    return false
  }
}
