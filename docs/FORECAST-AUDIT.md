# Forecast Audit: NPX Portable Audit Package

**Package**: `@dabighomie/audit-orchestrator`
**Date**: March 13, 2026
**Source**: 6 forecasting agents analyzing the plan to extract `scripts/audit-orchestrator.mts` (ONE4THREE) into a portable npx CLI with GitHub Actions + UGWTF integration.

---

## Agent 1: Feasibility Forecaster

**Verdict: FEASIBLE with 3 blockers**

| Dimension | Status | Notes |
|-----------|--------|-------|
| Core scanner logic | **Ready** | `audit-orchestrator.mts` already uses `fs.readFileSync` + regex — no project imports |
| NPM publish | **Ready** | `@dabighomie` scope already owned (UGWTF uses it) |
| TypeScript build | **Ready** | UGWTF already has a `tsc` → `dist/` pipeline to model |
| Cross-repo file reading | **Ready** | Uses `findFiles()` + `fileContains()` — pure fs, no AST |

### Blockers

1. **Hardcoded root resolution** — `ROOT = resolve(import.meta.dirname ?? '.', '..')` only works when script is inside the project. NPX invocation needs `--cwd` flag or `process.cwd()` default.
   - **Fix**: Replace `ROOT` with `const ROOT = argv.cwd ? resolve(argv.cwd) : process.cwd()`

2. **Completion auditors are 043-specific** — Functions like `auditDarkModeContrast()` check for `globals.css`, `tailwind.config.js`, `src/app/layout.tsx` — Next.js + Tailwind assumptions. A Vite repo (FFS, damieus) has different paths.
   - **Fix**: Introduce a `FrameworkAdapter` that resolves paths per framework (`vite-react` vs `nextjs`)
   - **Scope**: UGWTF's `repo-registry.ts` already has `framework: 'vite-react' | 'nextjs'` — reuse that

3. **No CLI argument parsing** — Current script uses manual `process.argv` checks. NPX packages need proper arg parsing (`parseArgs` from `node:util` — zero deps).
   - **Fix**: Use `import { parseArgs } from 'node:util'` (built-in since Node 18.3)

---

## Agent 2: Architecture Risk Forecaster

**Verdict: 2 HIGH risks, 3 MEDIUM risks**

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|------------|
| **Prompt format coupling** | HIGH | 30 prompts use Format A (YAML frontmatter). UGWTF's prompt-validator scores Format A lower (no priority field → -5pts, no time estimate → -5pts). Running UGWTF's `prompts` command on 043 would flag all 30 as "failing" | Add `cluster`, `wave`, `severity` fields to YAML frontmatter. UGWTF prompt-validator already parses frontmatter — it would pick these up automatically |
| **Dual audit systems** | HIGH | The orchestrator has its OWN audit logic (`auditDarkModeContrast()`, `auditTestIds()` etc.) AND UGWTF has its own `audit` cluster (`auditAgents`). They measure different things but both produce "scores" — users will see conflicting numbers | The npx package should produce `AuditIssue[]` data, and UGWTF's visual-audit agent should CONSUME that data (not re-audit). Single source of truth |
| **Cluster ID collision** | MEDIUM | Orchestrator uses C1-C9 cluster IDs. UGWTF uses string IDs (`labels`, `quality`, `prompts`). If UGWTF maps C1-C9 internally, they'll shadow each other | Namespace them: `visual-audit:C1`, `visual-audit:C2` etc. |
| **Wave dependencies vs DAG** | MEDIUM | Orchestrator uses 4-wave sequential model. UGWTF uses a DAG with topological sort (`clusterExecutionOrder()`). These are different execution models | Convert waves to DAG edges: Wave 2 depends on Wave 1 = each C2-C5 cluster has `dependsOn: ['visual-audit:C1']` |
| **No error recovery** | MEDIUM | Current orchestrator is fire-and-forget. If prompt P15 fails mid-execution, Wave 2 starts anyway | Add `status` tracking per prompt. UGWTF's `AgentResult` already has `success`/`failed`/`skipped` — map to that |

