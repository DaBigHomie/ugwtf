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
├── config/repo-registry.ts# 10 registered repos
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
| `atb` | DaBigHomie/atl-table-booking-app |
| `ugwtf` | DaBigHomie/ugwtf |
| `image-gen` | DaBigHomie/image-gen-30x-cli |
| `audit-fix-ship` | DaBigHomie/audit-fix-ship |
| `docs-standards` | DaBigHomie/documentation-standards |

## Conventions

- Agent IDs: `kebab-case`
- Cluster IDs: `kebab-case`
- Tests co-located: `src/**/*.test.ts`
- Portable paths only — NEVER `/Users/dame/...`

## Deep Docs

See [AGENTS.md](AGENTS.md) → links to `docs/agent-guide/` (10 files).

<!-- BEGIN: orchestration-standards-enforcer (source: documentation-standards/skills/orchestration-standards-enforcer/SKILL.md) -->
## Orchestration Standards (MALFIG-aligned)

- **4-gate stack, in order:** `forecast-scrutiny` → `MALFIG` (G1-G14) → `forensic-auditing` (Rules 1-5) → `doc-forensic-inventory`. Bounded fix loop of 1 iteration per gate. Merge only on all-gates-PASS.
- **Fresh worktrees only.** No git checkout / reset / rm on shared trees. Cut a worktree per PR from `origin/main` (or `origin/master`). Peer prior-art (each verified MERGED via `gh pr view`, repo-prefixed to disambiguate): `maximus-ai #196`, `maximus-ai #197`, `maximus-ai #198`, `maximus-ai #199`, `maximus-ai #200`, `maximus-ai #201`, `maximus-ai #202`, `docstd #64`, `polaris #14`.
- **Verify-then-write.** Every SHA, PR, path, task_id, or CLI shape cited MUST be verified against real state (`gh pr view`, `git show origin/<branch>:<path>`, `test -f`, `which <bin>`, `--help` probe). Reject unverified subagent claims before durable writes.
- **No fabrication.** Unknown CLI shapes, model IDs, capability profiles, or invocation APIs are marked `UNKNOWN — research required` and filed as follow-up tasks. Never invent flags, headers, or paths.

Source: `documentation-standards/skills/orchestration-standards-enforcer/SKILL.md` — do not edit this block in place; run the enforcer script to update.
<!-- END: orchestration-standards-enforcer -->
