#!/usr/bin/env python3
"""
sync-instructions.py — Sync 30x instruction baseline to all workspace repos.

Usage:
  python3 scripts/sync-instructions.py [--dry-run] [--repo <alias>]

Categories synced:
  1. Workspace-root universals → all repos (overwrite stale)
  2. ugwtf-workflow.instructions.md → all repos (per-repo remix from registry data)
  3. Cross-cutting non-workspace-root → applicable repos (fsd-architecture, testing-instructions)
"""

import os
import sys
import shutil
import argparse
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HOME = Path.home()
WORKSPACE = HOME / "management-git"
WORKSPACE_ROOT_INSTRUCTIONS = WORKSPACE / ".github" / "instructions"

# All locally available repos (alias → local folder name)
REPOS = [
    {"alias": "damieus",         "slug": "DaBigHomie/damieus-com-migration",        "dir": "damieus-com-migration",        "framework": "vite-react", "lint": "eslint .",  "typecheck": "tsc --noEmit", "build": "vite build",            "e2e": "npx playwright test"},
    {"alias": "ffs",             "slug": "DaBigHomie/flipflops-sundays-reboot",     "dir": "flipflops-sundays-reboot",     "framework": "vite-react", "lint": "eslint .",  "typecheck": None,           "build": "vite build",            "e2e": "npx playwright test"},
    {"alias": "043",             "slug": "DaBigHomie/one4three-co-next-app",        "dir": "one4three-co-next-app",        "framework": "nextjs",     "lint": "next lint", "typecheck": "tsc --noEmit", "build": "next build --turbopack", "e2e": "npm run test:e2e"},
    {"alias": "maximus",         "slug": "DaBigHomie/maximus-ai",                   "dir": "maximus-ai",                   "framework": "nextjs",     "lint": "eslint",    "typecheck": "tsc --noEmit", "build": "next build",            "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "ugwtf",           "slug": "DaBigHomie/ugwtf",                        "dir": "ugwtf",                        "framework": "node",       "lint": None,        "typecheck": "tsc --noEmit", "build": "npm run build",         "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "agent-mastery",   "slug": "DaBigHomie/agent-mastery",               "dir": "agent-mastery",               "framework": "node",       "lint": None,        "typecheck": "tsc --noEmit", "build": None,                    "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "atl",             "slug": "DaBigHomie/atl-table-booking-app",        "dir": "atl-table-booking-app",        "framework": "node",       "lint": None,        "typecheck": None,           "build": None,                    "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "tequila-week",    "slug": "DaBigHomie/atl-tequila-week",             "dir": "atl-tequila-week",             "framework": "vite-react", "lint": "eslint .",  "typecheck": None,           "build": "vite build",            "e2e": "npx playwright test"},
    {"alias": "audit-orch",      "slug": "DaBigHomie/audit-orchestrator",           "dir": "audit-orchestrator",           "framework": "node",       "lint": None,        "typecheck": "tsc --noEmit", "build": None,                    "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "chat-exporter",   "slug": "DaBigHomie/copilot-chat-exporter",        "dir": "copilot-chat-exporter",        "framework": "node",       "lint": None,        "typecheck": None,           "build": None,                    "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "docs-standards",  "slug": "DaBigHomie/documentation-standards",     "dir": "documentation-standards",     "framework": "node",       "lint": None,        "typecheck": None,           "build": None,                    "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "haven",           "slug": "DaBigHomie/haven-event-siteplan",         "dir": "haven-event-siteplan",         "framework": "vite-react", "lint": "eslint .",  "typecheck": None,           "build": "vite build",            "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "image-gen",       "slug": "DaBigHomie/image-gen-30x-cli",            "dir": "image-gen-30x-cli",            "framework": "node",       "lint": None,        "typecheck": "tsc --noEmit", "build": None,                    "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "jay-anthony",     "slug": "DaBigHomie/jay-anthony-app",              "dir": "jay-anthony-app",              "framework": "vite-react", "lint": "eslint .",  "typecheck": None,           "build": "vite build",            "e2e": "npx playwright test"},
    {"alias": "management",      "slug": "DaBigHomie/Management",                   "dir": "Management",                   "framework": "node",       "lint": None,        "typecheck": None,           "build": None,                    "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "oros",            "slug": "DaBigHomie/oros-core",                    "dir": "oros-core",                    "framework": "nextjs",     "lint": "next lint", "typecheck": "tsc --noEmit", "build": "next build",            "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "product-gen",     "slug": "DaBigHomie/product-generator",            "dir": "product-generator",            "framework": "vite-react", "lint": "eslint .",  "typecheck": None,           "build": "vite build",            "e2e": "playwright test --project=chromium-desktop"},
    {"alias": "tequila-festival","slug": "DaBigHomie/tequila-sunrise-festival-atl", "dir": "tequila-sunrise-festival-atl", "framework": "vite-react", "lint": "eslint .",  "typecheck": None,           "build": "vite build",            "e2e": "npx playwright test"},
    {"alias": "unique-collab",   "slug": "DaBigHomie/unique-collab",                "dir": "unique-collab",                "framework": "vite-react", "lint": "eslint .",  "typecheck": None,           "build": "vite build",            "e2e": "npx playwright test"},
    {"alias": "workflow-agents", "slug": "DaBigHomie/damieus_workflow_analysis",    "dir": "damieus-workflow-agents",      "framework": "node",       "lint": None,        "typecheck": None,           "build": None,                    "e2e": "playwright test --project=chromium-desktop"},
]

# Workspace-root files to copy to ALL repos
# (image-gen.instructions.md is excluded — handled separately for image-gen only)
UNIVERSAL_FILES = [
    "agent-authoring.instructions.md",
    "agent-execution-constraints.instructions.md",
    "commit-quality.instructions.md",
    "core-directives.instructions.md",
    "design-system-universal.instructions.md",
    "file-creation-safety.instructions.md",
    "playwright-testing.instructions.md",
    "pr-review.instructions.md",
    "safety-guardrails.instructions.md",
    "script-automation.instructions.md",
    "typescript.instructions.md",
    "vercel.instructions.md",
    "workflow-syntax.instructions.md",
]

# Repos that get fsd-architecture (nextjs)
FSD_REPOS = {"043", "maximus", "oros"}

# Repos that already have testing-instructions (skip generation)
TESTING_ALREADY_HAVE = {"043", "maximus"}


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

def ci_row(label: str, cmd: str | None) -> str:
    val = f"`{cmd}`" if cmd else "[TODO: configure]"
    return f"| {label} | {val} |"


def generate_ugwtf_workflow(repo: dict) -> str:
    alias = repo["alias"]
    slug = repo["slug"]
    framework = repo["framework"]
    lint = repo.get("lint")
    typecheck = repo.get("typecheck")
    build = repo.get("build")
    e2e = repo.get("e2e")

    framework_note = {
        "nextjs": "Next.js (App Router)",
        "vite-react": "Vite + React",
        "node": "Node.js",
    }.get(framework, framework)

    ci_section = "\n".join([
        ci_row("Lint", lint),
        ci_row("Type-check", typecheck),
        ci_row("Build", build),
        ci_row("E2E", e2e),
    ])

    return f"""---
applyTo: "**"
---

# UGWTF Workflow Management

> Unified GitHub Workflow & Task Framework — handles labels, issues, PRs, CI/CD, and auditing for this repo.
> Package: `@dabighomie/ugwtf` v1.0.0 | Location: `~/management-git/ugwtf/`

---

## Quick Reference

This repo is registered as **`{alias}`** (`{slug}`) in the UGWTF orchestrator.
Framework: **{framework_note}**

```bash
# All commands run from the ugwtf directory
cd ~/management-git/ugwtf

# Run with npx tsx (dev) or node dist/index.js (built)
npx tsx src/index.ts <command> [repos...] [flags]
```

---

## Commands

| Command | What It Does | When to Use |
|---------|-------------|-------------|
| `labels` | Sync 23+ universal labels + repo-specific labels | After adding new label definitions |
| `deploy` | Sync labels + deploy CI/CD workflow YAML files | Initial setup or workflow updates |
| `validate` | Run quality gates (tsc, lint, build, config) | Before commits, after major changes |
| `issues` | Detect stalled issues, assign Copilot, auto-triage | When issues pile up or need triage |
| `prs` | Review Copilot PRs, enforce DB migration firewall | When Copilot PRs need processing |
| `audit` | Full audit with scoreboard generation | Weekly health checks |
| `fix` | Auto-fix labels + workflows + quality issues | When audit reveals drift |
| `status` | Quick health snapshot | Anytime |

### Target This Repo Only

```bash
npx tsx src/index.ts issues {alias}
npx tsx src/index.ts prs {alias}
npx tsx src/index.ts audit {alias} --verbose
npx tsx src/index.ts validate {alias}
npx tsx src/index.ts deploy {alias} --dry-run
```

### Flags

```
--dry-run        Preview changes without executing
--verbose, -v    Show debug output
--concurrency N  Max parallel repos (default: 3)
--cluster ID     Run specific cluster (repeatable)
```

---

## CI Commands

| Gate | Command |
|------|---------|
{ci_section}

---

## Label System

### How to Label Issues

**Priority** (pick one):
- `priority:p0` — Critical, blocking launch
- `priority:p1` — High, needed before launch
- `priority:p2` — Medium, nice to have
- `priority:p3` — Low, future enhancement

**Automation tier** (pick one):
- `automation:copilot` — Copilot can implement autonomously
- `automation:full` — Fully automated workflow
- `automation:partial` — Agent assists, human decides
- `automation:manual` — Must be done manually

**Status** (applied automatically by agents):
- `automation:in-progress` — Pipeline running
- `automation:completed` — Done successfully
- `agent:copilot` — Assigned to Copilot
- `needs-pr` — Issue needs a pull request
- `stalled` — No activity >48h
- `needs-review` — Awaiting human review

### Creating Issues for Copilot

To have Copilot auto-pick up an issue:

1. Create the issue with labels: `agent:copilot` + `automation:copilot` + `priority:pN`
2. Run: `npx tsx src/index.ts issues {alias}`
3. The `issue-copilot-assign` agent will assign Copilot and mark `automation:in-progress`

---

## PR Workflow

| Step | Action |
|------|--------|
| Copilot opens PR | Validate with `prs {alias}` |
| PR is draft | Promote with `prs {alias}` |
| Tests pass | Merge via GitHub UI (squash merge) |
| Merge | Issues linked via `Closes #N` are auto-closed |

**DB Firewall**: PRs touching migration files require manual approval before merge.

---

## Anti-Patterns

- ❌ Don't assign Copilot manually via GitHub UI — use `npx tsx src/index.ts issues {alias}`
- ❌ Don't merge PRs that fail the UGWTF validate gate
- ❌ Don't create issues and immediately close them in the same session
- ✅ Always run `validate {alias}` before marking work complete
"""


def generate_testing_instructions(repo: dict) -> str:
    alias = repo["alias"]
    framework = repo["framework"]
    e2e = repo.get("e2e") or "[TODO: configure e2e command]"
    typecheck = repo.get("typecheck") or "[TODO: configure typecheck]"

    framework_note = {
        "nextjs": "Next.js",
        "vite-react": "Vite + React",
        "node": "Node.js",
    }.get(framework, framework)

    return f"""---
applyTo: "**"
---

# Testing Instructions — {alias}

> Framework: {framework_note}
> [TODO: Add app-specific test paths, coverage targets, and CI gate configuration]

## Standardized Test Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm test` | `[TODO: unit test command]` | Unit tests (all) |
| `npm run test:watch` | `[TODO: watch command]` | Unit tests (watch mode) |
| `npm run test:coverage` | `[TODO: coverage command]` | Unit tests + coverage |
| `npm run test:e2e` | `{e2e}` | E2E tests |
| `npm run type-check` | `{typecheck}` | TypeScript type checking |

## File-Change → Test-Suite Mapping

When an agent modifies files, run the corresponding test suites:

### Source Changes → Unit Tests

Trigger when ANY of these change:
- `src/**/*.ts`, `src/**/*.tsx` — source files
- `**/*.test.ts`, `**/*.test.tsx` — test files
- `**/*.spec.ts`, `**/*.spec.tsx` — spec files

[TODO: Add repo-specific file patterns that trigger specific test suites]

### E2E Tests

Trigger when ANY of these change:
- `src/**/*.tsx` — React components (visual regression)
- `src/**/page*`, `src/**/Page*` — page components
- [TODO: Add repo-specific E2E trigger paths]

## Quality Gates (in order)

1. `{typecheck}` — 0 errors
2. `[TODO: lint command]` — 0 errors
3. `[TODO: unit test command]` — all pass
4. `{e2e}` — all pass (before merge)

## Agent Test Execution Rules

- ✅ Run unit tests after every source file change
- ✅ Run E2E before opening a PR
- ❌ Never skip type-check — it catches real bugs
- ❌ Never mark a task complete with failing tests
- ❌ Never delete tests to make them pass

[TODO: Add repo-specific testing patterns, mocks, fixtures, and conventions]
"""


def generate_fsd_architecture(repo: dict) -> str:
    alias = repo["alias"]
    return f"""---
applyTo: "src/features/**,src/entities/**,src/shared/**,src/widgets/**"
---

# FSD Architecture — Layer Rules ({alias})

> [TODO: Verify and update layer definitions for this specific repo's structure]

## Import Direction (enforced)

```
app → widgets → features → entities → shared
      ────────────────────────────────────→
      (imports flow DOWN only)
```

- ✅ `features/X` → `entities/Y` (down)
- ✅ `features/X` → `shared/hooks` (down)
- ⛔ `shared/ui` → `features/X` (NEVER up)
- ⛔ `entities/A` → `features/B` (NEVER up)
- ⛔ `features/A` → `features/B` (NEVER cross-feature)

## Layer Definitions

[TODO: List the actual feature folders, entity models, and shared utilities for {alias}]

```
src/
├── app/             # [TODO: describe app-level setup]
├── features/        # [TODO: list key features]
│   └── example/
│       ├── components/
│       ├── hooks/
│       ├── api/
│       └── index.ts
├── entities/        # [TODO: list domain entities]
├── shared/          # Shared utilities, constants, types
│   ├── ui/
│   ├── hooks/
│   ├── lib/
│   └── types/
└── widgets/         # [TODO: list page-level composite components]
```

## Feature Folder Template

```
src/features/{{name}}/
├── components/     # Feature-scoped UI
├── hooks/          # Feature-scoped hooks
├── api/            # Feature-scoped API calls
├── lib/            # Feature-scoped utils
├── types.ts        # Types
└── index.ts        # Public API exports ONLY
```

## Rules

- ✅ ALWAYS export public API from `index.ts`
- ✅ ALWAYS use named exports (no default)
- ✅ ALWAYS keep components < 300 lines
- ⛔ NEVER import between sibling features
- ⛔ NEVER put business logic in `shared/ui/`
- ⛔ NEVER create files in `src/components/` (use FSD layers)
"""


# ---------------------------------------------------------------------------
# Main sync logic
# ---------------------------------------------------------------------------

def sync_repo(repo: dict, dry_run: bool) -> dict:
    alias = repo["alias"]
    repo_dir = WORKSPACE / repo["dir"]
    instructions_dir = repo_dir / ".github" / "instructions"

    if not repo_dir.exists():
        return {"alias": alias, "skipped": True, "reason": f"directory not found: {repo_dir}"}

    changes = {"added": [], "overwritten": [], "skipped_exists": []}

    def write_file(path: Path, content: str, label: str) -> None:
        if path.exists():
            existing = path.read_text()
            if existing == content:
                return  # identical — no change
            changes["overwritten"].append(label)
            if not dry_run:
                path.write_text(content)
        else:
            changes["added"].append(label)
            if not dry_run:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content)

    def copy_file(src: Path, dst: Path, label: str) -> None:
        if not src.exists():
            print(f"  [WARN] source not found: {src}")
            return
        content = src.read_text()
        write_file(dst, content, label)

    # Category 1: workspace-root universals
    for fname in UNIVERSAL_FILES:
        # image-gen.instructions.md only goes to image-gen repo
        if fname == "image-gen.instructions.md" and alias != "image-gen":
            continue
        src = WORKSPACE_ROOT_INSTRUCTIONS / fname
        dst = instructions_dir / fname
        copy_file(src, dst, fname)

    # image-gen.instructions.md: add to image-gen repo
    if alias == "image-gen":
        src = WORKSPACE_ROOT_INSTRUCTIONS / "image-gen.instructions.md"
        dst = instructions_dir / "image-gen.instructions.md"
        copy_file(src, dst, "image-gen.instructions.md")

    # Category 2: ugwtf-workflow per-repo remix
    ugwtf_dst = instructions_dir / "ugwtf-workflow.instructions.md"
    write_file(ugwtf_dst, generate_ugwtf_workflow(repo), "ugwtf-workflow.instructions.md")

    # Category 3a: fsd-architecture for nextjs repos
    if alias in FSD_REPOS and not (instructions_dir / "fsd-architecture.instructions.md").exists():
        fsd_dst = instructions_dir / "fsd-architecture.instructions.md"
        # Use existing file from gold-standard if available, else generate
        src_043 = WORKSPACE / "one4three-co-next-app" / ".github" / "instructions" / "fsd-architecture.instructions.md"
        if alias == "oros" or not src_043.exists():
            write_file(fsd_dst, generate_fsd_architecture(repo), "fsd-architecture.instructions.md")
        else:
            copy_file(src_043, fsd_dst, "fsd-architecture.instructions.md")

    # Category 3b: testing-instructions for repos missing it
    testing_dst = instructions_dir / "testing-instructions.md"
    if alias not in TESTING_ALREADY_HAVE and not testing_dst.exists():
        write_file(testing_dst, generate_testing_instructions(repo), "testing-instructions.md")

    return {"alias": alias, "skipped": False, "changes": changes}


