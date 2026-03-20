# UGWTF — Architecture

## Directory Layout

```
ugwtf/
├── src/
│   ├── index.ts              # CLI entry — parseArgs, command dispatch
│   ├── types.ts              # Core types (Agent, AgentContext, AgentResult, etc.)
│   ├── orchestrator.ts       # Swarm orchestration + extras/noCache passthrough
│   │
│   ├── agents/               # 34 agent files (~85 agents total)
│   │   ├── prompt-agents.ts  # Prompt scanner/validator/forecaster (12-point scoring)
│   │   ├── chain-agents.ts   # generate-chain pipeline
│   │   ├── issue-agents.ts   # Stalled detection, Copilot assign, auto-triage
│   │   ├── pr-agents.ts      # PR review, DB migration firewall
│   │   ├── label-agents.ts   # Label sync
│   │   ├── audit-agents.ts   # Health audit + scoreboard
│   │   ├── fix-agents.ts     # Auto-fix pipeline
│   │   └── ... (27 more)     # Domain-specific agents
│   │
│   ├── clusters/
│   │   └── index.ts          # Cluster registry — maps cluster IDs to agent arrays
│   │
│   ├── commands/
│   │   ├── run-agent.ts      # execute(cmd, repos, flags) — main dispatcher
│   │   └── list.ts           # list agents/clusters
│   │
│   ├── config/
│   │   ├── repo-registry.ts  # 5+ repos with owner/name/path/supabaseId
│   │   ├── repo-config-loader.ts  # Per-repo .ugwtfrc loading
│   │   └── rc-loader.ts      # RC file parser
│   │
│   ├── clients/
│   │   └── github.ts         # Octokit wrapper (getRepo → owner/name/octokit)
│   │
│   ├── generators/           # 7 YAML/config generators
│   │   ├── ci-workflow.ts
│   │   ├── copilot-automation.ts  # 8-phase approval pipeline
│   │   ├── prompt-chain-workflow.ts
│   │   ├── dependabot-auto-merge.ts
│   │   ├── security-audit.ts
│   │   ├── supabase-migration.ts
│   │   └── visual-audit.ts
│   │
│   ├── output/               # Post-validation reporting
│   │   ├── scoreboard.ts     # Health score rollup (0-100%)
│   │   ├── persist.ts        # Write AUDIT-RESULTS.json
│   │   ├── json-reporter.ts
│   │   ├── markdown-reporter.ts
│   │   └── findings-formatter.ts
│   │
│   ├── integrations/
│   │   └── supabase.ts       # Supabase migration helpers
│   │
│   ├── scaffold/
│   │   ├── new-agent.ts      # Generate new agent boilerplate
│   │   └── new-repo.ts       # Register new repo
│   │
│   ├── swarm/
│   │   └── executor.ts       # Parallel agent execution with concurrency
│   │
│   ├── watch/
│   │   ├── watcher.ts        # File watcher for dev mode
│   │   └── cache.ts          # Watch cache
│   │
│   ├── plugins/
│   │   └── loader.ts         # Plugin loader (extensibility)
│   │
│   └── utils/
│       ├── common.ts         # Shared helpers
│       ├── logger.ts         # Structured logging
│       ├── fs.ts             # File system utilities
│       └── env.ts            # Environment variable access
│
├── scripts/                  # 11 standalone automation scripts
├── tests/fixtures/           # Test fixtures (prompt files)
├── docs/                     # Documentation
│   ├── agent-guide/          # ← YOU ARE HERE
│   └── archive/              # Legacy docs
└── dist/                     # Compiled output
```

## Data Flow

```
CLI (index.ts)
  → parseArgs() → command, repos[], flags
  → run-agent.ts → resolve repos from registry
  → orchestrator.ts → filter clusters → swarm executor
  → executor.ts → run agents (parallel, concurrency-limited)
  → each agent: shouldRun() → execute(ctx) → AgentResult
  → output/ → scoreboard + persist + reporters
```

## Core Types

```typescript
interface Agent {
  id: string;
  clusterId: string;
  name: string;
  description: string;
  shouldRun(ctx: AgentContext): boolean;
  execute(ctx: AgentContext): Promise<AgentResult>;
}

interface AgentContext {
  repoAlias: string;
  repoSlug: string;
  github: Octokit;
  localPath: string;
  dryRun: boolean;
  logger: Logger;
  extras: Record<string, string>;
}

interface AgentResult {
  agentId: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  findings?: Finding[];
  data?: unknown;
}
```
