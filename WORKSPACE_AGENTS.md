# Workspace Agent Catalog

**Generated**: April 7, 2026
**Source**: `Management/audit-results.json`
**Managed by**: UGWTF workspace-gap-remediation Phase 2

---

## Summary

| Metric | Count |
|--------|-------|
| Total Agents | 95 |
| Universal Agents (5+ repos) | 77 |
| Repo-Specific Agents | 18 |
| Instruction Files | 45 |
| Monitored Repositories | 48 |

---

## Universal Agents (77)

> Applicable to all repositories. Source: `.github/agents/` in gold-standard repos.

### Auditing

| Agent | Deployed In (count) |
|-------|---------------------|
| `a11y-gap` | 8 repos |
| `bundle-auditor` | 8 repos |
| `deep-dive-audit` | 9 repos |
| `doc-generator` | 5 repos |
| `docs-gap` | 8 repos |
| `domain-auditor` | 5 repos |
| `env-auditor` | 8 repos |
| `feature-gap` | 8 repos |
| `fsd-auditor` | 8 repos |
| `fsd-validator` | 5 repos |
| `seo-auditor` | 8 repos |

### Code Intelligence

| Agent | Deployed In (count) |
|-------|---------------------|
| `api-deep-dive` | 8 repos |
| `codebase-explorer` | 8 repos |
| `config-inspector` | 8 repos |
| `dependency-auditor` | 5 repos |
| `dependency-tracker` | 8 repos |
| `hook-deep-dive` | 8 repos |
| `migration-guard` | 5 repos |
| `migration-tracker` | 8 repos |
| `route-deep-dive` | 8 repos |
| `secret-scanner` | 5 repos |
| `stack-analyzer` | 8 repos |
| `state-deep-dive` | 8 repos |
| `supabase-auditor` | 8 repos |

### Core Workflow

| Agent | Deployed In (count) |
|-------|---------------------|
| `agent-creator` | 9 repos |
| `agent-instructions` | 9 repos |
| `branch-guard` | 9 repos |
| `code-review` | 10 repos |
| `deploy-gate` | 9 repos |
| `image-gen` | 9 repos |
| `prompt-creator` | 9 repos |
| `prompt-fixer` | 9 repos |
| `prompt-validator` | 9 repos |
| `session-cleanup` | 9 repos |

### Design System

| Agent | Deployed In (count) |
|-------|---------------------|
| `design-system-a11y` | 5 repos |
| `design-system-animation` | 5 repos |
| `design-system-asset-pipeline` | 5 repos |
| `design-system-color-system` | 5 repos |
| `design-system-component-patterns` | 5 repos |
| `design-system-consistency` | 5 repos |
| `design-system-dark-mode` | 5 repos |
| `design-system-inventory` | 5 repos |
| `design-system-migration` | 5 repos |
| `design-system-orchestrator` | 5 repos |
| `design-system-perf` | 5 repos |
| `design-system-responsive` | 5 repos |
| `design-system-spacing` | 5 repos |
| `design-system-token-auditor` | 5 repos |
| `design-system-typography` | 5 repos |

### Ecommerce

| Agent | Deployed In (count) |
|-------|---------------------|
| `checkout-auditor` | 8 repos |
| `conversion-optimizer` | 8 repos |
| `ecommerce-auditor` | 8 repos |
| `product-catalog` | 8 repos |

### Repo Management

| Agent | Deployed In (count) |
|-------|---------------------|
| `convention-drift` | 8 repos |
| `repo-comparator` | 8 repos |
| `repo-query` | 8 repos |
| `vercel-doctor` | 9 repos |
| `workflow-auditor` | 8 repos |
| `workflow-debugger` | 5 repos |
| `workflow-linter` | 5 repos |

### Testing

| Agent | Deployed In (count) |
|-------|---------------------|
| `playwright-fixer` | 9 repos |
| `playwright-orchestrator` | 9 repos |
| `playwright-runner` | 9 repos |
| `regression-detector` | 5 repos |
| `test-gap` | 8 repos |

### UGWTF Pipeline

| Agent | Deployed In (count) |
|-------|---------------------|
| `chain-builder` | 5 repos |
| `chain-doctor` | 5 repos |
| `conflict-resolver` | 5 repos |
| `copilot-debugger` | 5 repos |
| `issue-triage` | 5 repos |
| `label-auditor` | 5 repos |
| `metrics-reporter` | 5 repos |
| `pipeline-orchestrator` | 5 repos |
| `pr-surgeon` | 5 repos |
| `repo-sync` | 5 repos |
| `ugwtf-mastery` | 8 repos |
| `ugwtf-review` | 9 repos |