def main():
    parser = argparse.ArgumentParser(description="Sync 30x instruction baseline to all repos")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    parser.add_argument("--repo", help="Target a single repo by alias")
    args = parser.parse_args()

    target_repos = REPOS
    if args.repo:
        target_repos = [r for r in REPOS if r["alias"] == args.repo]
        if not target_repos:
            print(f"Unknown repo alias: {args.repo}")
            sys.exit(1)

    print(f"{'[DRY RUN] ' if args.dry_run else ''}Syncing 30x instruction baseline across {len(target_repos)} repo(s)...\n")

    total_added = 0
    total_overwritten = 0
    results = []

    for repo in target_repos:
        result = sync_repo(repo, args.dry_run)
        results.append(result)
        if result.get("skipped"):
            print(f"  SKIP  {repo['alias']}: {result['reason']}")
            continue
        c = result["changes"]
        added = len(c["added"])
        overwritten = len(c["overwritten"])
        total_added += added
        total_overwritten += overwritten
        if added or overwritten:
            status = f"+{added} added, ~{overwritten} overwritten"
            print(f"  OK    {repo['alias']} ({repo['framework']}) — {status}")
            for f in c["added"]:
                print(f"         + {f}")
            for f in c["overwritten"]:
                print(f"         ~ {f}")
        else:
            print(f"  --    {repo['alias']} — no changes")

    print(f"\nTotal: {total_added} added, {total_overwritten} overwritten across {len(target_repos)} repos")
    if args.dry_run:
        print("\n[DRY RUN] No files were written.")


if __name__ == "__main__":
    main()
