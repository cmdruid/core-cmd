/**
 * Fixtures barrel export
 */

// RPC fixtures
export {
  get_default_rpc_responses,
  get_error_rpc_responses,
  create_block_response,
  create_tx_response,
  create_chain_info_response
} from './rpc.fixture.js'

// Wallet fixtures
export {
  create_utxo_fixture,
  create_utxo_set_fixture,
  create_coin_selection_utxos,
  create_confirmed_utxo_fixture,
  create_mempool_utxo_fixture,
  create_wallet_info_fixture,
  create_wallet_fixture,
  create_faucet_fixture,
  create_empty_wallet_fixture,
  create_rich_wallet_fixture,
  create_full_wallet_fixture,
  create_multi_wallet_fixtures,
  create_balance_test_fixtures,
  create_address_fixtures
} from './wallet.fixture.js'

// Transaction fixtures
export {
  create_tx_fixture,
  create_confirmed_tx_fixture,
  create_mempool_tx_fixture,
  create_coinbase_tx_fixture,
  create_confirmed_status_fixture,
  create_unconfirmed_status_fixture,
  create_tx_data_fixture,
  create_full_tx_fixture,
  create_confirmation_test_fixtures,
  create_tx_chain_fixture,
  create_rbf_fixtures,
  generate_txid,
  generate_sequential_txid,
  reset_txid_counter
} from './transaction.fixture.js'

// Block fixtures
export {
  create_header_fixture,
  create_genesis_header_fixture,
  create_block_fixture,
  create_block_with_txs_fixture,
  create_block_data_fixture,
  create_header_chain_fixture,
  create_block_chain_fixture,
  create_full_block_fixture,
  create_reorg_fixtures,
  create_sync_test_fixtures,
  create_height_test_fixtures,
  generate_blockhash,
  generate_random_blockhash,
  generate_merkle_root,
  calculate_confirmations
} from './block.fixture.js'

// Config fixtures
export {
  create_test_config,
  create_ci_config,
  create_production_config,
  create_full_config,
  create_regtest_config,
  create_testnet_config,
  create_signet_config,
  create_mainnet_config,
  create_isolated_test_config,
  create_auth_test_config,
  create_zmq_test_config,
  create_custom_params_config,
  create_invalid_configs,
  get_platform_defaults,
  create_platform_config
} from './config.fixture.js'

// Descriptor fixtures
export {
  VALID_DESCRIPTORS,
  MAINNET_DESCRIPTORS,
  INVALID_DESCRIPTORS,
  SHORT_PATH_DESCRIPTORS,
  VALID_SEGMENTS,
  INVALID_SEGMENTS,
  EXPECTED_PARSE_RESULTS,
  create_descriptor_item_fixture,
  create_descriptor_set_fixture,
  create_descriptor_fixture,
  create_raw_pubkey_descriptor_fixture
} from './descriptor.fixture.js'

// Re-export types from fixture.types.ts
export type {
  RPCResponseFixtures,
  ChainInfoFixture,
  BlockFixture,
  TxFixture,
  WalletInfoFixture,
  FeeEstimateFixture,
  MempoolAcceptFixture,
  MempoolInfoFixture,
  NetworkInfoFixture,
  UTXOFixtureData,
  UTXOSetFixture,
  TransactionFixture,
  BlockHeaderFixture,
  FullBlockFixture,
  DescriptorFixture,
  FullWalletFixture,
  CoreConfigFixture,
  RPCErrorFixture,
  WalletFixtureData,
  BlockFixtureData,
  TxFixtureData
} from '../types/fixture.types.js'

export { RPC_ERROR_CODES } from '../types/fixture.types.js'