---

## Repo-Specific Agents (18)

| Agent | Repos | Count |
|-------|-------|-------|
| `ds-a11y` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-animation` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-asset-pipeline` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-color-system` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-component-patterns` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-consistency` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-dark-mode` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-inventory` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-migration` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-orchestrator` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-perf` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-responsive` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-spacing` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-token-auditor` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `ds-typography` | damieus-com-migration, flipflops-sundays-reboot, maximus-ai | 3 |
| `animation-lifecycle-handler` | one4three-co-next-app | 1 |
| `dom-sleuth` | one4three-co-next-app | 1 |
| `ticker-optimizer` | one4three-co-next-app | 1 |

---

## Instruction Files (45)

| Instruction File | Deployed In (count) |
|-----------------|---------------------|
| `commit-quality` | 9 repos |
| `core-directives` | 8 repos |
| `pr-review` | 8 repos |
| `typescript` | 8 repos |
| `ugwtf-workflow` | 8 repos |
| `workflow-syntax` | 7 repos |
| `chain-instructions.md` | 6 repos |
| `ci-instructions.md` | 6 repos |
| `fsd-architecture` | 6 repos |
| `testing-instructions.md` | 6 repos |
| `animations` | 5 repos |
| `app-router` | 5 repos |
| `cards-grids` | 5 repos |
| `design-system` | 5 repos |
| `doc-standards` | 5 repos |
| `hydration-safety` | 5 repos |
| `image-import` | 5 repos |
| `regression-prevention` | 5 repos |
| `tailwind` | 5 repos |
| `test-30x` | 5 repos |
| `vercel` | 5 repos |
| `script-automation` | 3 repos |
| `supabase` | 3 repos |
| `github-workflows` | 2 repos |
| `stripe` | 2 repos |
| `agent-authoring` | 1 repos |
| `image-gen` | 1 repos |
| `safety-guardrails` | 1 repos |
| `COPILOT_HANDOFF_INSTRUCTIONS.md` | 1 repos |
| `cart-system` | 1 repos |
| `checkout-payment` | 1 repos |
| `github-labels` | 1 repos |
| `imports-instructions.md` | 1 repos |
| `page-creation` | 1 repos |
| `sales-funnel` | 1 repos |
| `templates` | 1 repos |
| `checkout` | 1 repos |
| `agent-execution` | 1 repos |
| `knowledge-architecture` | 1 repos |
| `sovereign-enforcement` | 1 repos |
| `stripe-payments` | 1 repos |
| `adding-agents` | 1 repos |
| `adding-repos` | 1 repos |
| `architecture` | 1 repos |
| `prompt-instructions.md` | 1 repos |

---

## Registered Repositories (Post Phase 3)

| Alias | Slug | Framework |
|-------|------|-----------|
| `damieus` | `DaBigHomie/damieus-com-migration` | vite-react |
| `ffs` | `DaBigHomie/flipflops-sundays-reboot` | vite-react |
| `043` | `DaBigHomie/one4three-co-next-app` | nextjs |
| `maximus` | `DaBigHomie/maximus-ai` | nextjs |
| `cae` | `DaBigHomie/Cae` | vite-react |
| `ugwtf` | `DaBigHomie/ugwtf` | node |
| `agent-mastery` | `DaBigHomie/agent-mastery` | node |
| `atl` | `DaBigHomie/atl-table-booking-app` | node |
| `tequila-week` | `DaBigHomie/atl-tequila-week` | vite-react |
| `audit-orch` | `DaBigHomie/audit-orchestrator` | node |
| `chat-exporter` | `DaBigHomie/copilot-chat-exporter` | node |
| `docs-standards` | `DaBigHomie/documentation-standards` | node |
| `haven` | `DaBigHomie/haven-event-siteplan` | vite-react |
| `image-gen` | `DaBigHomie/image-gen-30x-cli` | node |
| `jay-anthony` | `DaBigHomie/jay-anthony-app` | vite-react |
| `management` | `DaBigHomie/Management` | node |
| `oros` | `DaBigHomie/oros-core` | nextjs |
| `product-gen` | `DaBigHomie/product-generator` | vite-react |
| `tequila-festival` | `DaBigHomie/tequila-sunrise-festival-atl` | vite-react |
| `unique-collab` | `DaBigHomie/unique-collab` | vite-react |
| `workflow-agents` | `DaBigHomie/damieus_workflow_analysis` | node |
