---
applyTo: "**/ugwtf/src/**"
---

# UGWTF Architecture — Agent Reference

## Data Flow

```
CLI → parseArgs() → OrchestratorOptions → orchestrate()
  → COMMAND_CLUSTER_MAP[command] → cluster IDs
  → executeSwarm() → topological sort → execution waves
  → runCluster() → runAgent() per agent
  → SwarmResult → reporters + scoreboard
```

## Key Types (src/types.ts)

- `Agent { id, name, clusterId, shouldRun(ctx), execute(ctx) }` — atomic unit
- `Cluster { id, name, agents[], dependsOn[] }` — group of agents, DAG edges
- `SwarmConfig { mode, concurrency, repos[], clusters[], dryRun }` — execution plan
- `SwarmResult { results: RepoSwarmResult[], summary }` — output
- `AgentContext { repoAlias, repoSlug, github, localPath, dryRun, logger }` — runtime context

## Import Direction (one-way only)

```
index.ts → orchestrator.ts → swarm/executor.ts → clusters/index.ts → agents/*
                                                                     ↓
                                                              config/repo-registry.ts
All modules may import: types.ts, utils/*, clients/*
```

## Naming Conventions

- Agent IDs: `kebab-case` (e.g. `label-sync`, `fix-workflow-drift`)
- Cluster IDs: `kebab-case` (e.g. `labels`, `supabase-fsd`)
- Agent files: `src/agents/{cluster}-agents.ts`
- Repo aliases: short lowercase (e.g. `damieus`, `ffs`, `043`)

## Execution Modes

- `sequential` — one repo at a time
- `parallel` — all repos concurrently (up to `concurrency`)
- `fan-out` — all repos × clusters concurrently
