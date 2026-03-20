# Agent Instructions — @dabighomie/ugwtf

**Package**: `@dabighomie/ugwtf` v1.0.0  
**Purpose**: Unified GitHub Workflow Transformation Framework — deploy standardized CI/CD, Copilot automation, and quality gates across all DaBigHomie repos  
**Runtime**: Node 20+, ESM TypeScript, Vitest

## Quick Start

```bash
cd ~/management-git/ugwtf
npx tsx src/index.ts <command> [repos...] [flags]
```

## Agent-Readable Documentation

| Doc | What It Covers |
|-----|---------------|
| [00-QUICK-START.md](docs/agent-guide/00-QUICK-START.md) | Commands, flags, registered repos |
| [01-ARCHITECTURE.md](docs/agent-guide/01-ARCHITECTURE.md) | File tree, data flow, core types |
| [02-AGENTS.md](docs/agent-guide/02-AGENTS.md) | All 86 agents by cluster |
| [03-CLI.md](docs/agent-guide/03-CLI.md) | Full CLI reference + examples |
| [04-SCRIPTS.md](docs/agent-guide/04-SCRIPTS.md) | Script + generator purpose index |
| [05-TESTING.md](docs/agent-guide/05-TESTING.md) | 272 tests, fixtures, coverage gaps |
| [06-VALIDATION.md](docs/agent-guide/06-VALIDATION.md) | 12-point gold standard scoring |
| [07-POST-VALIDATION.md](docs/agent-guide/07-POST-VALIDATION.md) | Scoreboard, persist, JSON reporter outputs |
| [08-APPROVAL-PIPELINE.md](docs/agent-guide/08-APPROVAL-PIPELINE.md) | 8-phase Copilot approval + DB firewall |
| [09-GAPS.md](docs/agent-guide/09-GAPS.md) | Known test/feature/doc gaps + next steps |

## Build & Validate

```bash
npx tsc --noEmit     # 0 errors
npm run lint         # 0 errors  
npm run build        # succeeds
npx vitest run       # 272 tests pass
```

## Stats

- **86 agents** across **35 clusters**
- **383 tests** across **20 test files**
- **11 automation scripts** in `scripts/`
- **7 YAML generators** in `src/generators/`
- **6 registered repos** (damieus, 043, ffs, cae, maximus, ugwtf)

## Chain Workflow (Generic — Any Repo, Any Folder)

For any prompt folder in any registered repo, use the CLI directly:

```bash
# Verify prompts in a folder (dry-run: toposort, quality scoring, no side effects)
npm run chain:folder:verify -- <repo> --path <folder>

# Execute chain (create issues, assign Copilot, advance)
npm run chain:folder:run -- <repo> --verbose
```

**Examples across repos:**
```bash
npm run chain:folder:verify -- damieus --path docs/agent-prompts/phase-01
npm run chain:folder:verify -- 043 --path docs/agent-prompts/checkout
npm run chain:folder:run -- damieus --verbose
```

Or call the CLI directly:
```bash
ugwtf generate-chain <repo> --path <folder> --dry-run --verbose
ugwtf chain <repo> --verbose
```

## Self-Publish Dogfood (One-Off)

Hardcoded to ugwtf repo + `docs/agent-prompts/publish-chain/`:

```bash
npm run dogfood:setup     # Generate 40 publish-chain prompts
npm run dogfood:verify    # tsc + tests + dry-run chain + scoped generate-chain
npm run dogfood:execute   # Create/advance chain issues in GitHub
npm run dogfood:full      # setup + verify combined
```

## No-Manual-Exploration Rule

- ✅ Use `chain:folder:verify` / `chain:folder:run` for any repo's prompts
- ✅ Use `dogfood:*` scripts for the self-publish chain specifically
- ❌ Do not manually re-read planning docs to regenerate known artifacts
- ❌ Do not manually inspect orchestration internals when a dry-run command proves behavior

Manual exploration in a repeatable path wastes context/tokens and introduces avoidable drift.
