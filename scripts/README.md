# UGWTF Portable Scripts

Standalone TypeScript scripts for common operations. Run with `npx tsx`.

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `create-chain-issues.mts` | Create GitHub issues from a `prompt-chain.json` file | `npx tsx scripts/create-chain-issues.mts projects/o43/prompt-chain.json` |
| `advance-chain.mts` | Advance the chain to the next open position | `npx tsx scripts/advance-chain.mts projects/o43/prompt-chain.json` |
| `audit-all.mts` | Run audit across all registered repos | `npx tsx scripts/audit-all.mts` |

## Flags

All scripts support:
- `--dry-run` — Preview actions without executing
- `--verbose` — Show debug output (where applicable)

`create-chain-issues.mts` also supports:
- `--kick` — After creating issues, assign Copilot to position 1

## Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- `npx tsx` available (dev dependency)
- Run from the UGWTF root directory
