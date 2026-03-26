# Copilot Instructions — @dabighomie/ugwtf

**Package**: `@dabighomie/ugwtf` v1.0.0
**Runtime**: Node 20+, ESM TypeScript, Vitest
**Purpose**: Orchestrate agents across clusters to manage labels, issues, PRs, workflows, audits, and domain scans for a multi-repo portfolio.

---

## Quick Start

```bash
cd ~/management-git/ugwtf
export GITHUB_TOKEN=$(gh auth token)
node dist/index.js <command> [repos...] [flags]
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
├── config/repo-registry.ts# 6 registered repos
├── swarm/executor.ts      # Parallel/sequential cluster runner
├── clients/github.ts      # GitHub API client (gh CLI + fetch)
└── utils/                 # Logger, filesystem, env helpers
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `prompts` | Scan .prompt.md → create spec issues |
| `generate-chain` | Build prompt-chain.json (toposort + waves) |
| `chain` | Create chain issues, assign Copilot |
| `issues` | Triage stalled, re-assign |
| `prs` | Review PRs, DB firewall |
| `cleanup` | Reset: close orphan PRs, strip labels, re-assign |
| `dry-run` | E2E validation (no side effects) |
| `deploy` | Sync labels + deploy workflows |
| `audit` | Full health audit + scoreboard |

## Copilot Assignment

- Assignee: `copilot-swe-agent[bot]` (NOT `copilot`)
- Requires `GITHUB_TOKEN` env (user PAT via `gh auth token`)
- Chain-advancer calls `assignCopilot()` directly (not GHA dispatch)
- Removes all assignee variants before re-adding

## Anti-Bypass Rules

- ❌ Never use `github-assign_copilot_to_issue` MCP tool
- ❌ Never use `gh api` to modify chain state
- ✅ Use `ugwtf chain` to advance, `ugwtf cleanup` to reset

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
- Agent files: `src/agents/{cluster}-agents.ts`
- Tests: `src/**/*.test.ts` (co-located)

## Deep Docs

See [AGENTS.md](../AGENTS.md) → links to `docs/agent-guide/` (10 files).
