# FI-02: Phased Instruction Baseline Sync — Remediation Plan

**Predecessor**: PRB-20260408 / FI-01 (rollback complete ✅ 2026-04-08)
**Status**: Planning
**Owner**: @DaBigHomie

---

## Objective

Bring all workspace repos to a consistent instruction/agent/prompt baseline using architecture-aware, phased deployment — replacing the failed FI-01 generic approach.

---

## Phase 0: Intelligence Gathering ✅

**Status**: Complete

### AI Review Failure Matrix

| Category | % | Root Cause | Fix |
|----------|---|-----------|-----|
| Build/Script Mismatch | 41% | Generic tsc+esbuild assumed | Read package.json per repo |
| TODO Placeholders | 18% | Shipped placeholders where real data exists | Pre-populate from package.json |
| Missing Infrastructure | 16% | References to non-existent .github/agents/ | Validate paths before referencing |
| Language/Extension Conflicts | 14% | "TypeScript only" rules hit Python/Bash repos | Framework-conditional content |
| GitHub Actions/YAML Issues | 11% | Validation patterns too broad | Scope YAML rules appropriately |

### Gold-Standard Audit Summary

| Repo | Instructions | Agents | Prompts | Framework |
|------|-------------|--------|---------|-----------|
| workspace root | 15 | 67 | 60 | N/A (master set) |
| one4three-co-next-app | 22 | 80 | 113 | Next.js + Stripe |
| damieus-com-migration | 17 | 58 | 64 | Next.js + Supabase |
| maximus-ai | 16 | 58 | 50 | Next.js + Sovereign |
| flipflops-sundays-reboot | 8 | 58 | 52 | Vite + Supabase |
| image-gen-30x-cli | 1 | 3 | 3 | Node CLI |
| ugwtf | 4 | 1 | 1 | Metaframework |

---

## Phase 1: Instruction File Taxonomy

**Goal**: Classify all instruction files into deployment tiers.

### Tier 1: Universal (copy verbatim to all repos)
- `core-directives.instructions.md`
- `commit-quality.instructions.md`
- `pr-review.instructions.md` (remove agent file references)
- `safety-guardrails.instructions.md`
- `file-creation-safety.instructions.md`
- `workflow-syntax.instructions.md` (fix YAML pattern scope)

### Tier 2: Framework-Conditional (template + conditional logic)
- `typescript.instructions.md` — build commands per framework
- `ugwtf-workflow.instructions.md` — per-repo remix from registry
- `vercel.instructions.md` — Next.js/Vite frontend only
- `playwright-testing.instructions.md` — repos with E2E only
- `design-system-universal.instructions.md` — frontend repos only
- `agent-authoring.instructions.md` — repos with .github/agents/
- `script-automation.instructions.md` — repos with scripts/

### Tier 3: Domain-Specific (create only if repo uses the domain)
- `supabase.instructions.md` — repos with Supabase
- `stripe.instructions.md` — repos with Stripe
- `fsd-architecture.instructions.md` — repos using FSD
- `image-gen.instructions.md` — image pipeline repos
- `testing-instructions.md` — populated from real package.json test commands

### Tier 4: Repo-Unique (never sync — repo-owned)
- `architecture.instructions.md` (ugwtf)
- `adding-repos.instructions.md` (ugwtf)
- `sovereign-enforcement.instructions.md` (maximus)
- `COPILOT_HANDOFF_INSTRUCTIONS.md` (damieus)
- Domain-specific deep configs (checkout-payment, sales-funnel, etc.)

---

## Phase 2: Agent & Prompt Baseline

**Goal**: Define standard agent/prompt distribution tiers.

| Tier | Agents | Prompts | Target |
|------|--------|---------|--------|
| **Core** | 58 | 50 | All production repos |
| **Extended** | 80 | 113 | Frontend + design system repos |
| **Minimal** | 3 | 3 | CLI tools, libraries |
| **Framework** | Custom | Custom | ugwtf only |

### Key Actions
- Verify 58-agent core set is identical across gold-standard repos
- Identify agents needing framework-conditional logic
- Create AGENTS.md template per tier

---

## Phase 3: Pre-flight Validation Script

**Goal**: Build `scripts/preflight-validate.mts` in ugwtf.

### Checks
1. Framework detection from package.json (vite/next/node/python)
2. Existing instruction file inventory
3. CI pipeline detection (build/test/lint commands)
4. Domain detection (supabase/stripe/fsd/design-system/e2e)
5. Conflict simulation (would new files clash with existing)
6. Output: per-repo compatibility report with go/no-go per file

---

## Phase 4: Phased Deployment Protocol

### Rollout Stages

| Stage | Scope | Repo(s) | Gate |
|-------|-------|---------|------|
| **Canary** | 1 repo | flipflops-sundays-reboot | CI + AI review pass + merge |
| **Beta** | 3 repos | atl-tequila-week, haven-event-siteplan, product-generator | All CI + AI review pass |
| **GA Wave 1** | 6 repos | Remaining simple repos | All pass |
| **GA Wave 2** | 4 repos | Complex repos (oros-core, unique-collab, agent-mastery, jay-anthony) | All pass |
| **Gold Audit** | 5 repos | damieus, ffs, 043, maximus, image-gen | Gap-fill only (add missing, never overwrite) |

### Per-Stage Protocol
1. Run pre-flight validation
2. Generate architecture-aware content
3. Create PR on `chore/fi-02-instruction-baseline`
4. Wait for CI + AI code review
5. Human review + merge approval
6. Monitor 24h before advancing

---

## Phase 5: Workspace/Repo/Path Instruction Hierarchy

**Goal**: Establish the permanent 3-tier instruction standard.

```
~/.github/instructions/          ← WORKSPACE (inherited by all repos)
{repo}/.github/instructions/     ← REPO (framework-conditional overrides)
{repo}/.github/instructions/     ← PATH (applyTo: globs for file-type scoping)
```

### Resolution Rules
- Workspace instructions are inherited automatically
- Repo instructions override workspace for same filename
- Path-scoped instructions use `applyTo:` frontmatter
- No duplication: if workspace has it, repo doesn't copy unless overriding

---

## Phase 6: ugwtf Registry Expansion

**Goal**: Re-register repos with architecture metadata.

### New RepoConfig Fields
- `instructionTier`: 'core' | 'extended' | 'minimal' | 'framework'
- `domains`: string[] — e.g. ['supabase', 'stripe', 'fsd', 'design-system', 'e2e']

### Actions
- Re-add repos to repo-registry.ts
- Build `ugwtf deploy-instructions` command
- Validate: `npx tsc --noEmit && npx vitest run`

---

## Constraints

- **NEVER deploy to all repos simultaneously** — always canary first
- **NEVER use generic content** — all files must be architecture-aware
- **copilot-chat-exporter** needs repo rule adjustment first
- **Gold-standard repos** get gap-fill only (add missing, never overwrite)
- All work on feature branches, not main
