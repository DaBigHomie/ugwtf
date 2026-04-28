# Claude Code Instructions — @dabighomie/ugwtf

**Package**: `@dabighomie/ugwtf` v1.0.0
**Runtime**: Node >=20, ESM TypeScript, Vitest
**Purpose**: Unified GitHub Workflow Transformation Framework

---

## Quick Start

```bash
cd ~/management-git/ugwtf
export GITHUB_TOKEN=$(gh auth token)
node dist/index.js <command> [repos...] [flags]
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
├── agents/                # Agent implementations
│   ├── chain-agents.ts    # Config-loader, issue-creator, chain-advancer
│   ├── cleanup-agents.ts  # Close orphan PRs, strip labels, assign Copilot
│   ├── dry-run-agents.ts  # E2E validation without side effects
│   └── ...
├── clusters/index.ts      # Cluster definitions
├── config/repo-registry.ts# 9 registered repos
├── swarm/executor.ts      # Parallel/sequential cluster runner
├── clients/github.ts      # GitHub API client (gh CLI + fetch)
├── audit-orchestrator/    # Inlined frontend audit engine
└── utils/                 # Logger, filesystem, env helpers
```

## Commands

### Pipeline (run in order for new chains)

| Command | Purpose |
|---------|---------|
| `prompts` | Scan .prompt.md → create spec issues |
| `generate-chain` | Build prompt-chain.json |
| `chain` | Create chain issues, assign Copilot |
| `issues` | Triage stalled, re-assign |
| `prs` | Review PRs, DB firewall |
| `cleanup` | Reset: close orphan PRs, strip labels, re-assign |
| `dry-run` | E2E validation without side effects |

### Setup & Quality

| Command | Purpose |
|---------|---------|
| `deploy`/`install` | Sync labels + deploy workflows |
| `validate` | Quality gates (tsc, lint, build) |
| `fix` | Auto-fix labels, workflows, quality |
| `status` | Quick health audit |
| `audit` | Full audit + scoreboard |

### Domain Scans

`scan`, `security`, `performance`, `a11y`, `seo`, `docs`, `commerce`, `scenarios`, `design-system`, `supabase`, `gateway`

## Global Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--dry-run` | false | Preview without executing |
| `--verbose`, `-v` | false | Debug output |
| `--concurrency N` | 3 | Max parallel repos |
| `--cluster ID` | — | Target specific cluster |
| `--path PATH` | — | Scope prompt scanning |
| `--max-copilot-concurrency N` | 1 | Max simultaneous Copilot issues |
| `--no-cache` | false | Skip repo cache |
| `--output FMT` | summary | `json`, `markdown`, `summary` |

## Copilot Assignment

- Assignee: `copilot-swe-agent[bot]` (NOT `copilot`)
- Requires `GITHUB_TOKEN` env (user PAT, not GHA token)
- Chain-advancer calls `assignCopilot()` directly
- Removes all assignee variants before re-adding

## Registered Repos

| Alias | Slug |
|-------|------|
| `damieus` | DaBigHomie/damieus-com-migration |
| `ffs` | DaBigHomie/flipflops-sundays-reboot |
| `043` | DaBigHomie/one4three-co-next-app |
| `maximus` | DaBigHomie/maximus-ai |
| `cae` | DaBigHomie/Cae |
| `ugwtf` | DaBigHomie/ugwtf |

## Conventions

- Agent IDs: `kebab-case`
- Cluster IDs: `kebab-case`
- Tests co-located: `src/**/*.test.ts`
- Portable paths only — NEVER `/Users/dame/...`

## Deep Docs

See [AGENTS.md](AGENTS.md) → links to `docs/agent-guide/` (10 files).
