---
applyTo: ".github/agents/**/*.agent.md,.github/prompts/**/*.prompt.md"
---

# Agent & Prompt Authoring Standards

## Agent File Format (.agent.md)

```yaml
---
description: "Action-oriented. Use when: trigger1, trigger2, trigger3."
tools: [minimal, required, tools]
---
```

### Required Sections
1. **Opening paragraph** — "You are the **{Name}** agent."
2. **Your Role** — 3-5 bullet points defining scope
3. **Workflow** — Numbered steps with bash snippets
4. **Output Format** — Structured template (tables, checklists)
5. **Critical Rules** — Numbered constraints, safety boundaries
6. **Agent Cross-References** — Links to related agents

### Rules
- Tools list must be minimal (≤5 tools per agent)
- Include "Use when:" triggers in description
- Define what the agent NEVER does
- All bash commands use `--no-pager` for git
- Include repo context table when multi-repo

## Prompt File Format (.prompt.md)

```yaml
---
description: "What this shortcut does"
argument-hint: "What user provides"
---
```

### Rules
- Link to the agent it invokes via `@agent-name`
- Include step-by-step workflow
- Reference related agents and docs

## Sync Requirement

All agents/prompts are authored in `Management/.github/` and synced to
workspace root via `npx tsx scripts/sync-to-workspace.mts`. Never edit
the workspace root copies directly.
