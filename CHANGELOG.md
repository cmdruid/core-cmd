# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-01-28

### Changed

- Updated `@biomejs/biome` from 2.3.12 to 2.3.13
- Updated `zeromq` from ^6.0.0 to ^6.5.0

### Fixed

- Fixed TypeScript errors in test codebase (276 errors resolved)
- Fixed biome lint issues in test files

## [2.0.0] - 2026-01-28

### Added

- **Event Bus System**: Hybrid ZMQ + Polling event bus for real-time notifications
  - `PollEventBus`: Polling-based fallback when ZMQ unavailable
  - `ZMQEventBus`: Real-time ZMQ notifications (requires `zeromq` package)
  - `createEventBus()`: Factory function to select best available transport
  - New events: `block`, `transaction`, `events:error`
  - Configuration: `events_enabled`, `events_poll_interval`, `polling_enabled`

- **External Signing API**: Support for hardware wallets, FROST, MuSig2, DLCs
  - `wallet.export_keypair()`: Export keys for external signing
  - `wallet.build_tx()`: Build transactions with pre-computed sighashes
  - `wallet.add_signature()`: Add external signatures to transactions
  - `wallet.finalize_tx()`: Finalize externally signed transactions

- **Comprehensive Documentation**
  - `docs/ARCHITECTURE.md`: System design, components, state machine
  - `docs/API.md`: Complete API reference
  - `docs/GUIDE.md`: Usage tutorials, patterns, best practices
  - Rewritten `README.md` with quick start and API overview

- **Unit Test Framework**: Test infrastructure without Bitcoin Core
  - Mock implementations for `CoreClient`, `CoreWallet`, `CoreDaemon`
  - Test helpers, fixtures, and builders
  - Separate runners: `test:unit`, `test:integration`, `test:e2e`
  - 640+ unit test assertions

- **Typed Error Classes**: Comprehensive error hierarchy
  - `ProcessError`: Bitcoin Core process failures
  - `CommandError`: bitcoin-cli execution failures
  - `ConnectionError`: RPC connection issues
  - `WalletError`: Wallet operation failures
  - `ConfigError`: Configuration validation errors
  - `NetworkError`: Network-related errors

- **Isolated Mode**: Random port assignment for parallel test execution
  - Uses random RPC port to avoid conflicts
  - Disables P2P listening (`-listen=0`)

- **MIT License**: Added LICENSE file

### Changed

- **Package Rename**: `@cmdcode/core-cmd` → `@vbyte/core-cmd`
- **Architecture Refactor**: Moved classes from `src/lib/` to `src/class/`
- **API Convention**: All public methods now use `snake_case` (camelCase deprecated)
- **CI Workflow**: Updated to npm (from yarn), Node 20.x/22.x
- **Error Handling**: Replaced generic `Error` throws with typed error classes

### Removed

- **SigningContext class**: Simplified external signing to wallet methods
- **Schema placeholder**: Removed empty `src/schema/` directory
- **Legacy tests**: Removed deprecated test runners
- **yarn.lock**: Switched to npm (package-lock.json)

### Breaking Changes

- Package name changed from `@cmdcode/core-cmd` to `@vbyte/core-cmd`
- Import paths changed (internal refactoring)
- `SigningContext` removed - use `wallet.build_tx()` and `wallet.add_signature()` directly
- Legacy camelCase methods are deprecated (still work but will warn)

### Migration from v1.x

```typescript
// Package name
- import { CoreDaemon } from '@cmdcode/core-cmd'
+ import { CoreDaemon } from '@vbyte/core-cmd'

// Method naming (old methods still work but deprecated)
- await client.getBlockCount()
+ await client.get_block_count()

- await wallet.getBalance()
+ await wallet.get_balance()

// External signing (SigningContext removed)
- const ctx = await wallet.create_signing_context(template)
- ctx.add_signature({ index, signature })
- const hex = await ctx.finalize()
+ const unsigned = await wallet.build_tx(template)
+ const signed = await wallet.add_signature(unsigned, { index, signature })
+ const hex = await wallet.finalize_tx(signed)
```

## [1.6.5] - Previous Release

See git history for changes prior to v2.0.0.
