# UGWTF — Agent Quick Start

**Package**: `@dabighomie/ugwtf` v1.0.0  
**Location**: `~/management-git/ugwtf/`  
**Runtime**: Node 20+, ESM TypeScript

## Run a Command

```bash
cd ~/management-git/ugwtf
npx tsx src/index.ts <command> [repos...] [flags]
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `labels` | Sync label definitions to GitHub repos |
| `deploy` | Labels + CI/CD workflow deployment |
| `validate` | Quality gates (tsc, lint, build, config) |
| `issues` | Stale detection, Copilot assign, auto-triage |
| `prs` | Copilot PR review, DB migration firewall |
| `audit` | Full repo health audit + scoreboard |
| `fix` | Auto-fix labels, workflows, quality issues |
| `status` | Quick health snapshot |
| `generate-chain` | Build prompt execution chain from docs/ |

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

- [01-ARCHITECTURE.md](01-ARCHITECTURE.md) — File tree + layers
- [02-AGENTS.md](02-AGENTS.md) — All 85+ agents by cluster
- [03-CLI.md](03-CLI.md) — Full CLI reference
- [04-SCRIPTS.md](04-SCRIPTS.md) — Script purpose index
- [05-TESTING.md](05-TESTING.md) — Test files + coverage
- [06-VALIDATION.md](06-VALIDATION.md) — Gold standard scoring
