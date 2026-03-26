# UGWTF — Copilot Approval Pipeline

Deployed as 6 GitHub Actions workflows to target repos.

## Pipeline Overview

```
Issue labeled → Phase 1 → ... → Phase 8
                 ↓ fail
              Phase 7 (re-assign, self-heal)
```

## Phases

| Phase | Workflow | Trigger | Action |
|-------|---------|---------|--------|
| 1 | `copilot-assign.yml` | `repository_dispatch: chain-next` | Remove Copilot variants → assign `copilot-swe-agent[bot]` |
| 2 | `copilot-pr-promote.yml` | PR opened/synchronize | Draft → ready via `gh pr ready` → request Copilot review |
| 3 | `copilot-pr-validate.yml` | PR opened/synced | `npx tsc --noEmit` + `npm run lint` + `npm run build` |
| 3.5 | `copilot-pr-validate.yml` | After Phase 3 pass | `npx playwright test` — non-blocking (advisory only) |
| 4 | `copilot-pr-review.yml` | Copilot review posted | Re-assign Copilot → re-trigger Phase 3 |
| 5 | `copilot-pr-validate.yml` | All checks pass | Auto-approve + squash merge (blocked for DB migration PRs) |
| 6 | `copilot-pr-validate.yml` | `.sql` or `supabase/migrations/` detected | Block auto-merge → post manual steps |
| 7 | `copilot-pr-validate.yml` | Any phase fails | Re-assign Copilot → self-healing retry |
| 8 | `copilot-pr-merged.yml` | PR merged | Close issues → dispatch `chain-next` |
| 9 | `copilot-chain-advance.yml` | Issue closed | Advance chain to next entry |

## Copilot Assignment Details

- Assignee: `copilot-swe-agent[bot]` (NOT `copilot`)
- Requires `agent_assignment` payload with `target_repo` + `base_branch`
- GHA's `GITHUB_TOKEN` cannot start Copilot coding sessions
- Chain-advancer calls `assignCopilot()` directly with user PAT
- Must remove ALL variants before re-adding (idempotent)

## PR Promotion

- Copilot creates branch + commits before opening PR — only `opened` event fires
- `gh pr ready <number>` promotes draft → ready (GraphQL returns FORBIDDEN with GHA token)
- Review request: `reviewers: ['copilot']` works — shows as `Copilot` (Bot) in UI

## DB Migration Firewall (Phase 6)

When a PR touches migration files, Phase 5 auto-merge is blocked:

1. Apply migration SQL via Supabase Dashboard
2. Regenerate types: `npx supabase gen types typescript --project-id <ID> > <types-path>`
3. Deploy Edge Functions if needed
4. Run quality gates: `npx tsc --noEmit && npm run lint && npm run build`
5. Merge manually after verification

## Chain Labels

| Label | Purpose |
|-------|---------|
| `chain-tracker` | Identifies chain issues |
| `agent:copilot` | Marks for Copilot assignment |
| `automation:in-progress` | Added when Copilot assigned |
| `prompt-spec` | Links to spec issue |

## Deploying

```bash
# Deploy all 6 workflows to a repo
node dist/index.js deploy <alias>
```