---

## Agent 3: Dependency Mapping Forecaster

**Verdict: 4 dependencies must resolve before build**

```
┌──────────────────────────────────────────────────────┐
│  DEPENDENCY CHAIN                                     │
│                                                       │
│  1. Node.js ≥18.3 (parseArgs)  ← REQUIRED            │
│     └── Already guaranteed by UGWTF (tsconfig ES2022) │
│                                                       │
│  2. FrameworkAdapter interface   ← MUST BUILD          │
│     ├── nextjs adapter (paths for 043, maximus)        │
│     └── vite-react adapter (paths for ffs, damieus)    │
│                                                       │
│  3. UGWTF repo-registry update  ← MUST EDIT           │
│     └── Add '043' entry if running visual-audit        │
│     └── Already exists ✅                              │
│                                                       │
│  4. npm publish pipeline        ← MUST SETUP           │
│     ├── npm login to @dabighomie scope                 │
│     ├── GitHub Actions publish workflow                │
│     └── Semantic versioning (1.0.0 → )                │
└──────────────────────────────────────────────────────┘
```

**Pre-existing (no work needed):**
- UGWTF cluster DAG infrastructure ✅
- UGWTF Agent/AgentResult/AgentContext types ✅
- Repo registry with framework field ✅
- Prompt scanner + validator agents ✅

---

## Agent 4: Adoption Forecaster

**Verdict: 4/6 repos would benefit, 2 won't**

| Repo | Alias | Framework | Applicable? | Why |
|------|-------|-----------|-------------|-----|
| one4three-co-next-app | `043` | Next.js | **YES — primary** | All 30 prompts + 10 auditors designed for it |
| maximus-ai | `maximus` | Next.js | **YES** | Same framework, same design system patterns, same FSD architecture |
| damieus-com-migration | `damieus` | Vite+React | **Partial** | Dark mode, accessibility, test-id auditors apply. Shop/PDP auditors need path adaptation |
| flipflops-sundays-reboot | `ffs` | Vite+React | **Partial** | Checkout flow auditor applies. Design system auditor needs adaptation |
| cae-luxury-hair | `cae` | Vite+React | **Low** | Different design language (Atlanta cultural tokens). Would need cultural-validation rules, not visual audit |
| ramanministries | `raman` | React | **Low** | Multi-site architecture — auditing 20 sites needs a different approach entirely |

**Forecast**: Start with 043-only (v1.0), add `--framework nextjs|vite` adapter (v1.1), then generalize auditors (v2.0).

---

## Agent 5: UGWTF Integration Fit Forecaster

**Verdict: STRONG FIT — 92% alignment with existing architecture**

| UGWTF Pattern | Audit Orchestrator Equivalent | Compatible? |
|---------------|-------------------------------|-------------|
| `Agent` interface | `AuditIssue` + completion functions | **Yes** — wrap each auditor as an Agent |
| `AgentContext` | `ROOT` + file scanner | **Yes** — `ctx.localPath` = `ROOT` |
| `AgentResult` | Console output | **Yes** — map to `status`/`message`/`artifacts` |
| `Cluster` with `dependsOn[]` | `PromptCluster` with `dependsOn[]` | **Exact match** |
| `clusterExecutionOrder()` → wave sort | 4-wave manifest | **Compatible** — DAG subsumes waves |
| `shouldRun(ctx)` conditional | N/A (always runs) | **Need to add** — use `ctx.repoAlias === '043'` initially |
| `SwarmConfig` parallel execution | `canParallelize: true` per cluster | **Compatible** |
| Prompt scanner (Format A parser) | 30 Format A prompts in `.github/prompts/` | **Already compatible** — UGWTF will discover them |

**Integration gap**: UGWTF's `COMMAND_CLUSTER_MAP` is hardcoded in `src/index.ts`. Adding `visual-audit` requires a code change to UGWTF, not just a plugin. UGWTF has no dynamic plugin loading.

