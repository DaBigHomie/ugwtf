# Master Deliverables — Audit & Prompt Chain System

> **Scope**: Everything built across `audit-orchestrator`, `ugwtf`, and `one4three-co-next-app`.  
> **Generated**: June 2025  
> **Owner**: DaBigHomie

---

## Quick Reference

| Component | Location | What It Is |
|-----------|----------|------------|
| `@dabighomie/audit-orchestrator` | `~/management-git/audit-orchestrator/` | npm package — scans codebases for 10 design/code issues |
| `@dabighomie/ugwtf` | `~/management-git/ugwtf/` | Multi-repo orchestration framework — deploys workflows + runs audits |
| Prompt Chain System | `~/management-git/one4three-co-next-app/` | 30 prompt files + chain executor + GitHub automation |

### How They Connect

```
┌─────────────────────────────────────────────────────────────────┐
│  ONE4THREE REPO (one4three-co-next-app)                        │
│                                                                 │
│  .github/prompts/P01-P30  ← 30 audit fix prompts               │
│  scripts/prompt-chain.json ← execution order + dependencies     │
│  .github/workflows/prompt-chain.yml ← chain executor            │
│  .github/workflows/visual-audit.yml ← PR audit gate             │
│  .github/workflows/copilot-full-automation.yml ← Copilot CI     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ visual-audit.yml calls:                                 │    │
│  │   npx @dabighomie/audit-orchestrator --format json      │    │
│  │         ↓                                               │    │
│  │  ┌──────────────────────────────────────┐               │    │
│  │  │  audit-orchestrator (npm package)    │               │    │
│  │  │  10 rules → AuditIssue[] → report   │               │    │
│  │  └──────────────────────────────────────┘               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  UGWTF (orchestration framework)                                │
│                                                                 │
│  npx tsx src/index.ts deploy 043                                │
│    → generates visual-audit.yml from template                   │
│    → deploys to one4three + 3 other repos                       │
│    → syncs labels, runs audit agents                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. audit-orchestrator Package

**Repo**: [DaBigHomie/audit-orchestrator](https://github.com/DaBigHomie/audit-orchestrator)  
**npm**: `@dabighomie/audit-orchestrator@1.1.0`  
**Local**: `~/management-git/audit-orchestrator/`

### What It Does

Standalone npm package that scans any React/Next.js/Vite codebase and returns structured `AuditIssue[]` results for 10 design & code quality rules. Zero runtime dependencies.

### Architecture

```
audit-orchestrator/
├── src/
│   ├── index.ts              ← CLI entry point (parseArgs → run rules → report)
│   ├── types.ts              ← Core types: AuditIssue, AuditResult, AuditRuleContext
│   ├── scanner.ts            ← File system scanner (findFiles)
│   ├── prompt-scanner.ts     ← .prompt.md discovery + YAML frontmatter parser
│   ├── agent.ts              ← UGWTF Agent adapter (wraps rules as UGWTF agents)
│   ├── cluster.ts            ← visual-audit cluster definition for UGWTF DAG
│   │
│   ├── rules/                ← 10 audit rules
│   │   ├── index.ts          ← Rule registry + runner + aggregation
│   │   ├── accessibility.ts  ← ARIA, skip-to-content, focus traps, alt text
│   │   ├── button-consistency.ts ← Shared button component, variants, CTAs
│   │   ├── checkout-flow.ts  ← Checkout page, cart, Stripe, shipping
│   │   ├── collections.ts   ← Collections feature, route, thumbnails, filters
│   │   ├── dark-mode-contrast.ts ← Dark mode contrast validation
│   │   ├── design-system.ts  ← CSS custom properties, hardcoded colors, tokens
│   │   ├── marquee.ts        ← Marquee/ticker presence + animation
│   │   ├── mobile-responsive.ts ← Responsive classes, mobile menu, touch targets
│   │   ├── supabase-integration.ts ← Supabase client, types, migrations, RLS
│   │   └── test-ids.ts       ← data-testid density measurement
│   │
│   ├── adapters/             ← Framework auto-detection
│   │   ├── index.ts          ← Detect Next.js vs Vite-React
│   │   ├── nextjs.ts         ← Next.js App Router path resolver
│   │   └── vite-react.ts     ← Vite + React path resolver
│   │
│   ├── reporters/            ← Output formatters
│   │   ├── index.ts          ← Re-exports
│   │   ├── json.ts           ← JSON output
│   │   ├── markdown.ts       ← Markdown report generator
│   │   └── terminal.ts       ← Colored terminal output
│   │
│   └── workflows/
│       └── visual-audit.yml  ← Template GHA workflow for PR audits
│
├── docs/
│   ├── CHANGELOG.md          ← v1.0.0 → v1.1.0 history
│   ├── FORECAST-AUDIT.md     ← Feature roadmap
│   └── PHASE-CHECKLIST.md    ← Phase implementation checklist
│
├── scripts/
│   └── scaffold-phase2.mts   ← Phase 2 UGWTF scaffolding script
│
├── .github/workflows/
│   ├── ci.yml                ← CI pipeline (typecheck + build)
│   └── publish.yml           ← npm publish on release
│
├── package.json              ← @dabighomie/audit-orchestrator v1.1.0
├── tsconfig.json
└── README.md                 ← Full usage docs, CLI flags, rule catalog
```

**Stats**: 30 source files, ~2,474 lines of code

### CLI Usage

```bash
# Run audit in any project directory
npx @dabighomie/audit-orchestrator --format json
npx @dabighomie/audit-orchestrator --format markdown
npx @dabighomie/audit-orchestrator --format terminal
```

### Core Type

```typescript
interface AuditIssue {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  affectedFiles: string[];
  completionPct: number;
}
```

---

## 2. UGWTF Integration

**Repo**: [DaBigHomie/ugwtf](https://github.com/DaBigHomie/ugwtf)  
**Local**: `~/management-git/ugwtf/`

### Audit-Related Files

| File | Purpose |
|------|---------|
| `src/generators/visual-audit.ts` | Generates `visual-audit.yml` workflow that runs `audit-orchestrator` on PRs |
| `src/generators/security-audit.ts` | Generates `security-audit.yml` (npm audit + auto-fix PRs) |
| `src/agents/audit-agents.ts` | Full-stack repo audit: labels, workflows, quality, issues, PRs. Generates scoreboard |
| `src/orchestrator.ts` | Main orchestrator that dispatches agents (including audit agents) |
| `src/index.ts` | CLI entry — routes `audit` command to audit-agents |
| `src/clusters/index.ts` | Cluster definitions (includes audit cluster registration) |
| `src/types.ts` | Shared types consumed by audit-orchestrator's agent adapter |

### Commands

```bash
cd ~/management-git/ugwtf

