# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in the DUCAT Validator:

1. **Do not** open a public GitHub issue
2. Use [GitHub's private vulnerability reporting](https://github.com/ducat-unit/validator-ts/security/advisories/new)
3. Include detailed steps to reproduce the issue
4. Describe the potential impact
5. Include any suggested fixes if available
6. Allow reasonable time for a fix before public disclosure

We follow responsible disclosure practices and will credit reporters in security advisories.

## Response Timeline

- **Initial Response**: Within 48 hours of report
- **Assessment**: Within 1 week
- **Fix Development**: Depends on severity
- **Public Disclosure**: After fix is released and users have time to upgrade

## Scope

Security issues in the following areas are in scope:

- **Consensus Logic**: Validation rules, asset accounting, vault state machine
- **Database Operations**: SQL injection, data integrity
- **Cryptographic Operations**: Signature verification, key handling
- **API Server**: Authentication bypass, data exposure
- **Input Validation**: Buffer overflows, injection attacks

## Out of Scope

The following are generally out of scope:

- Issues in dependencies (report to upstream maintainers)
- Issues requiring physical access to the server
- Social engineering attacks
- Denial of service via resource exhaustion (unless severe)

## Security-Sensitive Code

The following areas handle security-critical operations and receive additional scrutiny:

- `src/rules/vault/` - Vault validation rules
- `src/crawler/handler/` - Transaction processing
- `src/db/sql/` - Database queries
- `src/validator/class/filter.ts` - Validation pipeline

## Security Best Practices

When running a validator node:

- Run behind a firewall with minimal exposed ports
- Use HTTPS/TLS for API endpoints in production
- Regularly update dependencies
- Monitor logs for suspicious activity
- Keep Bitcoin Core updated

## Contact

For security issues that cannot be reported via GitHub:

- Email: security@ducat.org (if available)
- Use PGP encryption for sensitive details

## Acknowledgments

We thank the security researchers who help keep the DUCAT protocol safe.
