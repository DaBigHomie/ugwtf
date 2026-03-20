# UGWTF — Agent Catalog

**Total**: 86 agents across 34 clusters

## Cluster Summary

| Cluster | Agents | File | Purpose |
|---------|--------|------|---------|
| `a11y` | 2 | a11y-agents.ts | Accessibility compliance checks |
| `ai-gateway` | 4 | ai-gateway-agents.ts | AI/LLM gateway integration |
| `analytics` | 2 | analytics-agents.ts | Analytics tracking validation |
| `animation` | 2 | animation-agents.ts | Animation/motion compliance |
| `audit` | 2 | audit-agents.ts | Health audit + scoreboard generation |
| `auth` | 2 | auth-agents.ts | Authentication flow checks |
| `chain` | 3 | chain-agents.ts | Prompt chain pipeline |
| `commerce` | 2 | commerce-agents.ts | E-commerce feature checks |
| `content` | 2 | content-agents.ts | Content/CMS validation |
| `context` | 2 | context-agents.ts | Context window management |
| `database` | 2 | database-agents.ts | Database schema checks |
| `design` | 2 | design-agents.ts | Design system compliance |
| `design-system` | 4 | design-system-v2-agents.ts | Design system v2 rules |
| `devops` | 3 | devops-agents.ts | CI/CD pipeline checks |
| `docs` | 3 | docs-agents.ts | Documentation quality |
| `email` | 3 | email-agents.ts | Email template validation |
| `fix` | 4 | fix-agents.ts | Auto-fix pipeline (labels, workflows, quality) |
| `fsd` | 2 | fsd-agents.ts | Feature-Sliced Design compliance |
| `generate-chain` | 1 | chain-agents.ts | `generate-chain` CLI command agent |
| `integration` | 2 | integration-agents.ts | Third-party integration checks |
| `issues` | 3 | issue-agents.ts | Stalled detection, Copilot assign, auto-triage |
| `labels` | 2 | label-agents.ts | Label sync to GitHub |
| `migration` | 2 | migration-agents.ts | Database migration safety |
| `monitoring` | 2 | monitoring-agents.ts | Runtime monitoring checks |
| `performance` | 2 | performance-agents.ts | Performance/bundle analysis |
| `prompts` | 4 | prompt-agents.ts | 18-point prompt validation + forecasting |
| `prs` | 3 | pr-agents.ts | PR review, DB migration firewall, stale drafts |
| `quality` | 4 | quality-agents.ts | Quality gate enforcement |
| `routing` | 2 | routing-agents.ts | Route validation |
| `scenarios` | 3 | scenario-agents.ts | Scenario/flow testing |
| `security` | 2 | security-agents.ts | Security vulnerability scanning |
| `seo` | 2 | seo-agents.ts | SEO metadata validation |
| `sovereign` | 2 | sovereign-agents.ts | Sovereign orchestrator rules |
| `state` | 2 | state-agents.ts | State management patterns |
| `supabase-fsd` | 5 | supabase-fsd-agents.ts | Supabase + FSD integration checks |
| `workflows` | 2 | workflow-agents.ts | GitHub Actions workflow validation |

## Key Agent Groups

### Prompt Pipeline (`prompt-agents.ts`)
- `prompt-scanner` — Discovers all `.prompt.md` files in repo
- `prompt-validator` — Scores each prompt against 18-point gold standard (FAILS if avg < 80%)
- `prompt-issue-creator` — Creates GitHub issues for low-scoring prompts
- `prompt-forecaster` — Calculates 30x execution readiness score

### Issue Management (`issue-agents.ts`)
- `stalled-issue-detector` — Finds `automation:in-progress` idle >48h → labels `stalled`
- `issue-copilot-assign` — Assigns Copilot to `agent:copilot` issues
- `issue-auto-triage` — Labels unlabeled issues by keyword matching

### PR Pipeline (`pr-agents.ts`)
- `pr-copilot-reviewer` — Reviews Copilot PRs for quality
- `pr-db-migration-firewall` — Blocks auto-merge on `.sql`/migration changes
- `pr-stale-draft-detector` — Flags abandoned draft PRs

### Chain Generator (`chain-agents.ts`)
- `chain-generator` — Builds execution order from Format B prompts
- Plus supporting chain agents

### Fix Pipeline (`fix-agents.ts`)
- `fix-labels` — Sync missing labels
- `fix-workflows` — Deploy missing CI/CD files
- `fix-quality` — Auto-fix quality issues
- `fix-all` — Orchestrate all fixes
