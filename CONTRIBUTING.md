# Contributing Guide

Guidelines for contributing to the DUCAT Validator.

## Getting Started

```bash
git clone https://github.com/ducat-unit/validator-ts.git
cd validator-ts
bun install
bun run check
```

## Development Workflow

### Branches

| Branch | Purpose |
|--------|---------|
| `master` | Stable releases |
| `dev` | Integration branch |
| `feature/*` | New features |
| `fix/*` | Bug fixes |

### Making Changes

1. Create a feature branch from `dev`
2. Make changes with tests where applicable
3. Run `bun run check` to verify types
4. Run `bun run lint` to check code style
5. Submit PR to `dev`

## Code Style

See [CONVENTIONS.md](./docs/CONVENTIONS.md) for detailed code style guidelines.

### Quick Reference

- **Strict TypeScript**: No `any` types allowed
- **Functions/Variables**: `snake_case`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **File Extensions**: Always use `.js` in imports

### Import Organization

```typescript
// 1. External dependencies
import { z } from 'zod'

// 2. Internal modules (@/)
import { BlockCrawler } from '@/crawler/class/crawler.js'

// 3. Development modules (#/)
import { get_config } from '#/config.js'

// 4. Relative imports
import { process_tx } from '../lib/util.js'

// 5. Type imports
import type { TransactionContext } from '../types/index.js'
```

## Testing

### Development Environment

```bash
# Start Bitcoin Core (required)
bun run core:qt

# Start development server
bun run dev

# Reset environment
bun run reset
```

### Manual Testing

Test API endpoints using files in `dev/fetch/`:

```bash
# Check database state
bun run scripts/dump.ts
```

### Type Checking

```bash
bun run check
```

## Pull Requests

### Before Submitting

- [ ] Types pass: `bun run check`
- [ ] Lint passes: `bun run lint`
- [ ] No unused imports or variables
- [ ] Documentation updated if needed

### PR Title Format

```
type(scope): description

Examples:
feat(vault): add trim operation validation
fix(crawler): handle reorg correctly
docs(guide): update installation steps
refactor(db): simplify asset queries
```

### PR Description

Include:
- What changed and why
- Breaking changes (if any)
- Testing performed

## Documentation

### When to Update Docs

- New public API endpoints → docs/API.md
- New concepts/terms → docs/GLOSSARY.md
- Architecture changes → docs/ARCHITECTURE.md
- Protocol changes → docs/PROTOCOL.md
- Breaking changes → CHANGELOG.md

### Documentation Style

- Use terminology from [GLOSSARY.md](./docs/GLOSSARY.md)
- Reference source files as `file.ts:line`
- Keep code examples synchronized with actual implementation
- Add cross-references between related sections

## Security

### Reporting Vulnerabilities

Do **not** open public issues for security vulnerabilities. Use [GitHub's private vulnerability reporting](https://github.com/ducat-unit/validator-ts/security/advisories/new).

See [SECURITY.md](./SECURITY.md) for full details.

### Security-Sensitive Code

Extra review required for changes to:
- `src/rules/vault/` - Vault validation rules
- `src/crawler/handler/` - Transaction handlers
- `src/db/sql/` - Database queries
- `src/validator/class/filter.ts` - Validation pipeline

## Project Structure

```
validator-ts/
├── src/                    # Main source code
│   ├── crawler/            # Block processing
│   ├── db/                 # Database layer
│   ├── rules/              # Validation rules
│   ├── server/             # HTTP API
│   └── validator/          # Validation filter
├── dev/                    # Development utilities
├── scripts/                # CLI scripts
└── docs/                   # Documentation
```

## Questions?

- Check existing [documentation](./docs/INDEX.md)
- Open a GitHub issue for questions
- See [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for debugging help
