# Copilot Instructions — @dabighomie/ugwtf

**Package**: `@dabighomie/ugwtf` v1.0.0
**Runtime**: Node 20+, ESM TypeScript, Vitest
**Purpose**: Orchestrate ~86 agents across 35 clusters to manage labels, issues, PRs, workflows, audits, and domain scans for a multi-repo portfolio.

---

## Quick Start

```bash
cd ~/management-git/ugwtf
npx tsx src/index.ts <command> [repos...] [flags]
npx vitest run                           # 261+ tests
npx tsc --noEmit                         # 0 errors required
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
└── utils/                 # Logger, filesystem, env helpers
```

**Import direction (one-way):**
```
index → orchestrator → swarm → clusters → agents
All may import: types, utils/*, clients/*
```

## Key Commands

| Command | Cluster(s) | Agents |
|---------|-----------|--------|
| `deploy` | labels, workflows | label-sync, workflow-deploy |
| `validate` | quality | tsc-check, eslint-check, build-check, config-health |
| `generate-chain` | generate-chain | chain-generator (toposort + wave assignment) |
| `chain` | chain | chain-config-loader, chain-issue-creator, chain-advancer |
| `prompts` | prompts | prompt-scanner, prompt-validator, prompt-issue-creator, prompt-forecaster |
| `audit` | many | Runs all quality + domain clusters |

## Registered Repos

| Alias | Slug |
|-------|------|
| `damieus` | DaBigHomie/damieus-com-migration |
| `ffs` | DaBigHomie/flipflops-sundays-reboot |
| `043` | DaBigHomie/one4three-co-next-app |
| `maximus` | DaBigHomie/maximus-ai |
| `cae` | DaBigHomie/cae-luxury-hair |

## Chain Pipeline

1. `generate-chain <repo>` — scans `.prompt.md` files, parses dependencies, runs Kahn's toposort, assigns waves, writes `scripts/prompt-chain.json`
2. `chain <repo>` — reads chain config, creates GitHub issues for entries missing issues, advances chain by assigning Copilot to the next unblocked entry
3. Prompts are scored 0-100 by `validatePrompt()` (12-point system) — low-scoring prompts emit warnings during chain generation

## Validation Scoring (12 criteria, 100 max)

Title (10) · Priority (10) · Objective (15) · Sections (10) · Success Criteria (10) · Testing (10) · Code Examples (10) · Time Estimate (5) · Revenue Impact (5) · Checklists (5) · Reference Impl (5) · Content Depth (5)

## Testing

- **261+ tests** across 15 files, all passing
- Fixtures: `tests/fixtures/test-repo/` (7 Format B + 1 Format A prompts)
- Coverage: v8, 60% line threshold
- Run: `npx vitest run` or `npx vitest run src/agents/chain-agents.test.ts`

## Pre-Commit (Mandatory)

```bash
npx tsc --noEmit    # 0 errors
npx vitest run      # all pass
```

## Conventions

- Agent IDs: `kebab-case` (e.g. `chain-generator`)
- Cluster IDs: `kebab-case` (e.g. `generate-chain`)
- Agent files: `src/agents/{cluster}-agents.ts`
- Tests: `src/**/*.test.ts` (co-located)
- Repo aliases: short lowercase (`damieus`, `ffs`, `043`)

## Deep Docs

See [AGENTS.md](../AGENTS.md) → links to `docs/agent-guide/` (10 files covering architecture, all 86 agents, CLI reference, testing, scoring, gaps).
