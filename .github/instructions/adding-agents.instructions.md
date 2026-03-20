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

## Chain & Repeatable-Flow Requirements

When an agent touches chain, prompt-generation, publish, or verification flows:

1. Prefer script-first execution (`scripts/*.mts`) over manual file-by-file orchestration.
2. Use generic `chain:folder:verify` / `chain:folder:run` for any repo — pass repo and path via `--`.
3. Use `dogfood:*` scripts only for the self-publish chain (hardcoded to ugwtf).
4. Implement dry-run support for any state-changing path.
5. Add/maintain tests for parsing, dependency resolution, and command wiring.
6. Keep changes additive and backward compatible (do not break existing `tsx scripts/*.mts` usage).
