# UGWTF Portable Scripts

Standalone TypeScript scripts for common operations. Run with `npx tsx scripts/<name>.mts`.

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `advance-chain.mts` | Advance prompt chain to next step; marks completed, triggers next | `npx tsx scripts/advance-chain.mts projects/o43/prompt-chain.json` |
| `audit-all.mts` | Run full audit across all registered repos | `npx tsx scripts/audit-all.mts` |
| `cluster-test-runner.mts` | Run tests scoped to a specific cluster | `npx tsx scripts/cluster-test-runner.mts --cluster prompts` |
| `context-analyzer.mts` | Analyze repo context size (files, tokens) | `npx tsx scripts/context-analyzer.mts damieus` |
| `context-budget.mts` | Calculate token budget for agent contexts | `npx tsx scripts/context-budget.mts` |
| `create-chain-issues.mts` | Create GitHub issues from prompt-chain.json | `npx tsx scripts/create-chain-issues.mts projects/o43/prompt-chain.json` |
| `doc-manager.mts` | Manage documentation lifecycle (create, update, archive) | `npx tsx scripts/doc-manager.mts` |
| `doc-sync-validator.mts` | Validate cross-references between docs | `npx tsx scripts/doc-sync-validator.mts` |
| `scoreboard-validator.mts` | Validate scoreboard JSON integrity | `npx tsx scripts/scoreboard-validator.mts` |
| `swarm-quality-gate.mts` | Run quality gate checks as swarm pre-flight | `npx tsx scripts/swarm-quality-gate.mts` |
| `wave-runner.mts` | Execute prompt chain waves (batches of parallel prompts) | `npx tsx scripts/wave-runner.mts projects/o43/prompt-chain.json` |

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

## Chain Folder Commands (Generic)

Use these for prompts in **any folder** of **any registered repo** — pass repo and path via `--`:

- `npm run chain:folder:verify -- <repo> --path <folder>` — tsc + tests + generate-chain dry-run
- `npm run chain:folder:run -- <repo> --verbose` — create issues, advance chain

**Examples:**
```bash
npm run chain:folder:verify -- damieus --path docs/agent-prompts/phase-01
npm run chain:folder:run -- damieus --verbose
```

## Dogfood Shortcuts (Self-Publish Only)

Hardcoded to ugwtf + `docs/agent-prompts/publish-chain/`:

- `npm run dogfood:setup` — generate 40 self-publish prompts + chain config
- `npm run dogfood:verify` — full type-check, tests, and both chain dry-runs
- `npm run dogfood:execute` — create/advance chain issues in GitHub
- `npm run dogfood:full` — setup + verify in one command
