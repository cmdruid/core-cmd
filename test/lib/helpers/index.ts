/**
 * Test helpers barrel export
 *
 * This module extends the existing test/helpers.ts with additional utilities
 */

// Re-export from existing helpers
export {
  expectError,
  expectErrorType,
  withDaemon,
  sleep,
  retry,
  tapeHelpers,
  type TestContext as LegacyTestContext
} from '../helpers.js'

// Assertions
export {
  create_assertions,
  expect_error,
  expect_error_type,
  is_valid_tx,
  is_valid_utxo,
  is_valid_txid,
  is_valid_blockhash,
  type AssertionHelpers
} from './assertions.js'

// Context
export {
  create_mock_context,
  create_configured_mock_context,
  create_daemon_context,
  create_extended_daemon_context,
  is_daemon_context,
  is_mock_context,
  get_client,
  get_wallet,
  get_daemon,
  with_mock_context,
  with_daemon_context,
  cleanup_context,
  create_auto_cleanup_context
} from './context.js'

// Mock utilities
export {
  assert_called,
  assert_called_with,
  assert_call_count,
  assert_not_called,
  assert_call_order,
  assert_called_within,
  create_spy,
  create_async_spy,
  get_called_methods,
  get_last_call,
  get_method_calls,
  find_calls,
  has_call_matching,
  args_match,
  args_contain,
  get_calls_in_range,
  get_call_intervals,
  get_average_call_interval,
  type Spy
} from './mock.utils.js'

// State utilities
export {
  verify_state_sequence,
  verify_standard_sequence,
  verify_startup_sequence,
  verify_shutdown_sequence,
  assert_state,
  assert_transition,
  assert_no_transition,
  assert_state_visited,
  assert_state_not_visited,
  assert_transition_count,
  get_visited_states,
  get_final_state,
  get_initial_state,
  count_transitions_to,
  count_transitions_from,
  get_state_transitions,
  has_error_transition,
  get_error_transitions,
  get_state_durations,
  STATE_SEQUENCES
} from './state.utils.js'
