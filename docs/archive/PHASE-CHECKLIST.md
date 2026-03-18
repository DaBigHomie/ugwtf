# Phase Checklist — @dabighomie/audit-orchestrator

**Package**: `@dabighomie/audit-orchestrator`
**Created**: March 13, 2026
**Source**: Forecast Audit (6 forecasting agents)

---

## Version Roadmap

| Version | Phase | Scope | Status |
|---------|-------|-------|--------|
| **v1.0.0** | Phase 1 — Extract & Package | Standalone npx CLI, 10 audit rules, 2 framework adapters, 3 reporters | 🔄 In Progress |
| **v1.1.0** | Phase 2 — UGWTF Integration | 8th cluster in UGWTF, 30 prompt YAML updates, DAG wiring | ❌ Not Started |
| **v2.0.0** | Phase 3 — GitHub Actions + Multi-Repo | Workflow template, npm publish pipeline, auto-deploy via `ugwtf deploy` | ❌ Not Started |

---

## Phase 1: Extract & Package (v1.0.0)

**Goal**: A working `npx @dabighomie/audit-orchestrator` that scans any project directory.

### 1.1 Package Foundation

- [ ] Create `package.json` with `@dabighomie/audit-orchestrator` name
- [ ] Set `"bin": { "audit-orchestrator": "./dist/index.js" }`
- [ ] Set `"type": "module"`, `"engines": { "node": ">=18.3.0" }`
- [ ] Create `tsconfig.json` (ES2022, NodeNext, declaration, outDir dist/)
- [ ] Add `.gitignore` (node_modules, dist/)
- [ ] Add `LICENSE` (MIT)

### 1.2 CLI Entry Point

- [ ] Create `src/index.ts` with `parseArgs` from `node:util`
- [ ] Support flags: `--cwd <path>`, `--json`, `--markdown`, `--cluster <id>`, `--parallel-map`, `--verbose`
- [ ] Default `--cwd` to `process.cwd()` (fixes ROOT blocker — Risk R3)
- [ ] Add `#!/usr/bin/env node` shebang for npx compatibility
- [ ] Wire CLI to scanner → reporters pipeline

### 1.3 Scanner & Audit Rules

Source: Extract from `one4three-co-next-app/scripts/audit-orchestrator.mts`

- [ ] Create `src/scanner.ts` — core `findFiles()`, `fileContains()`, `countMatches()` utilities
- [ ] Create `src/types.ts` — `AuditIssue`, `AuditResult`, `PromptCluster`, `FrameworkConfig`
- [ ] Create `src/rules/index.ts` — rule registry and executor
- [ ] Extract 10 audit rules into `src/rules/`:
  - [ ] `dark-mode-contrast.ts` — CSS variable coverage, contrast ratios
  - [ ] `test-ids.ts` — data-testid coverage on interactive elements
  - [x] `accessibility.ts` — aria-labels, alt text, keyboard navigation
  - [x] `design-system.ts` — font/color token usage, hardcoded value detection
  - [x] `mobile-responsive.ts` — viewport meta, touch targets, breakpoint coverage
  - [x] `supabase-integration.ts` — RLS policies, type generation, client usage
  - [x] `checkout-flow.ts` — payment steps, error handling, Stripe integration
  - [x] `collections.ts` — dynamic routing, filter/sort, empty states
  - [x] `marquee.ts` — animation performance, reduced motion, content completeness
  - [x] `button-consistency.ts` — variant usage, hover/focus states, sizing (ENOTDIR bug fixed)

### 1.4 Framework Adapters

Fixes Risk R4 (framework-specific paths)

- [x] Create `src/adapters/index.ts` — `FrameworkAdapter` interface + auto-detect
- [x] Create `src/adapters/nextjs.ts` — paths for App Router projects (043, maximus)
- [x] Create `src/adapters/vite-react.ts` — paths for Vite projects (ffs, damieus)
- [x] Auto-detect framework from `package.json` dependencies

### 1.5 Reporters

