# UGWTF — Agent Quick Start

**Package**: `@dabighomie/ugwtf` v1.0.0  
**Location**: `~/management-git/ugwtf/`  
**Runtime**: Node 20+, ESM TypeScript

## Run a Command

```bash
cd ~/management-git/ugwtf
# Preferred (full output, no TTY issues):
node dist/index.js <command> [repos...] [flags]

# Alternative (may lose output to spinner):
npx tsx src/index.ts <command> [repos...] [flags]
```

> **Tip**: Always rebuild before running: `npm run build`  
> **Tip**: Always use `--no-cache` after making changes

## Key Commands

### Pipeline (run in order for new chains)
| Step | Command | Purpose |
|------|---------|---------|
| 1 | `prompts` | Scan .prompt.md files → create spec issues |
| 2 | `generate-chain` | Build prompt-chain.json from prompts |
| 3 | `chain` | Create chain issues → assign Copilot |
| 4 | `issues` | Triage stalled, re-assign, auto-label |
| 5 | `prs` | Review Copilot PRs, DB migration firewall |

### Setup & Maintenance
| Command | Purpose |
|---------|---------|
| `install` | Sync labels + deploy CI workflows |
| `fix` | Auto-fix labels, workflows, quality |
| `status` | Quick health audit (5-domain score) |
| `audit` | Full audit + cross-repo scoreboard |
| `validate` | Quality gates (tsc, lint, build) |

## Flags

```
--dry-run        Preview without executing
--verbose, -v    Debug output
--concurrency N  Parallel repos (default: 3)
--cluster ID     Target specific cluster
--path <dir>     Scope prompt scanning to path
--no-cache       Disable repo unchanged-skip cache
--output <fmt>   Report format: json|markdown|summary
```

## Quality Gates (Before Commit)

```bash
npx tsc --noEmit     # 0 errors
npm run lint         # 0 errors
npm run build        # succeeds
npx vitest run       # 383 tests pass
```

## Registered Repos

| Alias | Repository |
|-------|-----------|
| `damieus` | damieus-com-migration |
| `043` | one4three-co-next-app |
| `ffs` | flipflops-sundays-reboot |
| `cae` | cae-luxury-hair |
| `maximus` | maximus-ai |

## Next Steps

- **[10-PIPELINE-OPERATIONS.md](10-PIPELINE-OPERATIONS.md)** — Full pipeline runbook (start here for operations)
- [01-ARCHITECTURE.md](01-ARCHITECTURE.md) — File tree + layers
- [02-AGENTS.md](02-AGENTS.md) — All 94 agents by cluster
- [03-CLI.md](03-CLI.md) — Full CLI reference
- [04-SCRIPTS.md](04-SCRIPTS.md) — Script purpose index
- [05-TESTING.md](05-TESTING.md) — Test files + coverage
- [06-VALIDATION.md](06-VALIDATION.md) — Gold standard scoring
