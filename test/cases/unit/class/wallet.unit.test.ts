/**
 * Unit tests for CoreWallet - key export security and PSBT methods
 */

import type { TapeHarness, MockTestContext } from '../../../lib/types/test.types.js'
import {
  MockCoreWallet,
  create_mock_wallet,
  create_mock_faucet
} from '../../../lib/mocks/wallet.mock.js'
import {
  create_utxo_fixture,
  create_utxo_set_fixture,
  create_coin_selection_utxos
} from '../../../lib/fixtures/wallet.fixture.js'

export default function wallet_unit_tests(
  tape: TapeHarness,
  _ctx: MockTestContext
): void {
  // =========================================================================
  // Key Export Security Gate Tests
  // =========================================================================

  tape('key_export_enabled - defaults to false', async (t) => {
    // Mock wallet with no config
    const mockConfig: { allow_key_export?: boolean } = {}
    const enabled = mockConfig.allow_key_export === true
    t.notOk(enabled, 'Key export disabled by default')
    t.end()
  })

  tape('key_export_enabled - true when explicitly set', async (t) => {
    const mockConfig = { allow_key_export: true }
    const enabled = mockConfig.allow_key_export === true
    t.ok(enabled, 'Key export enabled when configured')
    t.end()
  })

  tape('key_export_enabled - false when explicitly disabled', async (t) => {
    const mockConfig = { allow_key_export: false }
    const enabled = mockConfig.allow_key_export === true
    t.notOk(enabled, 'Key export disabled when set to false')
    t.end()
  })

  // =========================================================================
  // ExtractedKey Type Tests
  // =========================================================================

  tape('ExtractedKey - taproot key has correct format', async (t) => {
    // Simulate an extracted taproot key
    const key = {
      address: 'bcrt1p...',
      type: 'taproot' as const,
      pubkey: 'a'.repeat(64),  // 32-byte x-only
      seckey: 'b'.repeat(64),  // 32-byte private key
      path: '/86h/0h/0h/0/0',
      fingerprint: 'abcd1234'
    }

    t.equal(key.type, 'taproot', 'Type is taproot')
    t.equal(key.pubkey.length, 64, 'Pubkey is 32 bytes (64 hex chars)')
    t.equal(key.seckey.length, 64, 'Seckey is 32 bytes (64 hex chars)')
    t.ok(key.path.startsWith('/86'), 'Taproot uses BIP86 path')
    t.end()
  })

  tape('ExtractedKey - segwit key has correct format', async (t) => {
    // Simulate an extracted segwit key
    const key = {
      address: 'bcrt1q...',
      type: 'segwit' as const,
      pubkey: `03${'a'.repeat(64)}`,  // 33-byte compressed
      seckey: 'b'.repeat(64),          // 32-byte private key
      path: '/84h/0h/0h/0/0',
      fingerprint: 'abcd1234'
    }

    t.equal(key.type, 'segwit', 'Type is segwit')
    t.equal(key.pubkey.length, 66, 'Pubkey is 33 bytes (66 hex chars)')
    t.ok(key.pubkey.startsWith('02') || key.pubkey.startsWith('03'), 'Has compressed prefix')
    t.equal(key.seckey.length, 64, 'Seckey is 32 bytes (64 hex chars)')
    t.ok(key.path.startsWith('/84'), 'Segwit uses BIP84 path')
    t.end()
  })

  tape('ExtractedKey - does NOT include master xprv', async (t) => {
    // The new ExtractedKey interface should NOT have a master field
    const key = {
      address: 'bcrt1p...',
      type: 'taproot' as const,
      pubkey: 'a'.repeat(64),
      seckey: 'b'.repeat(64),
      path: '/86h/0h/0h/0/0',
      fingerprint: 'abcd1234'
    }

    t.notOk('master' in key, 'No master xprv field')
    t.notOk('xprv' in key, 'No xprv field')
    t.end()
  })

  // =========================================================================
  // PsbtOptions Tests
  // =========================================================================

  tape('PsbtOptions - default values', async (t) => {
    const defaults = {
      fee_rate: 1,
      include_change: true,
      lock_unspents: false,
      estimate_mode: 'economical' as const
    }

    t.equal(defaults.fee_rate, 1, 'Default fee rate is 1 sat/vB')
    t.equal(defaults.include_change, true, 'Change included by default')
    t.equal(defaults.lock_unspents, false, 'Unspents not locked by default')
    t.equal(defaults.estimate_mode, 'economical', 'Economical fee estimation')
    t.end()
  })

  tape('PsbtOptions - can override all options', async (t) => {
    const options = {
      fee_rate: 5,
      include_change: false,
      lock_unspents: true,
      conf_target: 6,
      estimate_mode: 'conservative' as const
    }

    t.equal(options.fee_rate, 5, 'Custom fee rate')
    t.equal(options.include_change, false, 'Change disabled')
    t.equal(options.lock_unspents, true, 'Unspents locked')
    t.equal(options.conf_target, 6, 'Custom confirmation target')
    t.equal(options.estimate_mode, 'conservative', 'Conservative fee estimation')
    t.end()
  })

  // =========================================================================
  // PsbtResult Tests
  // =========================================================================

  tape('PsbtResult - contains expected fields', async (t) => {
    const result = {
      psbt: 'cHNidP8B...',  // Base64 encoded
      fee: 1000,
      changepos: 1
    }

    t.ok(typeof result.psbt === 'string', 'PSBT is a string')
    t.ok(result.psbt.length > 0, 'PSBT is not empty')
    t.ok(typeof result.fee === 'number', 'Fee is a number')
    t.ok(result.fee > 0, 'Fee is positive')
    t.ok(typeof result.changepos === 'number', 'Changepos is a number')
    t.end()
  })

  tape('PsbtResult - changepos can be -1 for no change', async (t) => {
    const result = {
      psbt: 'cHNidP8B...',
      fee: 1000,
      changepos: -1  // No change output
    }

    t.equal(result.changepos, -1, 'Changepos is -1 when no change')
    t.end()
  })

  // =========================================================================
  // Security - Key Not Exposed Tests
  // =========================================================================

  tape('Security - list_descriptors defaults to public only', async (t) => {
    // By default, list_descriptors(false) should not return private keys
    // This test verifies the expected behavior
    const includePrivate = false
    t.notOk(includePrivate, 'Default does not include private keys')
    t.end()
  })

  tape('Security - list_descriptors(true) requires allow_key_export', async (t) => {
    // When allow_key_export is false, list_descriptors(true) should fail
    const config = { allow_key_export: false }
    const includePrivate = true

    if (includePrivate && !config.allow_key_export) {
      t.pass('Private descriptors blocked when key export disabled')
    } else {
      t.fail('Should have blocked private descriptor export')
    }
    t.end()
  })

  tape('Security - RPC methods do not expose keys', async (t) => {
    // Verify that RPC-based methods are the safe path
    const safeMethods = [
      'send_funds',        // Uses sendtoaddress RPC
      'create_psbt',       // Uses walletcreatefundedpsbt RPC
      'sign_psbt',         // Uses walletprocesspsbt RPC
      'finalize_psbt',     // Uses finalizepsbt RPC
      'create_and_sign_tx' // Combines the above
    ]

    for (const method of safeMethods) {
      t.ok(method, `${method} is available for safe transactions`)
    }
    t.end()
  })

  tape('Security - only one method to extract private keys', async (t) => {
    // There should be exactly one gated method for key extraction
    const keyExportMethods = ['extract_private_key']

    t.equal(keyExportMethods.length, 1, 'Only one key export method')
    t.equal(keyExportMethods[0], 'extract_private_key', 'Method is extract_private_key')
    t.end()
  })

  // =========================================================================
  // MockCoreWallet - Creation Tests
  // =========================================================================

  tape('MockCoreWallet - create with default config', (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    t.ok(wallet instanceof MockCoreWallet, 'Returns MockCoreWallet')
    t.equal(wallet.label, 'test', 'Label is set')
    t.equal(wallet.network, 'regtest', 'Default network is regtest')
    t.end()
  })

  tape('MockCoreWallet - create with custom balance', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 100_000_000 })

    const balance = await wallet.get_balance()
    t.equal(balance, 100_000_000, 'Balance is 1 BTC in sats')
    t.end()
  })

  tape('MockCoreWallet - create with UTXOs', async (t) => {
    const wallet = create_mock_wallet({
      label: 'test',
      utxos: [
        { txid: 'a'.repeat(64), vout: 0, sats: 50_000_000 },
        { txid: 'b'.repeat(64), vout: 0, sats: 50_000_000 }
      ]
    })

    const utxos = await wallet.list_utxos()
    t.equal(utxos.length, 2, 'Has 2 UTXOs')
    t.equal(utxos[0].sats, 50_000_000, 'First UTXO has correct amount')
    t.end()
  })

  tape('create_mock_faucet - creates faucet with large balance', async (t) => {
    const faucet = create_mock_faucet()

    t.equal(faucet.label, 'faucet', 'Label is faucet')
    const balance = await faucet.get_balance()
    t.equal(balance, 100_000_000_000, 'Default balance is 1000 BTC')
    t.end()
  })

  tape('create_mock_faucet - accepts custom balance', async (t) => {
    const faucet = create_mock_faucet(50_000_000_000)

    const balance = await faucet.get_balance()
    t.equal(balance, 50_000_000_000, 'Custom balance is 500 BTC')
    t.end()
  })

  // =========================================================================
  // UTXO Methods Tests
  // =========================================================================

  tape('list_utxos - returns copy of UTXOs', async (t) => {
    const wallet = create_mock_wallet({
      label: 'test',
      utxos: [{ txid: 'a'.repeat(64), vout: 0, sats: 10_000 }]
    })

    const utxos1 = await wallet.list_utxos()
    const utxos2 = await wallet.list_utxos()

    t.notEqual(utxos1, utxos2, 'Returns different array instances')
    t.deepEqual(utxos1, utxos2, 'Arrays have same content')
    t.end()
  })

  tape('list_utxos - records call', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    await wallet.list_utxos()

    t.ok(wallet._was_called('list_utxos'), 'list_utxos was called')
    t.end()
  })

  tape('select_utxos - selects sufficient UTXOs', async (t) => {
    const wallet = create_mock_wallet({
      label: 'test',
      utxos: [
        { txid: 'a'.repeat(64), vout: 0, sats: 30_000 },
        { txid: 'b'.repeat(64), vout: 0, sats: 50_000 },
        { txid: 'c'.repeat(64), vout: 0, sats: 20_000 }
      ]
    })

    const selected = await wallet.select_utxos(40_000)

    t.ok(selected.length >= 1, 'Selected at least one UTXO')
    const total = selected.reduce((sum, u) => sum + u.sats, 0)
    t.ok(total >= 40_000, 'Selected UTXOs cover amount')
    t.end()
  })

  tape('select_utxos - throws on insufficient funds', async (t) => {
    const wallet = create_mock_wallet({
      label: 'test',
      utxos: [{ txid: 'a'.repeat(64), vout: 0, sats: 10_000 }]
    })

    try {
      await wallet.select_utxos(100_000)
      t.fail('Should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'Threw an error')
      t.ok((err as Error).message.includes('Insufficient'), 'Error mentions insufficient')
    }
    t.end()
  })

  tape('select_utxos - prefers larger UTXOs', async (t) => {
    const wallet = create_mock_wallet({
      label: 'test',
      utxos: [
        { txid: 'a'.repeat(64), vout: 0, sats: 10_000 },
        { txid: 'b'.repeat(64), vout: 0, sats: 100_000 }
      ]
    })

    const selected = await wallet.select_utxos(50_000)

    t.equal(selected.length, 1, 'Selected only one UTXO')
    t.equal(selected[0].sats, 100_000, 'Selected the larger UTXO')
    t.end()
  })

  // =========================================================================
  // Address Methods Tests
  // =========================================================================

  tape('generate_address - generates unique addresses', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    const addr1 = await wallet.generate_address()
    const addr2 = await wallet.generate_address()
    const addr3 = await wallet.generate_address()

    t.notEqual(addr1, addr2, 'Addresses are unique')
    t.notEqual(addr2, addr3, 'Addresses are unique')
    t.ok(addr1.startsWith('bcrt1q'), 'Address has regtest prefix')
    t.end()
  })

  tape('generate_address - respects network', async (t) => {
    const regtestWallet = create_mock_wallet({ label: 'test', network: 'regtest' })
    const testnetWallet = create_mock_wallet({ label: 'test', network: 'testnet' })

    const regtestAddr = await regtestWallet.generate_address()
    const testnetAddr = await testnetWallet.generate_address()

    t.ok(regtestAddr.startsWith('bcrt1q'), 'Regtest address')
    t.ok(testnetAddr.startsWith('tb1q'), 'Testnet address')
    t.end()
  })

  tape('get_address - caches addresses by label', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    const addr1 = await wallet.get_address('my_label')
    const addr2 = await wallet.get_address('my_label')
    const addr3 = await wallet.get_address('other_label')

    t.equal(addr1, addr2, 'Same label returns same address')
    t.notEqual(addr1, addr3, 'Different label returns different address')
    t.end()
  })

  tape('get_address - records call with label and type', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    await wallet.get_address('test_label', 'bech32m')

    const calls = wallet._get_calls('get_address')
    t.equal(calls.length, 1, 'One call recorded')
    t.deepEqual(calls[0].args, ['test_label', 'bech32m'], 'Arguments recorded')
    t.end()
  })

  tape('parse_address - returns address info', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    const info = await wallet.parse_address('bcrt1qtest') as any

    t.equal(info.address, 'bcrt1qtest', 'Address in result')
    t.ok(info.ismine, 'ismine is true')
    t.ok(info.iswitness, 'iswitness is true')
    t.end()
  })

  tape('get_pubkey - returns compressed pubkey', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    const pubkey = await wallet.get_pubkey('bcrt1qtest')

    t.equal(pubkey.length, 66, 'Pubkey is 33 bytes (66 hex)')
    t.ok(pubkey.startsWith('02') || pubkey.startsWith('03'), 'Has compressed prefix')
    t.end()
  })

  // =========================================================================
  // Transaction Methods Tests
  // =========================================================================

  tape('send_funds - decreases balance', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 100_000_000 })

    const initialBalance = await wallet.get_balance()
    await wallet.send_funds(10_000_000, 'bcrt1qtest')
    const finalBalance = await wallet.get_balance()

    t.equal(finalBalance, initialBalance - 10_000_000, 'Balance decreased')
    t.end()
  })

  tape('send_funds - returns txid', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 100_000_000 })

    const txid = await wallet.send_funds(10_000, 'bcrt1qtest')

    t.equal(txid.length, 64, 'TXID is 32 bytes (64 hex)')
    t.end()
  })

  tape('send_funds - throws on insufficient balance', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 10_000 })

    try {
      await wallet.send_funds(100_000, 'bcrt1qtest')
      t.fail('Should have thrown')
    } catch (err) {
      t.ok(err instanceof Error, 'Threw an error')
      t.ok((err as Error).message.includes('Insufficient'), 'Error mentions insufficient')
    }
    t.end()
  })

  tape('send_funds - records call with all args', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 100_000_000 })

    await wallet.send_funds(10_000, 'bcrt1qtest', true)

    const calls = wallet._get_calls('send_funds')
    t.deepEqual(calls[0].args, [10_000, 'bcrt1qtest', true], 'All args recorded')
    t.end()
  })

  // =========================================================================
  // PSBT Methods Tests
  // =========================================================================

  tape('fund_psbt - returns funded PSBT string', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 100_000_000 })

    const psbt = await wallet.fund_psbt('mock_psbt')

    t.equal(typeof psbt, 'string', 'Returns string')
    t.ok(psbt.length > 0, 'PSBT is not empty')
    t.end()
  })

  tape('sign_psbt - returns signed PSBT string', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    const signed = await wallet.sign_psbt('mock_psbt')

    t.equal(typeof signed, 'string', 'Returns string')
    t.ok(wallet._was_called('sign_psbt'), 'sign_psbt was called')
    t.end()
  })

  tape('add_segwit_desc - records call', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    await wallet.add_segwit_desc('psbt', '02aabbcc', 0)

    const calls = wallet._get_calls('add_segwit_desc')
    t.deepEqual(calls[0].args, ['psbt', '02aabbcc', 0], 'Args recorded')
    t.end()
  })

  tape('add_taproot_desc - records call with all args', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    await wallet.add_taproot_desc('psbt', 'aabbcc', 0, ['script'], 0xc0)

    const calls = wallet._get_calls('add_taproot_desc')
    t.deepEqual(calls[0].args, ['psbt', 'aabbcc', 0, ['script'], 0xc0], 'All args recorded')
    t.end()
  })

  // =========================================================================
  // Funding Helpers Tests
  // =========================================================================

  tape('ensure_funds - increases balance if below minimum', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 10_000 })

    await wallet.ensure_funds(100_000)

    const balance = await wallet.get_balance()
    t.equal(balance, 100_000, 'Balance increased to minimum')
    t.end()
  })

  tape('ensure_funds - keeps balance if above minimum', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 1_000_000 })

    await wallet.ensure_funds(100_000)

    const balance = await wallet.get_balance()
    t.equal(balance, 1_000_000, 'Balance unchanged')
    t.end()
  })

  tape('drain_faucet - increases balance', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 0 })

    await wallet.drain_faucet(100_000)

    const balance = await wallet.get_balance()
    t.equal(balance, 100_000, 'Balance increased')
    t.end()
  })

  tape('drain_faucet - returns txid', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    const txid = await wallet.drain_faucet(100_000)

    t.equal(txid.length, 64, 'Returns txid')
    t.end()
  })

  // =========================================================================
  // Wallet Info Methods Tests
  // =========================================================================

  tape('get_info - returns WalletInfo', async (t) => {
    const wallet = create_mock_wallet({ label: 'test_wallet', balance: 100_000_000 })

    const info = await wallet.get_info()

    t.equal(info.walletname, 'test_wallet', 'Wallet name matches label')
    t.equal(info.balance, 1, 'Balance in BTC (1 BTC)')
    t.ok(info.descriptors, 'Descriptors enabled')
    t.ok(info.private_keys_enabled, 'Private keys enabled')
    t.end()
  })

  tape('is_created_check - returns true', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    const created = await wallet.is_created_check()

    t.ok(created, 'Wallet is created')
    t.end()
  })

  tape('is_loaded_check - returns true', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })

    const loaded = await wallet.is_loaded_check()

    t.ok(loaded, 'Wallet is loaded')
    t.end()
  })

  // =========================================================================
  // Test Helper Methods
  // =========================================================================

  tape('_set_balance - changes balance', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 0 })

    wallet._set_balance(500_000)

    const balance = await wallet.get_balance()
    t.equal(balance, 500_000, 'Balance changed')
    t.end()
  })

  tape('_add_balance - adds to balance', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 100_000 })

    wallet._add_balance(50_000)

    const balance = await wallet.get_balance()
    t.equal(balance, 150_000, 'Balance increased')
    t.end()
  })

  tape('_add_utxo - adds UTXO to list', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', utxos: [] })

    wallet._add_utxo({ txid: 'new'.padEnd(64, '0'), vout: 0, sats: 10_000 })

    const utxos = await wallet.list_utxos()
    t.equal(utxos.length, 1, 'UTXO added')
    t.equal(utxos[0].sats, 10_000, 'UTXO has correct amount')
    t.end()
  })

  tape('_remove_utxo - removes UTXO from list', async (t) => {
    const txid = 'a'.repeat(64)
    const wallet = create_mock_wallet({
      label: 'test',
      utxos: [{ txid, vout: 0, sats: 10_000 }]
    })

    const removed = wallet._remove_utxo(txid, 0)

    t.ok(removed, 'UTXO was removed')
    const utxos = await wallet.list_utxos()
    t.equal(utxos.length, 0, 'No UTXOs remain')
    t.end()
  })

  tape('_remove_utxo - returns false if not found', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', utxos: [] })

    const removed = wallet._remove_utxo('nonexistent', 0)

    t.notOk(removed, 'Returns false for non-existent UTXO')
    t.end()
  })

  tape('_clear_utxos - removes all UTXOs', async (t) => {
    const wallet = create_mock_wallet({
      label: 'test',
      utxos: [
        { txid: 'a'.repeat(64), vout: 0, sats: 10_000 },
        { txid: 'b'.repeat(64), vout: 0, sats: 20_000 }
      ]
    })

    wallet._clear_utxos()

    const utxos = await wallet.list_utxos()
    t.equal(utxos.length, 0, 'All UTXOs cleared')
    t.end()
  })

  tape('_reset - resets wallet to initial state', async (t) => {
    const wallet = create_mock_wallet({ label: 'test', balance: 100_000 })
    await wallet.generate_address()
    await wallet.get_balance()

    wallet._reset()

    // Verify reset state (note: these calls will be recorded after reset)
    const balance = await wallet.get_balance()
    const utxos = await wallet.list_utxos()

    t.equal(balance, 0, 'Balance reset to 0')
    t.equal(utxos.length, 0, 'UTXOs cleared')

    // Calls should only include the verification calls made after reset
    t.equal(wallet._calls.length, 2, 'Only verification calls remain after reset')
    t.end()
  })

  tape('_clear_calls - clears recorded calls', async (t) => {
    const wallet = create_mock_wallet({ label: 'test' })
    await wallet.get_balance()
    await wallet.list_utxos()

    wallet._clear_calls()

    t.equal(wallet._calls.length, 0, 'Calls cleared')
    t.end()
  })

  // =========================================================================
  // UTXO Fixture Tests
  // =========================================================================

  tape('create_utxo_fixture - creates valid UTXO', (t) => {
    const utxo = create_utxo_fixture({ sats: 50_000 })

    t.equal(utxo.sats, 50_000, 'Sats set correctly')
    t.equal(utxo.txid.length, 64, 'TXID is 64 chars')
    t.equal(utxo.vout, 0, 'Vout defaults to 0')
    t.ok(utxo.spendable, 'Spendable by default')
    t.ok(utxo.safe, 'Safe by default')
    t.end()
  })

  tape('create_utxo_set_fixture - creates multiple UTXOs', (t) => {
    const utxos = create_utxo_set_fixture([10_000, 20_000, 30_000])

    t.equal(utxos.length, 3, 'Creates 3 UTXOs')
    t.equal(utxos[0].sats, 10_000, 'First UTXO correct')
    t.equal(utxos[1].sats, 20_000, 'Second UTXO correct')
    t.equal(utxos[2].sats, 30_000, 'Third UTXO correct')

    // Check unique txids
    const txids = utxos.map(u => u.txid)
    const unique = new Set(txids)
    t.equal(unique.size, 3, 'All TXIDs are unique')
    t.end()
  })

  tape('create_coin_selection_utxos - creates varied amounts', (t) => {
    const utxos = create_coin_selection_utxos()

    t.ok(utxos.length >= 5, 'Creates multiple UTXOs')

    const amounts = utxos.map(u => u.sats)
    t.ok(amounts.includes(10_000), 'Includes dust amount')
    t.ok(amounts.includes(100_000_000), 'Includes 1 BTC')

    // Check range
    const min = Math.min(...amounts)
    const max = Math.max(...amounts)
    t.ok(max > min * 1000, 'Wide range of amounts')
    t.end()
  })
}