- [x] Create `src/reporters/index.ts` — reporter interface
- [x] Create `src/reporters/terminal.ts` — colored console output with severity icons
- [x] Create `src/reporters/json.ts` — structured JSON output for CI/CD piping
- [x] Create `src/reporters/markdown.ts` — `.md` report file generation

### 1.6 Build & Verify

- [x] `npm run build` compiles to `dist/`
- [x] `node dist/index.js --help` works
- [x] `node dist/index.js --cwd ../one4three-co-next-app` produces audit output (42%, 32 issues)
- [x] `node dist/index.js --cwd ../one4three-co-next-app --json` produces valid JSON
- [x] `node dist/index.js --cwd ../damieus-com-migration` works (vite-react, 27%)
- [x] All TypeScript: 0 errors (`npx tsc --noEmit`)

---

## Phase 2: UGWTF Integration (v1.1.0)

**Goal**: `npx tsx src/index.ts audit 043 --cluster visual-audit` via UGWTF.

### 2.1 UGWTF Agent Registration

- [x] Create `src/agent.ts` — UGWTF-compatible agent adapter
  - [x] Wrap each audit rule as a UGWTF `Agent` (10 agents via `visualAuditAgents`)
  - [x] Map score → `AgentResult.status` (≥80 success, <80 failed)
  - [x] Map `ctx.localPath` → audit rule `root` parameter
  - [x] Set `shouldRun(ctx)` → framework detection via `detectAdapter()`
- [x] Create `src/cluster.ts` — `visual-audit` cluster definition
  - [x] Set `dependsOn: ['quality']`
  - [x] Set `agents: visualAuditAgents` (10 agents)
- [ ] Register in UGWTF `src/clusters/index.ts` (import + push to CLUSTERS)
- [ ] Add `visual-audit` to `COMMAND_CLUSTER_MAP` in UGWTF `src/orchestrator.ts`

### 2.2 Prompt Scanner & YAML Frontmatter

Fixes Risk R1 (prompt format scores low in UGWTF validator)

