/**
 * Unit tests for validation module
 *
 * Tests security-critical validation functions:
 * - Process name validation (command injection prevention)
 * - Bitcoin address validation (by network and type)
 * - Public key validation (length and prefix)
 * - Amount validation (bounds, overflow, negative)
 * - Path validation (traversal, shell chars)
 * - Credential sanitization
 */

import type { TapeHarness, MockTestContext } from '../../../lib/types/test.types.js'

import {
  validate_process_name,
  validate_address,
  assert_valid_address,
  validate_pubkey,
  validate_amount,
  assert_valid_amount,
  validate_path,
  sanitize_for_log,
  sanitize_params_for_log,
  validate_block_count,
  validate_descriptor_input,
  ALLOWED_PROCESS_NAMES,
  MAX_SATS
} from '../../../../src/lib/validation.js'

export default function validation_unit_tests(
  tape: TapeHarness,
  _ctx: MockTestContext
): void {
  // =========================================================================
  // Process Name Validation Tests
  // =========================================================================

  tape('validate_process_name - accepts valid process names', async (t) => {
    for (const name of ALLOWED_PROCESS_NAMES) {
      const result = validate_process_name(name)
      t.equal(result, name, `Accepts ${name}`)
    }
    t.end()
  })

  tape('validate_process_name - rejects invalid process names', async (t) => {
    const invalid_names = [
      'bitcoin',
      'bitcoin.exe',
      'bitcoin-core',
      'arbitrary',
      '',
      'bitcoind; rm -rf /',
      'bitcoind && echo pwned',
      'bitcoind | cat /etc/passwd',
      'bitcoind`id`',
      '$(whoami)',
    ]

    for (const name of invalid_names) {
      try {
        validate_process_name(name)
        t.fail(`Should reject: ${name}`)
      } catch (err) {
        t.ok((err as Error).message.includes('Invalid process name'), `Rejects: ${name}`)
      }
    }
    t.end()
  })

  // =========================================================================
  // Bitcoin Address Validation Tests
  // =========================================================================

  tape('validate_address - mainnet addresses', async (t) => {
    const valid_mainnet = [
      '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',       // P2PKH
      '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',       // P2SH
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', // Bech32 P2WPKH
      'bc1p5cyxnuxmeuwvkwfxq8plajfdh4v9yldz45jy6pjmh4v',  // Bech32m P2TR (truncated for test)
    ]

    for (const addr of valid_mainnet.slice(0, 3)) {
      t.ok(validate_address(addr, 'main'), `Valid mainnet: ${addr.slice(0, 10)}...`)
    }

    // Test that regtest addresses are rejected on mainnet
    t.notOk(
      validate_address('bcrt1qyrfrpadwgw7p5eh3e9h24hr2', 'main'),
      'Rejects regtest address on mainnet'
    )
    t.end()
  })

  tape('validate_address - regtest addresses', async (t) => {
    const valid_regtest = [
      'mrT8NCwoS1knUKfXHb5w4W1JWBbP9Lx9N8',       // P2PKH (m/n prefix)
      'n2eMqTT929pb1RDNuqEnxdaLau1rxy3efi',       // P2PKH
      '2N5eAiEqEsFRrX5T2FzPYwg8fVJJFGpCDJv',      // P2SH
      'bcrt1qyrfrpadwgw7p5eh3e9h24hr2gzg5xv6jkn7dqt', // Bech32 P2WPKH
    ]

    for (const addr of valid_regtest) {
      t.ok(validate_address(addr, 'regtest'), `Valid regtest: ${addr.slice(0, 15)}...`)
    }
    t.end()
  })

  tape('validate_address - rejects invalid addresses', async (t) => {
    const invalid = [
      '',
      'invalid',
      '1234567890',
      'bc1qinvalid',
      'bc1p',  // Too short
      'notanaddress',
      // Injection attempts
      'bcrt1q),combo(x)',
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq; echo pwned',
    ]

    for (const addr of invalid) {
      t.notOk(validate_address(addr, 'regtest'), `Invalid: ${addr.slice(0, 20)}`)
    }
    t.end()
  })

  tape('assert_valid_address - throws on invalid', async (t) => {
    try {
      assert_valid_address('invalid', 'regtest')
      t.fail('Should throw')
    } catch (err) {
      t.ok((err as Error).message.includes('Invalid Bitcoin address'), 'Throws with message')
    }
    t.end()
  })

  // =========================================================================
  // Public Key Validation Tests
  // =========================================================================

  tape('validate_pubkey - accepts valid pubkeys', async (t) => {
    // Compressed pubkey (33 bytes)
    const compressed = `03${'a'.repeat(64)}`
    t.ok(validate_pubkey(compressed).valid, 'Valid compressed pubkey with 03 prefix')
    t.equal(validate_pubkey(compressed).type, 'compressed', 'Type is compressed')

    const compressed02 = `02${'a'.repeat(64)}`
    t.ok(validate_pubkey(compressed02).valid, 'Valid compressed pubkey with 02 prefix')

    // X-only pubkey (32 bytes, taproot)
    const xonly = 'a'.repeat(64)
    t.ok(validate_pubkey(xonly).valid, 'Valid x-only pubkey')
    t.equal(validate_pubkey(xonly).type, 'x-only', 'Type is x-only')

    // Uncompressed pubkey (65 bytes)
    const uncompressed = `04${'a'.repeat(128)}`
    t.ok(validate_pubkey(uncompressed).valid, 'Valid uncompressed pubkey')
    t.equal(validate_pubkey(uncompressed).type, 'uncompressed', 'Type is uncompressed')

    t.end()
  })

  tape('validate_pubkey - rejects invalid pubkeys', async (t) => {
    // Wrong length
    t.notOk(validate_pubkey('a'.repeat(62)).valid, 'Rejects 31 bytes')
    t.notOk(validate_pubkey('a'.repeat(68)).valid, 'Rejects 34 bytes')

    // Wrong prefix
    t.notOk(validate_pubkey(`01${'a'.repeat(64)}`).valid, 'Rejects 01 prefix')
    t.notOk(validate_pubkey(`05${'a'.repeat(128)}`).valid, 'Rejects 05 prefix')

    // Non-hex
    t.notOk(validate_pubkey(`zz${'a'.repeat(62)}`).valid, 'Rejects non-hex')

    // Not a string
    t.notOk(validate_pubkey(123 as any).valid, 'Rejects non-string')

    t.end()
  })

  // =========================================================================
  // Amount Validation Tests
  // =========================================================================

  tape('validate_amount - accepts valid amounts', async (t) => {
    t.ok(validate_amount(0).valid, 'Accepts 0')
    t.ok(validate_amount(1).valid, 'Accepts 1')
    t.ok(validate_amount(1000).valid, 'Accepts 1000')
    t.ok(validate_amount(100_000_000).valid, 'Accepts 1 BTC in sats')
    t.ok(validate_amount(MAX_SATS).valid, 'Accepts max supply')
    t.end()
  })

  tape('validate_amount - rejects invalid amounts', async (t) => {
    // Negative
    t.notOk(validate_amount(-1).valid, 'Rejects negative')
    t.ok(validate_amount(-1).error?.includes('negative'), 'Error mentions negative')

    // Exceeds supply
    t.notOk(validate_amount(MAX_SATS + 1).valid, 'Rejects exceeding max')
    t.ok(validate_amount(MAX_SATS + 1).error?.includes('maximum'), 'Error mentions maximum')

    // Not integer
    t.notOk(validate_amount(1.5).valid, 'Rejects decimal')
    t.ok(validate_amount(1.5).error?.includes('integer'), 'Error mentions integer')

    // Not a number
    t.notOk(validate_amount('100' as any).valid, 'Rejects string')
    t.notOk(validate_amount(NaN).valid, 'Rejects NaN')
    t.notOk(validate_amount(Infinity).valid, 'Rejects Infinity')

    t.end()
  })

  tape('assert_valid_amount - throws on invalid', async (t) => {
    try {
      assert_valid_amount(-100)
      t.fail('Should throw')
    } catch (err) {
      t.ok((err as Error).message.includes('Invalid amount'), 'Throws with message')
    }
    t.end()
  })

  // =========================================================================
  // Path Validation Tests
  // =========================================================================

  tape('validate_path - accepts valid paths', async (t) => {
    t.ok(validate_path('/home/user/data').valid, 'Accepts absolute path')
    t.ok(validate_path('/var/lib/bitcoin').valid, 'Accepts linux path')
    // Note: Windows paths with backslashes are only valid on Windows platform
    // On Unix, backslash is a shell metacharacter and will be rejected
    if (process.platform === 'win32') {
      t.ok(validate_path('C:\\Users\\data').valid, 'Accepts windows path')
    } else {
      t.ok(validate_path('C:/Users/data').valid, 'Accepts forward-slash windows path')
    }
    t.ok(validate_path('data/subdir/file.txt').valid, 'Accepts relative path')
    t.end()
  })

  tape('validate_path - rejects path traversal', async (t) => {
    t.notOk(validate_path('../etc/passwd').valid, 'Rejects ../ at start')
    t.notOk(validate_path('/home/../etc/passwd').valid, 'Rejects ../ in middle')
    t.notOk(validate_path('/home/user/..').valid, 'Rejects .. at end')
    t.notOk(validate_path('..\\etc\\passwd').valid, 'Rejects windows traversal')

    t.ok(validate_path('../etc/passwd').error?.includes('traversal'), 'Error mentions traversal')
    t.end()
  })

  tape('validate_path - rejects shell metacharacters', async (t) => {
    const dangerous = [
      '/home/user; rm -rf /',
      '/home/user && echo pwned',
      '/home/user | cat',
      '/home/user`id`',
      '/home/$(whoami)',
      '/home/user\nmalicious',
    ]

    for (const path of dangerous) {
      t.notOk(validate_path(path).valid, `Rejects: ${path.slice(0, 20)}`)
    }
    t.end()
  })

  tape('validate_path - allowedBases option', async (t) => {
    const opts = { allowedBases: ['/home/bitcoin', '/var/lib/bitcoin'] }

    t.ok(validate_path('/home/bitcoin/data', opts).valid, 'Accepts path in allowed base')
    t.ok(validate_path('/var/lib/bitcoin/wallets', opts).valid, 'Accepts second allowed base')
    t.notOk(validate_path('/etc/passwd', opts).valid, 'Rejects path outside allowed bases')
    t.end()
  })

  // =========================================================================
  // Credential Sanitization Tests
  // =========================================================================

  tape('sanitize_for_log - redacts RPC credentials', async (t) => {
    const input = '-rpcuser=admin -rpcpassword=secret123 -rpcport=8332'
    const result = sanitize_for_log(input)

    t.ok(result.includes('-rpcuser=***'), 'Redacts rpcuser')
    t.ok(result.includes('-rpcpassword=***'), 'Redacts rpcpassword')
    t.notOk(result.includes('admin'), 'Username removed')
    t.notOk(result.includes('secret123'), 'Password removed')
    t.ok(result.includes('8332'), 'Port preserved')
    t.end()
  })

  tape('sanitize_for_log - redacts extended private keys', async (t) => {
    const xprv = 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi'
    const input = `Loading key: ${xprv}`
    const result = sanitize_for_log(input)

    t.ok(result.includes('[REDACTED_XPRV]'), 'xprv redacted')
    t.notOk(result.includes('xprv9s21'), 'xprv content removed')
    t.end()
  })

  tape('sanitize_for_log - redacts private keys in context', async (t) => {
    const input = 'seckey: abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234'
    const result = sanitize_for_log(input)

    t.ok(result.includes('[REDACTED_KEY]'), 'seckey redacted')
    t.end()
  })

  tape('sanitize_for_log - preserves non-sensitive data', async (t) => {
    const input = 'Block height: 12345, txid: abc123'
    const result = sanitize_for_log(input)

    t.equal(result, input, 'Non-sensitive data preserved')
    t.end()
  })

  tape('sanitize_params_for_log - sanitizes array', async (t) => {
    const params = ['-chain=regtest', '-rpcuser=admin', '-rpcpassword=secret']
    const result = sanitize_params_for_log(params)

    t.equal(result.length, 3, 'Same number of params')
    t.equal(result[0], '-chain=regtest', 'Chain preserved')
    t.equal(result[1], '-rpcuser=***', 'User redacted')
    t.equal(result[2], '-rpcpassword=***', 'Password redacted')
    t.end()
  })

  // =========================================================================
  // Block Count Validation Tests
  // =========================================================================

  tape('validate_block_count - accepts valid counts', async (t) => {
    t.ok(validate_block_count(1).valid, 'Accepts 1')
    t.ok(validate_block_count(10).valid, 'Accepts 10')
    t.ok(validate_block_count(100).valid, 'Accepts 100')
    t.ok(validate_block_count(10000).valid, 'Accepts 10000')
    t.end()
  })

  tape('validate_block_count - rejects invalid counts', async (t) => {
    t.notOk(validate_block_count(0).valid, 'Rejects 0')
    t.notOk(validate_block_count(-1).valid, 'Rejects negative')
    t.notOk(validate_block_count(10001).valid, 'Rejects > 10000')
    t.notOk(validate_block_count(1.5).valid, 'Rejects non-integer')
    t.notOk(validate_block_count('10' as any).valid, 'Rejects string')
    t.end()
  })

  // =========================================================================
  // Descriptor Input Validation Tests
  // =========================================================================

  tape('validate_descriptor_input - accepts valid inputs', async (t) => {
    t.ok(validate_descriptor_input('bc1qxyz').valid, 'Accepts address')
    t.ok(validate_descriptor_input('02abcd1234').valid, 'Accepts pubkey')
    t.ok(validate_descriptor_input('76a914...88ac').valid, 'Accepts script')
    t.end()
  })

  tape('validate_descriptor_input - rejects injection attempts', async (t) => {
    const injections = [
      'bc1q),combo(x)',
      'addr; rm -rf /',
      'combo(x) && echo pwned',
      'raw(x) | cat',
      'addr`id`',
      '$(whoami)',
      'addr$PATH',
    ]

    for (const input of injections) {
      t.notOk(validate_descriptor_input(input).valid, `Rejects: ${input}`)
    }
    t.end()
  })

  tape('validate_descriptor_input - checks parentheses balance', async (t) => {
    t.notOk(validate_descriptor_input('addr((x)').valid, 'Rejects unbalanced (')
    t.notOk(validate_descriptor_input('addr(x))').valid, 'Rejects unbalanced )')
    t.ok(validate_descriptor_input('addr(x)').valid, 'Accepts balanced')
    t.end()
  })
}
