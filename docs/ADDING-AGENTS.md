# Adding Agents to UGWTF

This guide explains how to create and register new agents — either directly inside UGWTF or as an external plugin package.

---

## 1. Understanding the Agent Model

Every agent implements the `Agent` interface:

```typescript
import type { Agent, AgentContext, AgentResult } from '@dabighomie/ugwtf/types';

const myAgent: Agent = {
  id: 'my-cluster/my-action',        // Unique — use "clusterId/action" format
  name: 'My Action Agent',
  description: 'What this agent does',
  clusterId: 'my-cluster',           // Must match the parent Cluster.id

  shouldRun(ctx: AgentContext): boolean {
    // Return false to skip this agent for a given repo/context
    return ctx.repo.startsWith('damieus');
  },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    // Do work here. Return a result.
    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repo,
      duration: 0,
      message: 'Done',
      artifacts: [],
    };
  },
};
```

### AgentContext

The `ctx` object provided to both `shouldRun` and `execute`:

```typescript
interface AgentContext {
  repo: string;          // Repo alias (e.g., "damieus", "ffs")
  repoFullName: string;  // "DaBigHomie/damieus-com-migration"
  dryRun: boolean;       // If true, preview only — no writes
  verbose: boolean;
  github: GitHubClient;  // Octokit-backed REST client
  logger: Logger;
}
```

### AgentResult statuses

| Status | Meaning |
|--------|---------|
| `'success'` | Agent completed cleanly |
| `'failed'` | Agent encountered an error |
| `'skipped'` | Agent intentionally skipped (`shouldRun` returned false OR skip mid-execution) |

---

## 2. Defining a Cluster

Clusters group related agents and declare dependency ordering:

```typescript
import type { Cluster } from '@dabighomie/ugwtf/types';

const myCluster: Cluster = {
  id: 'my-cluster',
  name: 'My Cluster',
  description: 'What this cluster does',
  dependsOn: ['quality'],   // Runs after quality cluster completes
  agents: [myAgent],
};
```

`dependsOn` is used by `clusterExecutionOrder()` for topological sorting — the executor guarantees dependent clusters finish before this one starts.

---

## 3. Adding an Agent Directly to UGWTF

### Step 1 — Create the agent file

```
src/agents/my-cluster-agents.ts
```

```typescript
import type { Agent, AgentContext, AgentResult } from '../types.js';

export const myActionAgent: Agent = {
  id: 'my-cluster/my-action',
  name: 'My Action',
  description: 'Brief description',
  clusterId: 'my-cluster',
  shouldRun: (_ctx) => true,
  async execute(ctx): Promise<AgentResult> {
    ctx.logger.info(`Running my-action on ${ctx.repo}`);
    // ... do work ...
    return { agentId: this.id, status: 'success', repo: ctx.repo, duration: 0, message: 'Done', artifacts: [] };
  },
};
```

### Step 2 — Register in `src/clusters/index.ts`

```typescript
import { myActionAgent } from '../agents/my-cluster-agents.js';

const myCluster: Cluster = {
  id: 'my-cluster',
  name: 'My Cluster',
  description: '...',
  dependsOn: ['quality'],
  agents: [myActionAgent],
};

export const CLUSTERS: Cluster[] = [
  // ... existing clusters ...
  myCluster,
];
```

### Step 3 — Map to a CLI command in `src/orchestrator.ts`

```typescript
const COMMAND_CLUSTER_MAP: Record<string, string[]> = {
  // ... existing ...
  'my-command': ['my-cluster'],
};
```

### Step 4 — Write tests

```typescript
// src/agents/my-cluster-agents.test.ts
import { describe, it, expect, vi } from 'vitest';
import { myActionAgent } from './my-cluster-agents.js';
import type { AgentContext } from '../types.js';

const ctx = {
  repo: 'damieus',
  repoFullName: 'DaBigHomie/damieus-com-migration',
  dryRun: false,
  verbose: false,
  github: {} as AgentContext['github'],
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
} satisfies AgentContext;

describe('myActionAgent', () => {
  it('shouldRun returns true', () => {
    expect(myActionAgent.shouldRun(ctx)).toBe(true);
  });

  it('execute returns success', async () => {
    const result = await myActionAgent.execute(ctx);
    expect(result.status).toBe('success');
  });
});
```

---

## 4. Adding an Agent via Plugin Package

External plugins register clusters without modifying the ugwtf source. This is the preferred approach for domain-specific packages (e.g., `@dabighomie/audit-orchestrator`).

### Plugin interface

```typescript
import type { UGWTFPlugin, PluginRegistry } from '@dabighomie/ugwtf/types';
import { myCluster } from './cluster.js';

export const plugin: UGWTFPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  register(registry: PluginRegistry): void {
    registry.addCluster(myCluster);
    // Optionally:
    // registry.addAgent('existing-cluster', extraAgent);
    // registry.addCommand('my-command', ['my-cluster']);
  },
};
```

### Plugin discovery (auto-loading)

UGWTF's plugin loader (`src/plugins/loader.ts`) scans `node_modules/@ugwtf/*` for packages that declare `"ugwtf-plugin": true` in their `package.json`:

```json
{
  "name": "@ugwtf/my-plugin",
  "ugwtf-plugin": true,
  "exports": {
    ".": "./dist/index.js",
    "./plugin": "./dist/plugin.js"
  }
}
```

### Manual import (first-party packages)

For packages that live as `file:` dependencies (like `audit-orchestrator`), import the cluster directly in `src/clusters/index.ts`:

```typescript
import { visualAuditCluster } from '@dabighomie/audit-orchestrator/cluster';

export const CLUSTERS: Cluster[] = [
  // ... existing clusters ...
  { ...visualAuditCluster },
];
```

### Real-world example — audit-orchestrator

`@dabighomie/audit-orchestrator` registers the `visual-audit` cluster with 10 agents:

```typescript
// audit-orchestrator/src/ugwtf-plugin.ts
import type { UGWTFPlugin, PluginRegistry } from '@dabighomie/ugwtf/types';
import { visualAuditCluster } from './cluster.js';

export const plugin: UGWTFPlugin = {
  name: 'visual-audit',
  version: '1.1.0',
  register(registry: PluginRegistry): void {
    registry.addCluster(visualAuditCluster);
  },
};
```

The plugin exports its cluster via `@dabighomie/audit-orchestrator/plugin`, and UGWTF's `src/clusters/index.ts` imports `visualAuditCluster` directly.

---

## 5. Checklist for New Agents

- [ ] `id` is unique across all agents (use `"clusterId/action"` format)
- [ ] `clusterId` matches the parent cluster's `id`
- [ ] `shouldRun()` is pure — no side effects, no async
- [ ] `execute()` respects `ctx.dryRun` — no writes when true
- [ ] Returns a valid `AgentResult` with `agentId`, `status`, `repo`, `duration`
- [ ] Cluster registered in `CLUSTERS[]` (or plugin's `register()`)
- [ ] Tests written: `shouldRun` + `execute` cases
- [ ] `npx tsc --noEmit` passes (0 errors)
- [ ] `npx vitest run` passes

---

## 6. Related Docs

- [P4-IMPLEMENTATION-CHECKLIST.md](./P4-IMPLEMENTATION-CHECKLIST.md) — Roadmap and progress
- [Plugin Loader source](../src/plugins/loader.ts) — Auto-discovery logic
- [Types reference](../src/types.ts) — `Agent`, `Cluster`, `UGWTFPlugin`, `PluginRegistry`
- [audit-orchestrator plugin](../../audit-orchestrator/src/ugwtf-plugin.ts) — Reference implementation
