# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-27

### Added

- **Event Bus System**: Hybrid ZMQ + Polling event bus for real-time notifications
  - `PollEventBus`: Polling-based fallback when ZMQ unavailable
  - `ZMQEventBus`: Real-time ZMQ notifications (requires `zeromq` package)
  - `createEventBus()`: Factory function to select best available transport
  - New events: `block`, `transaction`, `events:error`
  - Configuration: `events_enabled`, `events_poll_interval`, `polling_enabled`

- **External Signing API**: Support for FROST, MuSig2, DLCs, and adaptor signatures
  - `SigningContext`: State management for multi-step signing workflows
  - `wallet.export_keypair()`: Export keys for external signing
  - `wallet.build_tx()`: Build transactions with pre-computed sighashes
  - `wallet.add_signature()`: Add external signatures to transactions
  - `wallet.create_signing_context()`: Create managed signing workflows

- **Unit Test Framework**: Comprehensive test infrastructure
  - Mock implementations for `CoreClient`, `CoreWallet`, `CoreDaemon`
  - Test helpers and fixtures
  - Separate runners for unit, integration, and e2e tests
  - CI-friendly: `npm run test:unit` requires no Bitcoin Core

- **MIT License**: Added LICENSE file

### Changed

- **Package Rename**: `@cmdcode/core-cmd` → `@vbyte/core-cmd`
- **Architecture Refactor**: Moved classes from `src/lib/` to `src/class/`
- **API Convention**: All public methods now use `snake_case` (camelCase deprecated)
- **CI Workflow**: Updated to npm (from yarn), Node 20.x/22.x

### Removed

- **Schema Placeholder**: Removed empty `src/schema/` directory
- **yarn.lock**: Switched to npm (package-lock.json)

### Breaking Changes

- Package name changed from `@cmdcode/core-cmd` to `@vbyte/core-cmd`
- Import paths changed (internal refactoring)
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
```

## [1.6.5] - Previous Release

See git history for changes prior to v2.0.0.