- [x] Create `src/prompt-scanner.ts` — Format A scanner (.github/prompts/*.prompt.md)
  - [x] YAML frontmatter parser (title, description, priority, estimatedTime, cluster, wave, severity)
  - [x] `scanPrompts(root)` — discovers and parses all prompts
  - [x] `validatePrompt()` — scores individual prompts (0-100)
- [ ] Add YAML fields to all 30 prompts in `043/.github/prompts/`
- [ ] Verify UGWTF `promptValidator` scores ≥ 70/100 for all 30 prompts

### 2.3 Dual Audit Mode & DAG Wiring

Fixes Risk R2 (wave vs DAG model)

- [x] `--cluster <id>` CLI flag for single-cluster audit (filters issues by cluster prompts)
- [x] Verified: `--cluster C2` shows only 5 dark-mode issues
- [x] Verified: No flag = full 32-issue audit
- [ ] Convert 4-wave model to DAG edges in UGWTF cluster config
- [ ] Verify `clusterExecutionOrder()` produces correct topological sort

### 2.4 Validate Integration

- [x] `node dist/index.js --cwd ../one4three-co-next-app --cluster C2` filters to 5 issues
- [x] `node dist/index.js --cwd ../one4three-co-next-app` full audit = 32 issues, 42%
- [x] Exports map in package.json: `./agent`, `./cluster`, `./prompt-scanner`, `./types`
- [ ] UGWTF registration validated (import in clusters/index.ts)
- [ ] UGWTF `prompts 043` discovers and validates all 30 prompts

---

## Phase 3: GitHub Actions + Multi-Repo (v2.0.0)

**Goal**: Automated visual auditing in CI/CD on every PR.

### 3.1 GitHub Actions Workflow Template

- [ ] Create workflow template at `src/workflows/visual-audit.yml`
  ```yaml
  name: Visual Audit
  on: pull_request
  jobs:
    audit:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
        - run: npx @dabighomie/audit-orchestrator --json > audit-results.json
        - uses: actions/github-script@v7
          with:
            script: |
              // Post audit results as PR comment
  ```
- [ ] Register in UGWTF `WORKFLOW_SPECS` for auto-deployment
- [ ] Deploy to 043 repo via `npx tsx src/index.ts deploy 043`

### 3.2 NPM Publish Pipeline

- [ ] Create `.github/workflows/publish.yml` in audit-orchestrator repo
  - [ ] Trigger: push to `main` with version tag
  - [ ] Steps: build → test → `npm publish --access public`
- [ ] Verify `npx @dabighomie/audit-orchestrator --help` works from npm registry
- [ ] Semantic versioning: `1.0.0` → `1.1.0` → `2.0.0`

### 3.3 Multi-Repo Rollout

- [ ] Test on `043` (primary target) — all 10 rules apply
- [ ] Test on `maximus` (same framework) — all 10 rules apply
- [ ] Test on `damieus` (Vite adapter) — 7/10 rules apply
- [ ] Test on `ffs` (Vite adapter) — 6/10 rules apply
- [ ] Document per-repo rule applicability in README

---

## Integration Points

### UGWTF ↔ Audit Orchestrator

| UGWTF Concept | Audit Orchestrator Mapping |
|---------------|---------------------------|
| `Agent` interface | Each audit rule = 1 agent |
| `AgentContext.localPath` | `--cwd` flag / `process.cwd()` |
| `AgentResult.status` | `pass` / `fail` / `warn` mapped to `success` / `failed` / `skipped` |
| `AgentResult.artifacts` | `AuditIssue[]` array per rule |
| `Cluster.dependsOn[]` | Wave dependency graph (C1 → C2-C5 → C6-C7 → C8-C9) |
| `clusterExecutionOrder()` | Replaces manual 4-wave model |
| `shouldRun(ctx)` | Framework check + repo alias check |
| Prompt scanner | Auto-discovers `.github/prompts/P*.prompt.md` |
| Prompt validator | Scores YAML frontmatter (target ≥70/100) |
| `COMMAND_CLUSTER_MAP` | `audit` includes `visual-audit` cluster |
| `WORKFLOW_SPECS` | Auto-deploys `visual-audit.yml` to target repos |

### ONE4THREE ↔ Audit Orchestrator

| 043 Asset | Audit Orchestrator Usage |
|-----------|--------------------------|
| `scripts/audit-orchestrator.mts` | Source code extracted into `src/` modules |
| `.github/prompts/P01-P30.prompt.md` | Discovered by UGWTF prompt scanner |
| `docs/PARALLEL-EXECUTION-MANIFEST.md` | Wave/cluster reference documentation |
| `tailwind.config.ts` | Read by design-system rule |
| `src/app/globals.css` | Read by dark-mode-contrast rule |
| `src/app/layout.tsx` | Read by design-system + mobile-responsive rules |

### npm Registry

| Field | Value |
|-------|-------|
| Package name | `@dabighomie/audit-orchestrator` |
| Scope | `@dabighomie` (existing, shared with UGWTF) |
| Entry point | `dist/index.js` |
| Binary | `audit-orchestrator` |
| Node requirement | `>=18.3.0` |
| Dependencies | **Zero** (pure Node.js fs + util) |

---

## Risk Tracking

| # | Risk | Phase | Status | Resolved By |
|---|------|-------|--------|-------------|
| R1 | Prompt format scores low | Phase 2 | ❌ Open | Add priority/time to YAML frontmatter |
| R2 | Dual audit confusion | Phase 2 | ❌ Open | Single source of truth via UGWTF |
| R3 | Hardcoded ROOT | Phase 1 | ❌ Open | `--cwd` flag + `process.cwd()` |
| R4 | Framework paths | Phase 1 | ❌ Open | FrameworkAdapter interface |
| R5 | No UGWTF plugin system | Phase 2 | ❌ Open | Direct code addition |
| R6 | npm scope ownership | Phase 3 | ✅ Non-issue | `@dabighomie` already owned |

---

**Next**: Phase 1 implementation begins after this checklist is committed.
