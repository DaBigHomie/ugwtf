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
| [05-TESTING.md](docs/agent-guide/05-TESTING.md) | 261 tests, fixtures, coverage gaps |
| [06-VALIDATION.md](docs/agent-guide/06-VALIDATION.md) | 12-point gold standard scoring |
| [07-POST-VALIDATION.md](docs/agent-guide/07-POST-VALIDATION.md) | Scoreboard, persist, JSON reporter outputs |
| [08-APPROVAL-PIPELINE.md](docs/agent-guide/08-APPROVAL-PIPELINE.md) | 8-phase Copilot approval + DB firewall |
| [09-GAPS.md](docs/agent-guide/09-GAPS.md) | Known test/feature/doc gaps + next steps |

## Build & Validate

```bash
npx tsc --noEmit     # 0 errors
npm run lint         # 0 errors  
npm run build        # succeeds
npx vitest run       # 261 tests pass
```

## Stats

- **86 agents** across **35 clusters**
- **261 tests** across **15 test files**
- **11 automation scripts** in `scripts/`
- **7 YAML generators** in `src/generators/`
- **5 registered repos** (damieus, 043, ffs, cae, maximus)
