# @dabighomie/ugwtf

**Unified GitHub Workflow & Task Framework** — deploy standardized CI/CD, Copilot automation, and quality gates across all DaBigHomie repos.

## Overview

UGWTF orchestrates **~85 agents** across **34 clusters** to manage labels, issues, PRs, workflows, audits, and domain-specific scans for a multi-repo portfolio. Each agent is a self-contained unit with `shouldRun()` and `execute()` methods, coordinated by a swarm executor.

## Quick Start

```bash
# Install dependencies
npm install

# Run a command (dev mode)
npx tsx src/index.ts <command> [repos...] [flags]

# Examples
npx tsx src/index.ts labels damieus          # Sync labels for damieus
npx tsx src/index.ts deploy 043 ffs          # Deploy labels + workflows
npx tsx src/index.ts audit --verbose         # Audit all repos
npx tsx src/index.ts scan maximus --dry-run  # Full scan, preview only
```

## Commands

| Command | Clusters | Purpose |
|---------|----------|---------|
| `deploy` | labels, workflows | Sync labels + deploy CI/CD workflow YAML |
| `validate` | quality | Run quality gates (tsc, lint, build, config) |
| `fix` | labels, workflows, quality | Auto-fix labels + workflows + quality issues |
| `labels` | labels | Sync universal + repo-specific labels |
| `issues` | issues | Detect stalled issues, assign Copilot, auto-triage |
| `prs` | prs | Review Copilot PRs, enforce DB migration firewall |
| `audit` | audit, visual-audit | Full audit with scoreboard generation |
| `status` | audit | Quick health snapshot |
| `prompts` | prompts | Manage prompt files |
| `chain` | chain | Run prompt chain workflows |
| `security` | security | Security vulnerability scan |
| `performance` | performance | Performance audit |
| `a11y` | a11y | Accessibility audit |
| `seo` | seo | SEO optimization scan |
| `docs` | docs, context | Documentation sync + context analysis |
| `commerce` | commerce | E-commerce feature scan |
| `scenarios` | scenarios | Scenario-based testing |
| `design-system` | design-system | Design system audit |
| `supabase` | supabase-fsd | Supabase + FSD compliance |
| `gateway` | ai-gateway | AI gateway integration |
| `scan` | *(all 27 domain clusters)* | Comprehensive full scan |

## Flags

```
--dry-run        Preview changes without executing
--verbose, -v    Show debug output
--concurrency N  Max parallel repos (default: 3)
--cluster ID     Run specific cluster (repeatable)
```

## Registered Repos

| Alias | Repository |
|-------|-----------|
| `damieus` | DaBigHomie/damieus-com-migration |
| `ffs` | DaBigHomie/flipflops-sundays-reboot |
| `043` | DaBigHomie/one4three-co-next-app |
| `maximus` | DaBigHomie/maximus-ai |
| `cae` | DaBigHomie/cae-luxury-hair |

Omit repos to target all registered repos.

## Architecture

```
src/
├── index.ts              # CLI entry point + argument parser
├── orchestrator.ts        # Maps commands → clusters, runs swarm
├── types.ts               # All TypeScript interfaces
├── clients/
│   └── github.ts          # GitHub API client (Octokit wrapper)
├── config/
│   └── repo-registry.ts   # Repo definitions + universal labels
├── clusters/
│   └── index.ts           # 34 cluster definitions + dependency ordering
├── agents/                # ~85 agent implementations (35 files)
│   ├── label-agents.ts
│   ├── issue-agents.ts
│   ├── pr-agents.ts
│   ├── audit-agents.ts
│   └── ...
├── generators/            # Workflow YAML generators (7 files)
│   ├── ci-workflow.ts
│   ├── copilot-automation.ts
│   └── ...
├── integrations/
│   └── supabase.ts        # Supabase integration utilities
├── swarm/
│   └── executor.ts        # Fan-out executor (sequential/parallel)
└── utils/
    ├── fs.ts              # File I/O + YAML helpers
    └── logger.ts          # Structured logger with levels
```

## Agent Model

Every agent implements the `Agent` interface:

```typescript
interface Agent {
  id: string;          // Unique identifier (e.g., "label-sync")
  name: string;        // Display name
  description: string; // What the agent does
  clusterId: string;   // Parent cluster ID
  execute(ctx: AgentContext): Promise<AgentResult>;
  shouldRun(ctx: AgentContext): boolean;
}
```

Agents are grouped into **clusters**. The executor fans out across repos, running each cluster's agents in sequence per repo while optionally parallelizing across repos.

## Development

```bash
# Type check
npx tsc --noEmit

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Build
npm run build
```

## Testing

- **Framework**: Vitest
- **68 tests** across 7 test files
- **Coverage threshold**: 60% lines

```
src/utils/fs.test.ts             10 tests
src/utils/logger.test.ts          6 tests
src/config/repo-registry.test.ts 11 tests
src/clusters/clusters.test.ts    11 tests
src/orchestrator.test.ts          5 tests
src/index.test.ts                17 tests
src/swarm/executor.test.ts        8 tests
```

## License

Private — DaBigHomie