**Recommendation**: Add the `visual-audit` cluster directly to UGWTF's codebase rather than trying to bolt on a plugin system. This is consistent with how all 7 existing clusters work.

---

## Agent 6: Effort & Sequencing Forecaster

**Verdict: 3-phase buildout, v1.0 achievable in a single session**

### Phase 1 — Extract & Package (v1.0)

| Task | Files | Scope |
|------|-------|-------|
| Create `packages/audit-orchestrator/` or standalone repo | 1 dir | New |
| Move scanner + auditors from `audit-orchestrator.mts` | 1 file → 5 files | Refactor |
| Add `parseArgs` CLI with `--cwd`, `--json`, `--cluster`, `--parallel-map` | 1 file | New |
| Add `package.json` with `bin` field | 1 file | New |
| `FrameworkAdapter` for nextjs + vite-react | 1 file | New |
| Wire reporters: JSON + markdown + terminal | 1 file | New |
| **Total new/changed** | **~10 files** | |

### Phase 2 — UGWTF Integration (v1.1)

| Task | Files | Scope |
|------|-------|-------|
| Create `src/agents/visual-audit-agents.ts` in UGWTF | 1 file | New |
| Register `visual-audit` cluster in `src/clusters/index.ts` | 1 file | Edit |
| Add `visual-audit` to `COMMAND_CLUSTER_MAP` in `src/index.ts` | 1 file | Edit |
| Add YAML frontmatter fields (`cluster`, `wave`, `severity`) to 30 prompts | 30 files | Edit |
| **Total new/changed** | **33 files** | |

### Phase 3 — GitHub Actions + Multi-Repo (v2.0)

| Task | Files | Scope |
|------|-------|-------|
| Create `.github/workflows/visual-audit.yml` template | 1 file | New |
| Add `generateVisualAudit` to UGWTF's `WORKFLOW_SPECS` | 1 file | Edit |
| Deploy to 043 + maximus repos via `ugwtf deploy` | 0 (auto) | |
| `npm publish` pipeline workflow | 1 file | New |
| **Total new/changed** | **3 files** | |

---

## Consolidated Risk Matrix

| # | Risk | Severity | Likelihood | Mitigation | Owner |
|---|------|----------|------------|------------|-------|
| R1 | Prompt format scores low in UGWTF validator | HIGH | CERTAIN | Add `priority`, `estimatedTime` to YAML frontmatter | Phase 2 |
| R2 | Dual audit confusion (two systems, two scores) | HIGH | LIKELY | NPX produces data, UGWTF consumes — never run both | Phase 2 |
| R3 | Hardcoded ROOT breaks npx invocation | HIGH | CERTAIN | Replace with `--cwd` / `process.cwd()` | Phase 1 |
| R4 | Framework-specific paths fail on Vite repos | MEDIUM | LIKELY | FrameworkAdapter with `resolveStylesheet()`, `resolveConfig()` | Phase 1 |
| R5 | No plugin system in UGWTF | MEDIUM | N/A | Direct code addition (consistent with existing pattern) | Phase 2 |
| R6 | npm publish scope ownership | LOW | UNLIKELY | `@dabighomie` scope already used by UGWTF | Phase 3 |

---

## Forecast Verdict

| Question | Forecast |
|----------|----------|
| **Can it be an npx package?** | Yes. Scanner is already pure-fs. 3 changes needed (ROOT resolution, CLI args, framework adapter) |
| **Can it run without node_modules?** | Yes. Tool reads files as text. Only dependency: Node.js ≥18.3 |
| **GitHub Actions integration?** | Yes. Single `npx` step + `actions/github-script` for PR comments. UGWTF can auto-deploy the workflow via `WORKFLOW_SPECS` |
| **UGWTF integration?** | Strong fit. Same cluster/agent/DAG pattern. Add as 8th cluster. UGWTF prompt agents will auto-discover the 30 prompts |
| **Biggest risk?** | R1 + R2: Conflicting scores between systems. Must establish single source of truth |
| **Recommended start?** | Phase 1 (extract + package) — can be done in one session |
