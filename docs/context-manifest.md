# Context Manifest — Workspace Instruction Baseline [FI-01]

**Generated**: 2026-04-08  
**Task**: FI-01 — 30x Instruction Baseline Sync  
**Script**: `scripts/sync-instructions.py`

---

## Summary

Synchronized the 30x instruction baseline across **20 workspace repos**. Every repo now carries the same canonical instruction files from `~/management-git/.github/instructions/` plus a per-repo `ugwtf-workflow.instructions.md` generated from registry data.

**Total**: 223 files added, 20 files overwritten (upgraded stale versions)

---

## Repos Synced

| Alias | Repo | Framework | Files Before | Files After |
|-------|------|-----------|-------------|-------------|
| damieus | damieus-com-migration | vite-react | 17 | 25 |
| ffs | flipflops-sundays-reboot | vite-react | 8 | 18 |
| 043 | one4three-co-next-app | nextjs | 22 | 29 |
| maximus | maximus-ai | nextjs | 16 | 23 |
| ugwtf | ugwtf | node | 7 | 19 |
| agent-mastery | agent-mastery | node | 3 | 15 |
| atl | atl-table-booking-app | node | 3 | 15 |
| tequila-week | atl-tequila-week | vite-react | 3 | 15 |
| audit-orch | audit-orchestrator | node | 3 | 15 |
| chat-exporter | copilot-chat-exporter | node | 3 | 15 |
| docs-standards | documentation-standards | node | 3 | 15 |
| haven | haven-event-siteplan | vite-react | 3 | 15 |
| image-gen | image-gen-30x-cli | node | 3 | 16 |
| jay-anthony | jay-anthony-app | vite-react | 3 | 15 |
| management | Management | node | 7 | 16 |
| oros | oros-core | nextjs | 3 | 16 |
| product-gen | product-generator | vite-react | 3 | 15 |
| tequila-festival | tequila-sunrise-festival-atl | vite-react | 3 | 15 |
| unique-collab | unique-collab | vite-react | 3 | 15 |
| workflow-agents | damieus-workflow-agents | node | 0 | 12 |

---

## File Categories Applied

### Category 1 — Workspace-root universals (all repos)

| File | Description |
|------|-------------|
| `agent-authoring.instructions.md` | How to create/edit agents |
| `agent-execution-constraints.instructions.md` | Agent safety limits |
| `commit-quality.instructions.md` | Branch safety + pre-commit gates |
| `core-directives.instructions.md` | FSD, portable paths, automation-first |
| `design-system-universal.instructions.md` | Token usage, no hardcoded colors |
| `file-creation-safety.instructions.md` | Workspace boundary rules |
| `playwright-testing.instructions.md` | E2E test conventions |
| `pr-review.instructions.md` | PR review standards |
| `safety-guardrails.instructions.md` | Prohibited actions |
| `script-automation.instructions.md` | .mts script patterns |
| `typescript.instructions.md` | Type strictness, build rules |
| `vercel.instructions.md` | Deploy conventions |
| `workflow-syntax.instructions.md` | GHA YAML rules |
| `image-gen.instructions.md` | image-gen-30x-cli only |

### Category 2 — Per-repo remix

| File | Notes |
|------|-------|
| `ugwtf-workflow.instructions.md` | Generated with real alias/slug/CI data from registry |

### Category 3 — Cross-cutting (applicable repos)

| File | Repos | Notes |
|------|-------|-------|
| `fsd-architecture.instructions.md` | oros-core | Added with [TODO] placeholders |
| `testing-instructions.md` | 18 repos (043 + maximus already had it) | Added with [TODO] for app-specific patterns |

---

## Repos NOT Changed

The following files were intentionally left as-is (repo-specific business logic):
- `supabase.instructions.md` — damieus, ffs, 043, maximus
- `stripe.instructions.md` / `stripe-payments.instructions.md` — 043, maximus
- `cart-system.instructions.md`, `checkout-payment.instructions.md` — damieus
- `fsd-architecture.instructions.md` — 043, maximus (existing; not overwritten)
- `testing-instructions.md` — 043, maximus (existing; not overwritten)
- All ugwtf-specific files: `adding-agents.instructions.md`, `architecture.instructions.md`, `prompt-instructions.md`

---

## TODO Items Remaining

Files with `[TODO]` placeholders that need app-specific info filled in:

| File | Repos | What's needed |
|------|-------|---------------|
| `testing-instructions.md` | 18 repos | Unit test command, coverage command, app-specific file→suite mappings |
| `fsd-architecture.instructions.md` | oros-core | Layer definitions, actual feature/entity folder names |

These are actionable stubs — Copilot agents will fill them in during future chain runs.
