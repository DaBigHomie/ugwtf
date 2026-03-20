# Claude Code Instructions — @dabighomie/ugwtf

**Package**: `@dabighomie/ugwtf` v1.0.0
**Runtime**: Node >=20, ESM TypeScript, Vitest
**Purpose**: Unified GitHub Workflow Transformation Framework

---

## Quick Start

```bash
cd ~/management-git/ugwtf
npx tsx src/index.ts <command> [repos...] [flags]
npx vitest run       # 400 tests, all passing
npx tsc --noEmit     # 0 errors required
```

## Pre-Commit (Mandatory)

```bash
npx tsc --noEmit     # 0 errors
npx vitest run       # all pass
npm run build        # succeeds (dist/ output)
```

## Architecture

```
src/
├── index.ts               # CLI parser → orchestrate()
├── orchestrator.ts        # COMMAND_CLUSTER_MAP → executeSwarm()
├── types.ts               # Agent, Cluster, SwarmConfig, AgentContext
├── agents/                # ~86 agent implementations (36 files)
├── clusters/index.ts      # 35 cluster definitions
├── config/repo-registry.ts# 5 registered repos
├── swarm/executor.ts      # Parallel/sequential cluster runner
├── clients/github.ts      # Octokit wrapper
├── audit-orchestrator/    # Inlined frontend audit engine
└── utils/                 # Logger, filesystem, env helpers
```

**Import direction (one-way):**
```
index → orchestrator → swarm → clusters → agents
All may import: types, utils/*, clients/*
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `deploy` | Sync labels + deploy CI/CD workflows |
| `validate` | Run quality gates (tsc, lint, build) |
| `audit` | Full audit with scoreboard |
| `issues` | Triage, assign Copilot, detect stalled |
| `prs` | Review Copilot PRs, DB migration firewall |
| `generate-chain` | Scan prompts → toposort → wave assignment |
| `chain` | Create issues + advance Copilot assignments |
| `prompts` | Scan/validate/forecast prompt files |

## Registered Repos

| Alias | Slug |
|-------|------|
| `damieus` | DaBigHomie/damieus-com-migration |
| `ffs` | DaBigHomie/flipflops-sundays-reboot |
| `043` | DaBigHomie/one4three-co-next-app |
| `maximus` | DaBigHomie/maximus-ai |
| `cae` | DaBigHomie/cae-luxury-hair |

## Conventions

- Agent IDs: `kebab-case` (e.g. `chain-generator`)
- Cluster IDs: `kebab-case` (e.g. `generate-chain`)
- Tests co-located: `src/**/*.test.ts`
- Portable paths only — NEVER `/Users/dame/...`
- No `git reset` — use `git rm --cached` instead

## Deep Docs

See [AGENTS.md](AGENTS.md) → links to `docs/agent-guide/` (10 files covering architecture, all 86 agents, CLI reference, testing, scoring, gaps).
