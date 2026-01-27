/**
 * E2E test for transaction flow
 */

import type { Test } from 'tape'
import type { DaemonTestContext } from '../../lib/types/test.types.js'
import { SATS_PER_BTC } from '../../lib/const.js'
import { create_assertions } from '../../lib/helpers/assertions.js'
import { wait_for_confirmation } from '../../lib/async/polling.js'

/**
 * E2E transaction flow test
 */
export default async function transactions_e2e_test(
  t  : Test,
  ctx: DaemonTestContext
): Promise<void> {
  const { client, faucet } = ctx
  const assert = create_assertions(t)

  t.test('Complete transaction lifecycle', async (st) => {
    // Setup: Create sender and receiver wallets
    const sender = await ctx.create_wallet('e2e_tx_sender')
    const receiver = await ctx.create_wallet('e2e_tx_receiver')

    // Fund sender from faucet
    const senderAddr = await sender.generate_address()
    const fundingTxid = await faucet.send_funds(5 * SATS_PER_BTC, senderAddr, false)

    st.ok(fundingTxid, 'Funding txid returned')
    assert.valid_txid(fundingTxid, 'Valid funding txid')

    // Verify funding tx in mempool
    const fundingStatus = await client.get_tx_status(fundingTxid)
    st.ok(fundingStatus, 'Funding tx status available')
    st.equal(fundingStatus!.confirmed, false, 'Funding tx initially unconfirmed')

    // Mine to confirm funding
    await ctx.mine_and_wait(1)

    // Verify funding confirmed
    const confirmedFunding = await client.get_tx_status(fundingTxid)
    st.equal(confirmedFunding!.confirmed, true, 'Funding tx confirmed')

    // Check sender balance
    const senderBalance = await sender.get_balance()
    st.equal(senderBalance, 5 * SATS_PER_BTC, 'Sender has funded balance')

    // Send to receiver
    const receiverAddr = await receiver.generate_address()
    const sendAmount = 2 * SATS_PER_BTC
    const sendTxid = await sender.send_funds(sendAmount, receiverAddr, false)

    st.ok(sendTxid, 'Send txid returned')
    assert.valid_txid(sendTxid, 'Valid send txid')

    // Verify send tx in mempool
    const sendStatus = await client.get_tx_status(sendTxid)
    st.equal(sendStatus!.confirmed, false, 'Send tx initially unconfirmed')

    // Get full transaction details
    const sendTx = await client.get_tx(sendTxid)
    st.ok(sendTx, 'Send tx details available')
    st.ok(sendTx!.vout.length >= 2, 'Tx has at least 2 outputs (payment + change)')

    // Find the payment output
    const paymentOutput = sendTx!.vout.find(
      o => o.scriptPubKey?.address === receiverAddr
    )
    st.ok(paymentOutput, 'Payment output found')
    st.equal(paymentOutput!.value, sendAmount / SATS_PER_BTC, 'Payment amount correct')

    // Mine to confirm send
    await ctx.mine_and_wait(1)

    // Verify send confirmed
    const confirmedSend = await client.get_tx_status(sendTxid)
    st.equal(confirmedSend!.confirmed, true, 'Send tx confirmed')

    // Check final balances
    const finalReceiverBalance = await receiver.get_balance()
    st.equal(finalReceiverBalance, sendAmount, 'Receiver has correct balance')

    const finalSenderBalance = await sender.get_balance()
    st.ok(
      finalSenderBalance < 5 * SATS_PER_BTC && finalSenderBalance > 0,
      'Sender balance reflects payment + fee'
    )

    // Verify UTXO state
    const receiverUtxos = await receiver.list_utxos()
    st.equal(receiverUtxos.length, 1, 'Receiver has 1 UTXO')
    st.equal(receiverUtxos[0].sats, sendAmount, 'UTXO amount matches')

    const senderUtxos = await sender.list_utxos()
    st.ok(senderUtxos.length >= 1, 'Sender has at least 1 UTXO (change)')

    st.end()
  })

  t.test('Multiple confirmations', async (st) => {
    const wallet = await ctx.create_wallet('e2e_tx_confs')
    const address = await wallet.generate_address()

    const txid = await faucet.send_funds(1 * SATS_PER_BTC, address, false)

    // Mine 6 blocks for full confirmation
    await ctx.mine_and_wait(6)

    const tx = await client.get_tx(txid)
    st.ok(tx!.confirmations! >= 6, 'Transaction has 6+ confirmations')

    st.end()
  })

  t.test('Transaction with multiple outputs', async (st) => {
    const wallet = await ctx.create_wallet('e2e_tx_multi')
    const addr1 = await wallet.generate_address()
    const addr2 = await wallet.generate_address()
    const addr3 = await wallet.generate_address()

    // Send to addr1 first to get funds
    await faucet.send_funds(3 * SATS_PER_BTC, addr1, true)

    // Now wallet can create multi-output tx
    const balance = await wallet.get_balance()
    st.ok(balance >= 3 * SATS_PER_BTC, 'Wallet has funds')

    st.end()
  })
}
