# Prompt Chain Execution System

**Repository**: one4three-co-next-app
**Owner**: DaBigHomie
**Generated**: 2026-03-13
**Status**: Ready to execute

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [The Audit Orchestrator Package](#the-audit-orchestrator-package)
4. [Prompt Chain Config](#prompt-chain-config)
5. [Wave Breakdown](#wave-breakdown)
6. [All 30 Prompts Reference](#all-30-prompts-reference)
7. [GitHub Workflows](#github-workflows)
8. [Issue Creation Script](#issue-creation-script)
9. [Execution Workflow](#execution-workflow)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This system automates the execution of **30 audit-identified design/code fixes** (P01-P30) for the ONE4THREE e-commerce app. Instead of running all fixes at once (which causes merge conflicts and overlapping changes), the system:

1. **Creates GitHub issues** for each prompt (via `create-prompt-chain-issues.mts`)
2. **Assigns Copilot** to the first issue (P15 — the root dependency)
3. **Chains execution** — when Copilot's PR merges, the workflow automatically assigns Copilot to the next issue
4. **Respects dependencies** — prompts execute in topological order across 4 waves

### Key Principle: No Overlapping Deployments

Each prompt runs **sequentially**. The next prompt only starts after the previous one's PR is merged. This prevents:
- Merge conflicts between concurrent changes
- CSS variable conflicts (P15 defines variables that P01-P14 consume)
- Broken dependencies (e.g., P21 checkout fix must land before P08 filter fix)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    PROMPT CHAIN SYSTEM                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐     ┌──────────────────────┐               │
│  │  Audit           │────▶│  30 Prompt Files      │               │
│  │  Orchestrator    │     │  (.github/prompts/)   │               │
│  │  (npm package)   │     │  P01-P30.prompt.md    │               │
│  └─────────────────┘     └──────────┬───────────┘               │
│                                      │                           │
│                           ┌──────────▼───────────┐               │
│                           │  prompt-chain.json    │               │
│                           │  (topological order)  │               │
│                           └──────────┬───────────┘               │
│                                      │                           │
│                    ┌─────────────────┼─────────────────┐         │
│                    ▼                 ▼                  ▼         │
│  ┌─────────────────────┐ ┌──────────────────┐ ┌──────────────┐  │
│  │ create-prompt-chain  │ │  prompt-chain    │ │  copilot-    │  │
│  │ -issues.mts          │ │  .yml workflow   │ │  full-auto   │  │
│  │ (creates 30 issues)  │ │  (chains next)   │ │  .yml        │  │
│  └─────────────────────┘ └──────────────────┘ └──────────────┘  │
│                                                                  │
│  Execution Flow:                                                 │
│  ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐                     │
│  │Wave 1│──▶│Wave 2│──▶│Wave 3│──▶│Wave 4│                     │
│  │ 3 fix│   │11 fix│   │12 fix│   │ 4 fix│                     │
│  └──────┘   └──────┘   └──────┘   └──────┘                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### File Inventory

| File | Purpose | Lines |
|------|---------|-------|
| `scripts/prompt-chain.json` | Topological execution order for all 30 prompts | 39 |
| `scripts/create-prompt-chain-issues.mts` | Creates GitHub issues & writes back issue numbers | 173 |
| `.github/workflows/prompt-chain.yml` | Auto-chains: on PR merge → assign Copilot to next | 156 |
| `.github/workflows/copilot-full-automation.yml` | Full Copilot automation pipeline | 917 |
| `.github/prompts/P01-P30*.prompt.md` | 30 individual fix prompts | 30 files |

---

## The Audit Orchestrator Package

### What It Is

`@dabighomie/audit-orchestrator` is a standalone npm package that scans a codebase and produces a list of design/code issues with severity ratings and fix suggestions.

### Installation

```bash
npm install @dabighomie/audit-orchestrator
```

### How It Works

1. **10 audit rules** scan the codebase for common issues:
   - CSS custom property usage
   - Dark mode contrast violations
   - Button hierarchy inconsistencies
   - Typography weight problems
   - Accessibility gaps (aria, testids)
   - Grid/layout orphan elements
   - And more

2. Each rule returns `AuditIssue[]` with:
   ```typescript
   interface AuditIssue {
     id: string;           // e.g. "css-var-missing-hero"
     title: string;        // Human-readable description
     severity: "critical" | "high" | "medium" | "low";
     category: string;     // e.g. "css", "a11y", "layout"
     description: string;  // Detailed explanation
     affectedFiles: string[];
     completionPct: number; // 0-100
   }
   ```

3. Results are aggregated into a scored report (0-100%) used by the visual audit workflow.

### Relationship to Prompt Chain

The audit orchestrator **identifies issues**. The 30 prompts **fix those issues**. The chain system **sequences the fixes** so they don't conflict.

```
Audit Orchestrator ──identifies──▶ 30 Issues ──mapped to──▶ 30 Prompts ──sequenced by──▶ prompt-chain.json
```

---

## Prompt Chain Config

### File: `scripts/prompt-chain.json`

This JSON array defines the **exact execution order** of all 30 prompts. Each entry contains:

```typescript
interface ChainEntry {
  position: number;    // 1-30, execution order
  prompt: string;      // "P15", "P16", etc.
  file: string;        // "P15-css-custom-properties.prompt.md"
  wave: number;        // 1-4, parallel-safe grouping
  severity: string;    // "critical" | "high" | "medium" | "low"
  depends: string[];   // ["P15", "P21"] — must complete first
  issue: number | null; // GitHub issue number (null until created)
}
```

### Execution Order

| Position | Prompt | Wave | Severity | Dependencies |
|----------|--------|------|----------|--------------|
| 1 | P15 | 1 | critical | — |
| 2 | P16 | 1 | high | P15 |
| 3 | P17 | 1 | medium | P15 |
| 4 | P01 | 2 | critical | P15 |
| 5 | P02 | 2 | high | P15 |
| 6 | P03 | 2 | high | P15 |
| 7 | P06 | 2 | high | P15 |
| 8 | P13 | 3 | high | — |
| 9 | P20 | 3 | high | — |
| 10 | P21 | 3 | critical | — |
| 11 | P25 | 3 | critical | — |
| 12 | P26 | 3 | high | — |
| 13 | P04 | 2 | medium | P15 |
| 14 | P05 | 2 | medium | P15 |
| 15 | P07 | 2 | medium | — |
| 16 | P09 | 2 | medium | — |
| 17 | P11 | 3 | medium | P15 |
| 18 | P14 | 2 | low | P15 |
| 19 | P18 | 2 | medium | P15 |
| 20 | P19 | 3 | medium | P15 |
| 21 | P10 | 3 | medium | — |
| 22 | P22 | 3 | medium | — |
| 23 | P23 | 3 | medium | — |
| 24 | P12 | 3 | low | P05 |
| 25 | P24 | 3 | medium | P11 |
| 26 | P27 | 3 | high | P15, P16 |
| 27 | P28 | 4 | high | P15 |
| 28 | P29 | 4 | medium | P21, P15 |
| 29 | P08 | 4 | high | P15, P29 |
| 30 | P30 | 4 | medium | P21, P29 |

### Why This Order?

1. **P15 (CSS Custom Properties)** must run first — it defines the CSS variables that 20+ other prompts consume
2. **P16 (Button Hierarchy)** and **P17 (Typography)** establish foundational design tokens
3. **Wave 2** fixes depend on P15's variables being in place
4. **Wave 3** fixes depend on Wave 2 components being stable
5. **Wave 4** fixes (checkout, Supabase, shipping) have the deepest dependency chains

---

## Wave Breakdown

### Wave 1 — 3 prompts

> Foundation layer. CSS variables, button system, typography tokens. Everything else depends on these.

| # | Prompt | Severity | Title |
|---|--------|----------|-------|
| 1 | P15 | critical | Establish CSS custom property theme system — design system foundation |
| 2 | P16 | high | Standardize button hierarchy — primary, secondary, ghost, outline variants |
| 3 | P17 | medium | Fix typography weight issues in dark mode — thin fonts unreadable |

### Wave 2 — 10 prompts

> Core fixes. Dark mode contrast, layout grids, component-level issues. Depend on Wave 1 tokens.

| # | Prompt | Severity | Title |
|---|--------|----------|-------|
| 4 | P01 | critical | Fix hero section dark mode contrast — WCAG AA heading/body text on navy background |
| 5 | P02 | high | Fix section eyebrow ghost headings — CURATED FOR YOU, COLLECTIONS, REAL REVIEWS invisible text |
| 6 | P03 | high | Fix Shop By Vibe collection cards — monochrome flatness in dark mode, card contrast |
| 7 | P06 | high | Fix homepage vertical whitespace and essentials grid alignment |
| 13 | P04 | medium | Fix testimonials section color inversion — light blue band jarring in dark mode |
| 14 | P05 | medium | Fix newsletter section washed-out appearance in dark mode |
| 15 | P07 | medium | Fix orphaned 5th collection card in Shop By Vibe grid |
| 16 | P09 | medium | Fix PDP margin issues and hidden top promotional bar |
| 19 | P18 | medium | Fix PDP washed-out UI in light mode — low contrast, faded elements |
| 18 | P14 | low | Fix social proof stats text wrapping and alignment on homepage |

### Wave 3 — 13 prompts

> Feature-level fixes. Mobile nav, badges, thumbnails, checkout UI. Depend on stable components from Wave 2.

| # | Prompt | Severity | Title |
|---|--------|----------|-------|
| 10 | P21 | critical | Fix broken checkout button — CRITICAL cart/checkout flow |
| 11 | P25 | critical | Fix mobile menu cannot scroll — CRITICAL navigation blocker |
| 8 | P13 | high | Fix empty footer link destinations — all links must resolve |
| 9 | P20 | high | Fix marquee not scrolling — CSS animation broken |
| 12 | P26 | high | Fix mobile top bar centering and Atlanta Rooted word wrap |
| 26 | P27 | high | Add 50+ data-testid attributes for comprehensive test coverage |
| 17 | P11 | medium | Add product card info badges — materials, bestseller, limited edition |
| 20 | P19 | medium | Fix shop page banner text overlay — text unreadable over images |
| 21 | P10 | medium | Fix hero CTA link mismatch — /about vs /our-story route |
| 22 | P22 | medium | Fix incorrect payment method icons on PDP |
| 23 | P23 | medium | Fix missing collection thumbnails — broken image references |
| 25 | P24 | medium | Standardize product badge rendering across site |
| 24 | P12 | low | Fix newsletter value proposition inconsistency between sections |

### Wave 4 — 4 prompts

> Integration layer. Supabase sync, shipping API, filter functionality. Depend on checkout and component fixes.

| # | Prompt | Severity | Title |
|---|--------|----------|-------|
| 27 | P28 | high | ARIA attributes and keyboard navigation compliance |
| 29 | P08 | high | Implement functional shop page filters with URL state |
| 28 | P29 | medium | Supabase cart and wishlist sync with authenticated users |
| 30 | P30 | medium | Shipping methods integration from FFS checkout pattern |

---

## All 30 Prompts Reference

### P15: Establish CSS custom property theme system — design system foundation

- **Position**: 1 of 30
- **Wave**: 1
- **Severity**: critical
- **Dependencies**: None (root)
- **File**: `.github/prompts/P15-css-custom-properties.prompt.md`


> **Audit Issue**: DS-01 (Critical)
**Cluster**: C1 — Design System Foundation
**Parallel**: No — this is a PREREQUISITE for P01-P05, P06, P11, P14, P16-P19
**Depends On**: Nothing — this runs FIRST

### P16: Standardize button hierarchy — primary, secondary, ghost, outline variants

- **Position**: 2 of 30
- **Wave**: 1
- **Severity**: high
- **Dependencies**: P15
- **File**: `.github/prompts/P16-button-hierarchy.prompt.md`


> **Audit Issue**: DS-02 (Medium)
**Cluster**: C1 — Design System Foundation
**Parallel**: Yes — alongside P17
**Depends On**: P15 (CSS custom properties)

### P17: Fix typography weight issues in dark mode — thin fonts unreadable

- **Position**: 3 of 30
- **Wave**: 1
- **Severity**: medium
- **Dependencies**: P15
- **File**: `.github/prompts/P17-typography-weight-dark.prompt.md`


> **Audit Issue**: DS-03 (Medium)
**Cluster**: C1 — Design System Foundation
**Parallel**: Yes — alongside P16
**Depends On**: P15 (CSS custom properties)

### P01: Fix hero section dark mode contrast — WCAG AA heading/body text on navy background

- **Position**: 4 of 30
- **Wave**: 2
- **Severity**: critical
- **Dependencies**: P15
- **File**: `.github/prompts/P01-hero-dark-mode-contrast.prompt.md`


> **Audit Issue**: DM-01 (Critical)
**Cluster**: C2 — Dark Mode Contrast System
**Parallel**: Yes — can run alongside P02-P05
**Depends On**: P15 (CSS custom properties must exist first)

### P02: Fix section eyebrow ghost headings — CURATED FOR YOU, COLLECTIONS, REAL REVIEWS invisible text

- **Position**: 5 of 30
- **Wave**: 2
- **Severity**: high
- **Dependencies**: P15
- **File**: `.github/prompts/P02-eyebrow-ghost-headings.prompt.md`


> **Audit Issue**: DM-02 (Critical)
**Cluster**: C2 — Dark Mode Contrast System
**Parallel**: Yes — can run alongside P01, P03-P05
**Depends On**: P15 (CSS custom properties)

### P03: Fix Shop By Vibe collection cards — monochrome flatness in dark mode, card contrast

- **Position**: 6 of 30
- **Wave**: 2
- **Severity**: high
- **Dependencies**: P15
- **File**: `.github/prompts/P03-collection-cards-dark-mode.prompt.md`


> **Audit Issue**: DM-03 (High)
**Cluster**: C2 — Dark Mode Contrast System
**Parallel**: Yes — alongside P01, P02, P04, P05
**Depends On**: P15 (design system foundation)

### P06: Fix homepage vertical whitespace and essentials grid alignment

- **Position**: 7 of 30
- **Wave**: 2
- **Severity**: high
- **Dependencies**: P15
- **File**: `.github/prompts/P06-homepage-whitespace-grid.prompt.md`


> **Audit Issue**: LY-01 (Medium) + LY-02 (Medium)
**Cluster**: C4 — Homepage Layout & Spacing
**Parallel**: Yes — alongside P07, P14
**Depends On**: P15 (design system tokens)

### P13: Fix empty footer link destinations — all links must resolve

- **Position**: 8 of 30
- **Wave**: 3
- **Severity**: high
- **Dependencies**: None (root)
- **File**: `.github/prompts/P13-footer-link-destinations.prompt.md`


> **Audit Issue**: CT-04 (Medium)
**Cluster**: C6 — Content & Links
**Parallel**: Yes — alongside P10, P11, P12, P14
**Depends On**: None

### P20: Fix marquee not scrolling — CSS animation broken

- **Position**: 9 of 30
- **Wave**: 3
- **Severity**: high
- **Dependencies**: None (root)
- **File**: `.github/prompts/P20-marquee-scrolling.prompt.md`


> **Audit Issue**: FN-01 (High)
**Cluster**: C7 — Functional Fixes
**Parallel**: Yes — alongside P21, P22, P23, P24
**Depends On**: None

### P21: Fix broken checkout button — CRITICAL cart/checkout flow

- **Position**: 10 of 30
- **Wave**: 3
- **Severity**: critical
- **Dependencies**: None (root)
- **File**: `.github/prompts/P21-checkout-button-fix.prompt.md`


> **Audit Issue**: FN-02 (Critical)
**Cluster**: C7 — Functional Fixes
**Parallel**: Yes — alongside P20, P22, P23, P24
**Depends On**: None

### P25: Fix mobile menu cannot scroll — CRITICAL navigation blocker

- **Position**: 11 of 30
- **Wave**: 3
- **Severity**: critical
- **Dependencies**: None (root)
- **File**: `.github/prompts/P25-mobile-menu-scroll.prompt.md`


> **Audit Issue**: MB-01 (Critical)
**Cluster**: C3 — Mobile Responsive
**Parallel**: Yes — alongside P26
**Depends On**: None

### P26: Fix mobile top bar centering and Atlanta Rooted word wrap

- **Position**: 12 of 30
- **Wave**: 3
- **Severity**: high
- **Dependencies**: None (root)
- **File**: `.github/prompts/P26-mobile-topbar-wordwrap.prompt.md`


> **Audit Issue**: MB-02 + MB-03 (Medium)
**Cluster**: C3 — Mobile Responsive
**Parallel**: Yes — alongside P25
**Depends On**: None

### P04: Fix testimonials section color inversion — light blue band jarring in dark mode

- **Position**: 13 of 30
- **Wave**: 2
- **Severity**: medium
- **Dependencies**: P15
- **File**: `.github/prompts/P04-testimonials-dark-mode.prompt.md`


> **Audit Issue**: DM-04 (High)
**Cluster**: C2 — Dark Mode Contrast System
**Parallel**: Yes — alongside P01-P03, P05
**Depends On**: P15 (CSS custom properties)

### P05: Fix newsletter section washed-out appearance in dark mode

- **Position**: 14 of 30
- **Wave**: 2
- **Severity**: medium
- **Dependencies**: P15
- **File**: `.github/prompts/P05-newsletter-dark-mode.prompt.md`


> **Audit Issue**: DM-05 (Medium)
**Cluster**: C2 — Dark Mode Contrast System
**Parallel**: Yes — alongside P01-P04
**Depends On**: P15 (CSS custom properties)

### P07: Fix orphaned 5th collection card in Shop By Vibe grid

- **Position**: 15 of 30
- **Wave**: 2
- **Severity**: medium
- **Dependencies**: None (root)
- **File**: `.github/prompts/P07-collection-grid-orphan.prompt.md`


> **Audit Issue**: LY-03 (Medium)
**Cluster**: C4 — Homepage Layout & Spacing
**Parallel**: Yes — alongside P06, P14
**Depends On**: None

### P09: Fix PDP margin issues and hidden top promotional bar

- **Position**: 16 of 30
- **Wave**: 2
- **Severity**: medium
- **Dependencies**: None (root)
- **File**: `.github/prompts/P09-pdp-margins-topbar.prompt.md`


> **Audit Issue**: LY-05 (High)
**Cluster**: C5 — Shop & PDP Fixes
**Parallel**: Yes — alongside P08, P18, P19
**Depends On**: None

### P11: Add product card info badges — materials, bestseller, limited edition

- **Position**: 17 of 30
- **Wave**: 3
- **Severity**: medium
- **Dependencies**: P15
- **File**: `.github/prompts/P11-product-info-badges.prompt.md`


> **Audit Issue**: CT-02 (Low)
**Cluster**: C6 — Content & Links
**Parallel**: Yes — alongside P10, P12, P13, P14
**Depends On**: P15 (design tokens)

### P14: Fix social proof stats text wrapping and alignment on homepage

- **Position**: 18 of 30
- **Wave**: 2
- **Severity**: low
- **Dependencies**: P15
- **File**: `.github/prompts/P14-social-proof-wrapping.prompt.md`


> **Audit Issue**: CT-05 (Low)
**Cluster**: C4 — Homepage Layout & Spacing
**Parallel**: Yes — alongside P06, P07
**Depends On**: P15 (design tokens)

### P18: Fix PDP washed-out UI in light mode — low contrast, faded elements

- **Position**: 19 of 30
- **Wave**: 2
- **Severity**: medium
- **Dependencies**: P15
- **File**: `.github/prompts/P18-pdp-light-mode-contrast.prompt.md`


> **Audit Issue**: DS-04 (Medium)
**Cluster**: C5 — Shop & PDP
**Parallel**: Yes — alongside P08, P09
**Depends On**: P15 (CSS custom properties)

### P19: Fix shop page banner text overlay — text unreadable over images

- **Position**: 20 of 30
- **Wave**: 3
- **Severity**: medium
- **Dependencies**: P15
- **File**: `.github/prompts/P19-shop-banner-overlay.prompt.md`


> **Audit Issue**: DS-05 (Medium)
**Cluster**: C5 — Shop & PDP
**Parallel**: Yes — alongside P08, P09, P18
**Depends On**: P15 (CSS custom properties)

### P10: Fix hero CTA link mismatch — /about vs /our-story route

- **Position**: 21 of 30
- **Wave**: 3
- **Severity**: medium
- **Dependencies**: None (root)
- **File**: `.github/prompts/P10-hero-link-mismatch.prompt.md`


> **Audit Issue**: CT-01 (Medium)
**Cluster**: C6 — Content & Links
**Parallel**: Yes — alongside P11, P12, P13, P14
**Depends On**: None

### P22: Fix incorrect payment method icons on PDP

- **Position**: 22 of 30
- **Wave**: 3
- **Severity**: medium
- **Dependencies**: None (root)
- **File**: `.github/prompts/P22-pdp-payment-icons.prompt.md`


> **Audit Issue**: FN-03 (Medium)
**Cluster**: C7 — Functional Fixes
**Parallel**: Yes — alongside P20, P21, P23, P24
**Depends On**: None

### P23: Fix missing collection thumbnails — broken image references

- **Position**: 23 of 30
- **Wave**: 3
- **Severity**: medium
- **Dependencies**: None (root)
- **File**: `.github/prompts/P23-collection-thumbnails.prompt.md`


> **Audit Issue**: FN-04 (Medium)
**Cluster**: C7 — Functional Fixes
**Parallel**: Yes — alongside P20, P21, P22, P24
**Depends On**: None

### P12: Fix newsletter value proposition inconsistency between sections

- **Position**: 24 of 30
- **Wave**: 3
- **Severity**: low
- **Dependencies**: P05
- **File**: `.github/prompts/P12-newsletter-value-prop.prompt.md`


> **Audit Issue**: CT-03 (Low)
**Cluster**: C6 — Content & Links
**Parallel**: Yes — alongside P10, P11, P13, P14
**Depends On**: P05 (newsletter dark mode)

### P24: Standardize product badge rendering across site

- **Position**: 25 of 30
- **Wave**: 3
- **Severity**: medium
- **Dependencies**: P11
- **File**: `.github/prompts/P24-badge-consistency.prompt.md`


> **Audit Issue**: FN-05 (Low)
**Cluster**: C7 — Functional Fixes
**Parallel**: Yes — alongside P20, P21, P22, P23
**Depends On**: P11 (ProductBadge component — CT-02)

### P27: Add 50+ data-testid attributes for comprehensive test coverage

- **Position**: 26 of 30
- **Wave**: 3
- **Severity**: high
- **Dependencies**: P15, P16
- **File**: `.github/prompts/P27-testid-coverage.prompt.md`


> **Audit Issue**: XC-01 (High)
**Cluster**: C8 — Testing & Accessibility
**Parallel**: Yes — alongside P28
**Depends On**: P15, P16 (design system foundation complete)

### P28: ARIA attributes and keyboard navigation compliance

- **Position**: 27 of 30
- **Wave**: 4
- **Severity**: high
- **Dependencies**: P15
- **File**: `.github/prompts/P28-aria-keyboard-nav.prompt.md`


> **Audit Issue**: XC-02 (High)
**Cluster**: C8 — Testing & Accessibility
**Parallel**: Yes — alongside P27
**Depends On**: P15 (design system tokens for focus rings)

### P29: Supabase cart and wishlist sync with authenticated users

- **Position**: 28 of 30
- **Wave**: 4
- **Severity**: medium
- **Dependencies**: P21, P15
- **File**: `.github/prompts/P29-supabase-cart-wishlist.prompt.md`


> **Audit Issue**: XC-03 (Medium)
**Cluster**: C9 — Supabase & Integration
**Parallel**: Yes — alongside P30
**Depends On**: P21 (checkout button), P15 (design system)

### P08: Implement functional shop page filters with URL state

- **Position**: 29 of 30
- **Wave**: 4
- **Severity**: high
- **Dependencies**: P15, P29
- **File**: `.github/prompts/P08-shop-filter-functionality.prompt.md`


> **Audit Issue**: LY-04 (High)
**Cluster**: C5 — Shop & PDP Fixes
**Parallel**: Yes — alongside P09, P18, P19
**Depends On**: P15 (design tokens), P29 (Supabase product data)

### P30: Shipping methods integration from FFS checkout pattern

- **Position**: 30 of 30
- **Wave**: 4
- **Severity**: medium
- **Dependencies**: P21, P29
- **File**: `.github/prompts/P30-shipping-integration.prompt.md`


> **Audit Issue**: XC-04 (Medium)
**Cluster**: C9 — Supabase & Integration
**Parallel**: Yes — alongside P29
**Depends On**: P21 (checkout button), P29 (cart persistence)

---

## GitHub Workflows

### 1. `prompt-chain.yml` — Chain Executor

**Purpose**: When a PR with the `prompt-chain` label merges into `main`, this workflow:
1. Reads `scripts/prompt-chain.json`
2. Finds which issue just closed (from the merged PR)
3. Determines the **next** issue in the chain
4. Assigns Copilot to the next issue
5. Posts a progress comment

**Trigger**:
```yaml
on:
  pull_request:
    types: [closed]
    # Condition: merged == true && base.ref == 'main' && has 'prompt-chain' label
```

**Key Logic**:
- Matches the closed PR's linked issue to a `position` in prompt-chain.json
- Assigns Copilot to position + 1 using `octokit.rest.issues.addAssignees`
- Posts wave progress (e.g., "Wave 2: 5/11 complete")
- Stops gracefully at position 30 (chain complete)

**Permissions**: `issues: write`, `pull-requests: read`, `contents: read`

### 2. `copilot-full-automation.yml` — Copilot Pipeline

**Purpose**: Full automation for Copilot-created PRs. Handles:
- Auto-labeling PRs with `prompt-chain` when linked to a chain issue
- Running quality gates (TypeScript, ESLint, build)
- Posting review results

**Trigger**: `pull_request` events on Copilot branches (`copilot/**`)

### 3. `chain-issue-assignment.yml` — Legacy Chain (Separate System)

**Purpose**: Older, hardcoded chain for issues 29→25→26→30→31→32. This is a **different system** from the prompt chain and does not conflict.

**Coexistence**: The prompt-chain workflow only triggers on PRs with the `prompt-chain` label. The legacy chain only triggers on specific issue numbers. They do not overlap.

---

## Issue Creation Script

### File: `scripts/create-prompt-chain-issues.mts`

This script creates all 30 GitHub issues from the prompt files and writes the issue numbers back into `prompt-chain.json`.

### Usage

```bash
# Preview what would be created (no API calls)
npx tsx scripts/create-prompt-chain-issues.mts --dry-run

# Create all 30 issues
npx tsx scripts/create-prompt-chain-issues.mts

# Create issues AND assign Copilot to position 1 (P15) to kick off the chain
npx tsx scripts/create-prompt-chain-issues.mts --kick
```

### What It Does

1. **Reads** `scripts/prompt-chain.json` for execution order
2. **Reads** each prompt file from `.github/prompts/`
3. **Creates** a GitHub issue for each prompt with:
   - Title: `[P15] CSS Custom Properties Foundation`
   - Body: Full prompt content
   - Labels: `prompt-chain`, `automation:copilot`, `agent:copilot`, `wave:N`, severity
4. **Writes** issue numbers back to `prompt-chain.json` (`"issue": 42`)
5. **Rate-limits** at 500ms between API calls to avoid GitHub throttling
6. If `--kick` is passed, assigns Copilot to position 1 (P15) to start the chain

### Labels Applied Per Issue

| Label | Purpose |
|-------|---------|
| `prompt-chain` | Identifies issue as part of the chain |
| `automation:copilot` | Triggers Copilot automation workflows |
| `agent:copilot` | Marks for Copilot assignment |
| `wave:1` through `wave:4` | Wave grouping |
| `critical` / `high` / `medium` / `low` | Fix priority |

### Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- Labels must exist on the repo (created in previous session — 9 labels)
- Run from the repo root (`one4three-co-next-app/`)

---

## Execution Workflow

### Step-by-Step: Running the Chain

```bash
# 1. Verify chain config is valid
cat scripts/prompt-chain.json | jq '.[0:3]'

# 2. Create all 30 issues (dry run first)
npx tsx scripts/create-prompt-chain-issues.mts --dry-run

# 3. Create issues for real + kick off chain
npx tsx scripts/create-prompt-chain-issues.mts --kick

# 4. Monitor progress
gh issue list --label prompt-chain --state open
gh issue list --label prompt-chain --state closed
```

### What Happens After Kickoff

```
Step 1: Script assigns Copilot to P15 issue
         ↓
Step 2: Copilot reads P15 prompt, creates branch, opens PR
         ↓
Step 3: PR merges with 'prompt-chain' label
         ↓
Step 4: prompt-chain.yml fires → finds P15 at position 1
         ↓
Step 5: Workflow assigns Copilot to position 2 (P16)
         ↓
Step 6: Repeat until position 30 (P30) completes
         ↓
Step 7: Workflow detects "chain complete" → posts summary
```

### Manual Intervention Points

| Scenario | Action |
|----------|--------|
| PR has merge conflicts | Resolve manually, re-push |
| Quality gates fail | Fix in the PR, push again |
| Copilot creates bad fix | Close PR, manually fix, re-assign |
| Need to skip a prompt | Close the issue, workflow chains to next |
| Need to pause the chain | Don't merge the current PR |
| Need to restart from N | Manually assign Copilot to issue at position N |

### Monitoring Commands

```bash
# See chain progress
gh issue list --label prompt-chain --json number,title,state | jq '.[] | "\(.state) #\(.number) \(.title)"'

# See open chain issues (remaining)
gh issue list --label prompt-chain --state open --limit 30

# See closed chain issues (completed)
gh issue list --label prompt-chain --state closed --limit 30

# Check which wave is active
gh issue list --label prompt-chain --label wave:2 --state open
```

---

## Troubleshooting

### Chain Stops Advancing

**Symptoms**: PR merged but next issue not assigned
**Causes**:
1. PR missing `prompt-chain` label → Add label before merging
2. PR not linked to a chain issue → Check `Closes #N` in PR body
3. `prompt-chain.json` has `null` issue numbers → Run create script first

**Fix**: Manually assign Copilot to the next issue:
```bash
gh issue edit <NEXT_ISSUE_NUMBER> --add-assignee copilot
```

### Copilot Doesn't Pick Up Issue

**Symptoms**: Issue assigned but no PR created
**Causes**:
1. Copilot coding agent not enabled for repo
2. Issue body doesn't contain actionable prompt
3. `automation:copilot` label missing

**Fix**: Verify labels and re-assign:
```bash
gh issue edit <N> --add-label automation:copilot,agent:copilot
gh issue edit <N> --add-assignee copilot
```

### Wrong Execution Order

**Symptoms**: Prompts running out of dependency order
**Fix**: The order is defined in `prompt-chain.json`. The workflow reads `position` field, not wave. Verify the JSON is correct:
```bash
cat scripts/prompt-chain.json | jq '.[].prompt'
```

### Quality Gates Fail on Copilot PR

**Expected behavior**: CI runs on every Copilot PR. If it fails:
1. Copilot may auto-fix and push again
2. If stuck, manually fix the PR
3. The chain only advances on **merge**, not on PR creation

---

## Appendix: Dependency Graph

```
P15 (CSS Variables) ─────────────────────────────────────────────────┐
  ├── P16 (Buttons)                                                  │
  ├── P17 (Typography)                                               │
  ├── P01 (Hero Dark Mode)          depends on P15                   │
  ├── P02 (Eyebrow Headings)        depends on P15, P17             │
  ├── P03 (Collection Cards)        depends on P15                   │
  ├── P06 (Whitespace Grid)         depends on P15                   │
  ├── P13 (Footer Links)            depends on P15                   │
  ├── P20 (Marquee)                 depends on P15                   │
  ├── P21 (Checkout Button)         depends on P15, P16             │
  ├── P25 (Mobile Menu)             depends on P15                   │
  ├── P26 (Mobile Topbar)           depends on P15                   │
  ├── P04 (Testimonials)            depends on P01, P15             │
  ├── P05 (Newsletter DM)           depends on P01, P15             │
  ├── P07 (Collection Grid)         depends on P03, P06             │
  ├── P09 (PDP Margins)             depends on P15                   │
  ├── P11 (Product Badges)          depends on P15, P16             │
  ├── P14 (Social Proof)            depends on P15, P17             │
  ├── P18 (PDP Light Mode)          depends on P15                   │
  ├── P19 (Shop Banner)             depends on P15                   │
  ├── P10 (Hero Link)               depends on P01                   │
  ├── P22 (Payment Icons)           depends on P21                   │
  ├── P23 (Thumbnails)              depends on P03                   │
  ├── P12 (Newsletter VP)           depends on P05, P15             │
  ├── P24 (Badge Consistency)       depends on P11, P16             │
  ├── P27 (TestID Coverage)         depends on P15                   │
  ├── P28 (Aria/Keyboard)           depends on P27                   │
  ├── P29 (Supabase Cart)           depends on P21                   │
  ├── P08 (Shop Filters)            depends on P21, P29             │
  └── P30 (Shipping)                depends on P21, P29             │
```

---

*Generated by `scripts/generate-docs.mts` — regenerate anytime with `npx tsx scripts/generate-docs.mts`*