# Deploy visual-audit.yml to one4three
npx tsx src/index.ts deploy 043

# Run audit scoreboard
npx tsx src/index.ts audit 043 --verbose

# Deploy to all 4 repos
npx tsx src/index.ts deploy 043 damieus ffs maximus
```

### Target Repos Receiving Deployed Workflows

| Alias | Repo | Status |
|-------|------|--------|
| `043` | one4three-co-next-app | ✅ Deployed |
| `damieus` | damieus-com-migration | ✅ Deployed |
| `ffs` | flipflops-sundays-reboot | ✅ Deployed |
| `maximus` | maximus-ai | ✅ Deployed |

---

## 3. Prompt Chain System (one4three-co-next-app)

**Repo**: [DaBigHomie/one4three-co-next-app](https://github.com/DaBigHomie/one4three-co-next-app)  
**Local**: `~/management-git/one4three-co-next-app/`

### Purpose

30 audit fix prompts organized into a dependency-aware execution chain. Each prompt is a self-contained Copilot task that fixes one audit issue. A GitHub Actions workflow auto-assigns Copilot to the next prompt after each PR merges.

### File Inventory

#### Scripts

| File | Lines | Purpose |
|------|-------|---------|
| `scripts/prompt-chain.json` | 38 | Chain config: 30 entries with position, wave, severity, dependencies, issue numbers |
| `scripts/create-prompt-chain-issues.mts` | 172 | Creates 30 GitHub issues from prompt-chain.json. Flags: `--dry-run`, `--kick` |
| `scripts/generate-docs.mts` | 606 | Generates `docs/PROMPT-CHAIN-SYSTEM.md` from chain config + prompt files |
| `scripts/audit-orchestrator.mts` | 540 | Local wrapper invoking `@dabighomie/audit-orchestrator` programmatically |
| `scripts/audit-orchestrator.ts` | 1,974 | Full standalone audit (pre-package version) |
| `scripts/audit-design-system.mts` | 303 | Design system audit (CSS vars, tokens, hardcoded colors) |
| `scripts/fix-audit-issues.mts` | 200 | Auto-fix script for common audit issues |
| `scripts/feature-audit.ts` | 1,012 | Feature-level audit (FSD compliance) |
| `scripts/create-30x-issues.mts` | 228 | Creates GitHub issues from 30X audit results |
| `scripts/audit-20x.sh` | 295 | Shell script for quick 20X audit pass |

#### Workflows

| File | Lines | Purpose |
|------|-------|---------|
| `.github/workflows/prompt-chain.yml` | 155 | Chain executor — on PR merge with `prompt-chain` label, assigns Copilot to next prompt issue |
| `.github/workflows/visual-audit.yml` | 89 | Runs `audit-orchestrator` on PRs, posts comment with score |
| `.github/workflows/copilot-full-automation.yml` | 916 | Full Copilot automation: issue → branch → PR → review → merge |
| `.github/workflows/chain-issue-assignment.yml` | 241 | Legacy: auto-assigns Copilot to chain issues when labeled |
| `.github/workflows/security-audit.yml` | 85 | Security audit (npm audit + auto-fix) |

#### Prompt Files (30 total, 5,542 lines combined)

| Wave | Prompts | Description |
|------|---------|-------------|
| **Wave 1** (Foundation) | P15, P16, P17 | CSS custom properties, button hierarchy, typography weight |
| **Wave 2** (Visual) | P01-P03, P06, P13, P20-P21, P25-P26 | Dark mode contrast, whitespace, footer links, marquee, mobile |
| **Wave 3** (Features) | P04-P05, P07, P09, P10-P11, P14, P18-P19 | Testimonials, newsletter, collections, PDP, hero links, shop banner |
| **Wave 4** (Polish) | P08, P12, P22-P24, P27-P30 | Shop filters, value prop, payment icons, badges, test IDs, ARIA, Supabase, shipping |

Each prompt file: `.github/prompts/P{NN}-*.prompt.md`

#### Documentation

| File | Lines | Purpose |
|------|-------|---------|
| `docs/PROMPT-CHAIN-SYSTEM.md` | 929 | Complete prompt chain architecture documentation |
| `docs/AUDIT-RESULTS.json` | 97 | Latest audit output (scores, issues, completion%) |

#### GitHub Labels Created (9)

| Label | Color | Purpose |
|-------|-------|---------|
| `prompt-chain` | Green | Identifies PRs in the chain |
| `wave:1` | Blue | Foundation wave |
| `wave:2` | Blue | Visual wave |
| `wave:3` | Blue | Features wave |
| `wave:4` | Blue | Polish wave |
| `critical` | Red | Critical severity |
| `high` | Orange | High severity |
| `medium` | Yellow | Medium severity |
| `low` | Green | Low severity |

---

## Execution Chain Order

The 30 prompts execute in dependency order (P15 is root — CSS custom properties must exist before other fixes):

```
P15 → P16 → P17 → P01 → P02 → P03 → P06 → P13 → P20 → P21 →
P25 → P26 → P04 → P05 → P07 → P09 → P11 → P14 → P18 → P19 →
P10 → P22 → P23 → P12 → P24 → P27 → P28 → P29 → P08 → P30
```

### How It Runs

1. **Create issues**: `npx tsx scripts/create-prompt-chain-issues.mts` (creates 30 GitHub issues with wave + severity labels)
2. **Kick off**: Add `agent:copilot` label to P15 issue (or use `--kick` flag)
3. **Copilot works**: Opens branch, implements fix, creates PR with `prompt-chain` label
4. **PR merges**: `prompt-chain.yml` workflow triggers → reads `prompt-chain.json` → finds next issue → assigns Copilot
5. **Repeat**: Chain continues automatically through all 30 prompts

---

## Line Count Summary

| Component | Files | Lines |
|-----------|-------|-------|
| audit-orchestrator (src) | 22 | ~1,650 |
| audit-orchestrator (docs/config) | 8 | ~824 |
| ugwtf (audit-related) | 7 | ~1,090 |
| one4three scripts | 10 | ~4,368 |
| one4three workflows | 5 | ~1,486 |
| one4three prompts | 30 | ~5,542 |
| one4three docs | 2 | ~1,026 |
| **Total** | **84** | **~15,986** |

---

## Version History

| Date | Milestone |
|------|-----------|
| Sessions 1-11 | Built audit-orchestrator: 10 rules, 2 adapters, 3 reporters, CLI |
| Session 12 | Critical bug fix: refactored AuditRule from `() => number` to `() => AuditIssue[]` |
| Session 13 | Fixed UGWTF visual-audit.ts API mismatch, committed `11c60c4` |
| Session 14 | Created PR #1 for both repos |
| Session 15 | Merged PRs, published `@dabighomie/audit-orchestrator@1.1.0` to npm, deployed workflows to 4 repos |
| Session 16 | Built prompt chain system: `prompt-chain.json`, `prompt-chain.yml`, `create-prompt-chain-issues.mts`. Created 9 labels. Merged to main |
| Session 17 | Built `generate-docs.mts`, generated `PROMPT-CHAIN-SYSTEM.md` (930 lines) |
| Session 18 | This document — master deliverables inventory |

---

## Related Documentation

- [PROMPT-CHAIN-SYSTEM.md](./PROMPT-CHAIN-SYSTEM.md) — Deep dive on the 30-prompt chain architecture
- [audit-orchestrator README](https://github.com/DaBigHomie/audit-orchestrator#readme) — CLI usage, rule catalog, API docs
- [AUDIT-RESULTS.json](./AUDIT-RESULTS.json) — Latest audit output data
