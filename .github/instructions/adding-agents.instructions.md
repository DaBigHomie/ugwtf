---
applyTo: "**/ugwtf/src/agents/**"
---

# Adding Agents — Quick Reference

## Agent Interface (src/types.ts)

```ts
interface Agent {
  id: string;           // kebab-case, unique across project
  name: string;         // Human-readable
  description: string;  // One sentence
  clusterId: string;    // Must match an existing Cluster.id
  shouldRun(ctx: AgentContext): boolean;
  execute(ctx: AgentContext): Promise<AgentResult>;
}
```

## Steps

1. Create or edit `src/agents/{cluster}-agents.ts`
2. Export agent(s) as named constants implementing `Agent`
3. Register in `src/clusters/index.ts` → add to the matching cluster's `agents[]`
4. Run `npx tsc --noEmit && npx vitest run` to validate

## Scaffold Command

```bash
npx tsx src/index.ts new-agent <agent-id> --cluster <cluster-id>
```

Generates boilerplate file + wires into cluster registry.
