/**
 * Integration tests for wallet balance operations
 */

import type { Test } from 'tape'
import type { DaemonTestContext } from '../../../lib/types/test.types.js'
import { SATS_PER_BTC } from '../../../lib/const.js'
import { create_assertions } from '../../../lib/helpers/assertions.js'

/**
 * Wallet balance integration tests
 */
export default async function balance_int_tests(
  tape : typeof import('tape'),
  ctx  : DaemonTestContext
): Promise<void> {
  const { faucet } = ctx

  tape('Faucet has balance', async (t) => {
    const balance = await faucet.get_balance()

    t.ok(balance > 0, 'Faucet has positive balance')
    t.ok(balance >= 10 * SATS_PER_BTC, 'Faucet has at least 10 BTC')
    t.end()
  })

  tape('Can create wallet with zero balance', async (t) => {
    // Use unique name to avoid state from previous runs
    const wallet = await ctx.create_wallet(`test_zero_${Date.now()}`)
    const balance = await wallet.get_balance()

    t.equal(balance, 0, 'New wallet has zero balance')
    t.end()
  })

  tape('Can fund wallet from faucet', async (t) => {
    // Use unique name to avoid state from previous runs
    const wallet = await ctx.create_wallet(`test_funded_${Date.now()}`)
    const fundAmount = 1 * SATS_PER_BTC // 1 BTC

    const address = await wallet.generate_address()
    await faucet.send_funds(fundAmount, address, true)

    const balance = await wallet.get_balance()
    t.equal(balance, fundAmount, `Wallet received ${fundAmount} sats`)
    t.end()
  })

  tape('Can send funds between wallets', async (t) => {
    // Use unique names to avoid state from previous runs
    const suffix = Date.now()

    // Create and fund sender
    const sender = await ctx.create_wallet(`test_sender_${suffix}`)
    const senderAddr = await sender.generate_address()
    await faucet.send_funds(2 * SATS_PER_BTC, senderAddr, true)

    // Create receiver
    const receiver = await ctx.create_wallet(`test_receiver_${suffix}`)
    const receiverAddr = await receiver.generate_address()

    // Send from sender to receiver
    const sendAmount = 0.5 * SATS_PER_BTC
    await sender.send_funds(sendAmount, receiverAddr, true)

    // Check balances
    const receiverBalance = await receiver.get_balance()
    t.equal(receiverBalance, sendAmount, 'Receiver got funds')

    const senderBalance = await sender.get_balance()
    t.ok(senderBalance < 2 * SATS_PER_BTC, 'Sender balance decreased')
    t.ok(senderBalance > 0, 'Sender still has change')
    t.end()
  })

  tape('Cannot send more than balance', async (t) => {
    const assert = create_assertions(t)
    const wallet = await ctx.create_wallet(`test_insuf_${Date.now()}`)
    const address = await wallet.generate_address()
    await faucet.send_funds(0.1 * SATS_PER_BTC, address, true)

    const balance = await wallet.get_balance()
    const toAddress = await faucet.get_address('return')

    await assert.throws(
      () => wallet.send_funds(balance + 1 * SATS_PER_BTC, toAddress),
      'Cannot send more than balance'
    )

    t.end()
  })

  tape('ensure_funds adds missing balance', async (t) => {
    const wallet = await ctx.create_wallet(`test_ensure_${Date.now()}`)
    const minBalance = 0.5 * SATS_PER_BTC

    await wallet.ensure_funds(minBalance)

    const balance = await wallet.get_balance()
    t.ok(balance >= minBalance, `Balance is at least ${minBalance}`)
    t.end()
  })

  tape('ensure_funds no-op when sufficient', async (t) => {
    const wallet = await ctx.create_wallet(`test_noop_${Date.now()}`)
    const address = await wallet.generate_address()
    await faucet.send_funds(1 * SATS_PER_BTC, address, true)

    const initialBalance = await wallet.get_balance()
    await wallet.ensure_funds(0.5 * SATS_PER_BTC)
    const finalBalance = await wallet.get_balance()

    t.equal(finalBalance, initialBalance, 'Balance unchanged')
    t.end()
  })

  tape('get_info returns wallet info', async (t) => {
    const walletName = `test_info_${Date.now()}`
    const wallet = await ctx.create_wallet(walletName)
    const info = await wallet.get_info()

    t.ok(info, 'Info returned')
    t.equal(info.walletname, walletName, 'Wallet name matches')
    t.ok(info.balance !== undefined, 'Balance field exists')
    t.ok(info.txcount !== undefined, 'Tx count field exists')
    t.end()
  })
}
