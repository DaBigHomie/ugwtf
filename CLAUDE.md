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

## Commands

### Core Pipeline

| Command | Clusters | Purpose |
|---------|----------|---------|
| `deploy` | labels, workflows | Sync labels + deploy CI/CD workflows |
| `validate` | quality | Run quality gates (tsc, lint, build, config) |
| `fix` | labels, workflows, quality, fix | Auto-fix labels + workflows + quality issues |
| `labels` | labels | Sync universal + repo-specific labels |
| `issues` | issues | Triage, assign Copilot, detect stalled |
| `prs` | prs | Review Copilot PRs, DB migration firewall |
| `audit` | audit, visual-audit | Full audit with scoreboard |
| `status` | audit | Quick health snapshot |
| `prompts` | prompts | Scan/validate/forecast `.prompt.md` files |
| `chain` | chain | Manage prompt-chain lifecycle (load, create issues, advance) |
| `generate-chain` | generate-chain | Scan prompts → toposort → wave assignment |

### Domain Scans

| Command | Clusters | Purpose |
|---------|----------|---------|
| `security` | security | Vulnerability scan + secret leak detection |
| `performance` | performance | Bundle size + heavy dependency detection |
| `a11y` | a11y | Accessibility validation (WCAG) |
| `seo` | seo | Meta tags, sitemaps, optimization |
| `docs` | docs, context | Documentation coverage + context analysis |
| `commerce` | commerce | E-commerce feature validation |
| `scenarios` | scenarios | User flow discovery + acceptance criteria |
| `design-system` | design-system | Design tokens, component contracts, responsive audit |
| `supabase` | supabase-fsd | Supabase + FSD architecture compliance |
| `gateway` | ai-gateway | AI gateway integration + prompt validation |
| `scan` | *(all 27 domain clusters)* | Comprehensive full scan — runs everything |

### Scaffold Commands

| Command | Usage | Purpose |
|---------|-------|---------|
| `new-agent` | `ugwtf new-agent <id> --cluster <cid>` | Generate agent boilerplate + register |
| `new-repo` | `ugwtf new-repo <alias> --slug O/R --framework fw` | Generate repo config entry |

### Utility Commands

| Command | Usage | Purpose |
|---------|-------|---------|
| `list` | `ugwtf list [clusters\|agents\|repos]` | Show all clusters/agents/repos |
| `run` | `ugwtf run <agent-id> [repos...] [flags]` | Execute single agent (debugging) |
| `watch` | `ugwtf watch [repos...] --command <CMD>` | Watch for file changes, re-run |

## Global Flags

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `--dry-run` | boolean | false | Preview without executing |
| `--verbose`, `-v` | boolean | false | Debug output |
| `--concurrency <N>` | number | 3 | Max parallel repos |
| `--cluster <ID>` | string | — | Run specific cluster (repeatable) |
| `--output <FMT>` | enum | summary | Output: `json`, `markdown`, `summary` |
| `--path <PATH>` | string | — | Path to folder or prompt file |
| `--max-copilot-concurrency <N>` | number | — | Max simultaneous Copilot issues |
| `--sequential-copilot` | boolean | false | Alias for `--max-copilot-concurrency 1` |
| `--no-cache` | boolean | false | Skip repo cache, force full run |
| `--help`, `-h` | boolean | false | Show help |

## Registered Repos

| Alias | Slug | Framework |
|-------|------|-----------|
| `damieus` | DaBigHomie/damieus-com-migration | vite-react |
| `ffs` | DaBigHomie/flipflops-sundays-reboot | vite-react |
| `043` | DaBigHomie/one4three-co-next-app | nextjs |
| `maximus` | DaBigHomie/maximus-ai | nextjs |
| `cae` | DaBigHomie/Cae | vite-react |
| `ugwtf` | DaBigHomie/ugwtf | node |

## Conventions

- Agent IDs: `kebab-case` (e.g. `chain-generator`)
- Cluster IDs: `kebab-case` (e.g. `generate-chain`)
- Tests co-located: `src/**/*.test.ts`
- Portable paths only — NEVER `/Users/dame/...`
- No `git reset` — use `git rm --cached` instead

## Deep Docs

See [AGENTS.md](AGENTS.md) → links to `docs/agent-guide/` (10 files covering architecture, all 86 agents, CLI reference, testing, scoring, gaps).
