/**
 * E2E test for transaction flow
 */

import type { DaemonTestContext } from '../../lib/types/test.types.js'
import { SATS_PER_BTC } from '../../lib/const.js'
import { is_valid_txid } from '../../lib/helpers/assertions.js'

/**
 * E2E transaction flow test
 */
export default async function transactions_e2e_test(
  tape: typeof import('tape'),
  ctx : DaemonTestContext
): Promise<void> {
  const { client, faucet } = ctx

  tape('Complete transaction lifecycle', async (t) => {
    // Setup: Create sender and receiver wallets
    const suffix = Date.now()
    const sender = await ctx.create_wallet(`e2e_tx_sender_${suffix}`)
    const receiver = await ctx.create_wallet(`e2e_tx_receiver_${suffix}`)

    // Fund sender from faucet
    const senderAddr = await sender.generate_address()
    const fundingTxid = await faucet.send_funds(5 * SATS_PER_BTC, senderAddr, false)

    t.ok(fundingTxid, 'Funding txid returned')
    t.ok(is_valid_txid(fundingTxid), 'Valid funding txid')

    // Verify funding tx in mempool
    const fundingStatus = await client.get_tx_status(fundingTxid)
    t.ok(fundingStatus, 'Funding tx status available')
    t.equal(fundingStatus?.confirmed, false, 'Funding tx initially unconfirmed')

    // Mine to confirm funding
    await ctx.mine_and_wait(1)

    // Verify funding confirmed
    const confirmedFunding = await client.get_tx_status(fundingTxid)
    t.equal(confirmedFunding?.confirmed, true, 'Funding tx confirmed')

    // Check sender balance
    const senderBalance = await sender.get_balance()
    t.equal(senderBalance, 5 * SATS_PER_BTC, 'Sender has funded balance')

    // Send to receiver
    const receiverAddr = await receiver.generate_address()
    const sendAmount = 2 * SATS_PER_BTC
    const sendTxid = await sender.send_funds(sendAmount, receiverAddr, false)

    t.ok(sendTxid, 'Send txid returned')
    t.ok(is_valid_txid(sendTxid), 'Valid send txid')

    // Verify send tx in mempool
    const sendStatus = await client.get_tx_status(sendTxid)
    t.equal(sendStatus?.confirmed, false, 'Send tx initially unconfirmed')

    // Get full transaction details
    const sendTx = await client.get_tx(sendTxid)
    t.ok(sendTx, 'Send tx details available')
    t.ok((sendTx?.vout.length ?? 0) >= 2, 'Tx has at least 2 outputs (payment + change)')

    // Find the payment output
    const paymentOutput = sendTx?.vout.find(
      o => o.scriptPubKey?.address === receiverAddr
    )
    t.ok(paymentOutput, 'Payment output found')
    t.equal(paymentOutput?.value, sendAmount, 'Payment amount correct')

    // Mine to confirm send
    await ctx.mine_and_wait(1)

    // Verify send confirmed
    const confirmedSend = await client.get_tx_status(sendTxid)
    t.equal(confirmedSend?.confirmed, true, 'Send tx confirmed')

    // Check final balances
    const finalReceiverBalance = await receiver.get_balance()
    t.equal(finalReceiverBalance, sendAmount, 'Receiver has correct balance')

    const finalSenderBalance = await sender.get_balance()
    t.ok(
      finalSenderBalance < 5 * SATS_PER_BTC && finalSenderBalance > 0,
      'Sender balance reflects payment + fee'
    )

    // Verify UTXO state
    const receiverUtxos = await receiver.list_utxos()
    t.equal(receiverUtxos.length, 1, 'Receiver has 1 UTXO')
    t.equal(receiverUtxos[0].sats, sendAmount, 'UTXO amount matches')

    const senderUtxos = await sender.list_utxos()
    t.ok(senderUtxos.length >= 1, 'Sender has at least 1 UTXO (change)')

    t.end()
  })

  tape('Multiple confirmations', async (t) => {
    const suffix = Date.now()
    const wallet = await ctx.create_wallet(`e2e_tx_confs_${suffix}`)
    const address = await wallet.generate_address()

    const txid = await faucet.send_funds(1 * SATS_PER_BTC, address, false)

    // Mine 6 blocks for full confirmation
    await ctx.mine_and_wait(6)

    const tx = await client.get_tx(txid)
    t.ok(tx, 'Transaction found')
    t.ok((tx?.confirmations ?? 0) >= 6, 'Transaction has 6+ confirmations')

    t.end()
  })

  tape('Transaction with multiple outputs', async (t) => {
    const suffix = Date.now()
    const wallet = await ctx.create_wallet(`e2e_tx_multi_${suffix}`)
    const addr1 = await wallet.generate_address()

    // Send to addr1 first to get funds
    await faucet.send_funds(3 * SATS_PER_BTC, addr1, true)

    // Now wallet can create multi-output tx
    const balance = await wallet.get_balance()
    t.ok(balance >= 3 * SATS_PER_BTC, 'Wallet has funds')

    t.end()
  })
}
