# Agent Mastery — Quick Start

This repo participates in the **@dabighomie/agent-mastery** framework.

## Agent Discovery

VS Code custom agents are discovered from `.github/agents/*.agent.md` in the workspace root.

## Quality Scoring

All `.agent.md` files are validated against an 18-point rubric:
- Deploy threshold: **≥15/18**
- Scoring engine: `@dabighomie/agent-mastery` (UGWTF plugin)

## Lifecycle States

| State | Meaning |
|-------|---------|
| `discovery` | Concept phase, not yet scaffolded |
| `authoring` | Being written / refined |
| `validation` | Scored, awaiting threshold pass |
| `deployed` | In production, synced to workspace |
| `deprecated` | Marked for removal |

## Naming Convention

See `Management/docs/NAMING_CONVENTION.md` for full spec.

- Agent files: `{domain}-{function}.agent.md`
- Agent IDs: `{3-LETTER-CODE}-{NNN}` (e.g., `SCO-001`)
- Domain codes: 3 uppercase letters per functional domain

## Commands

```bash
# From agent-mastery dir
npx tsx -e 'import { scan } from "./src/plugin.ts"; console.log(scan("./.github"));'
```
