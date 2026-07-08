---
name: plan-audit-fix
version: "1.1.0"
updated: 2026-07-07
canonical_basis: documentation-standards/skills/plan-audit-fix/SKILL.md
description: >-
  Two-phase doc remediation — (1) 50x reconciliation PLAN against git SSOT and
  peer handoffs, then (2) audit-fix-plan inline fixes. Use when the user says
  "create plan then audit-fix", "plan and audit-fix", "plan-audit-fix pass", or
  when a doc may drift from origin/main or conflict with another agent's closeout.
disable-model-invocation: true
---

# plan-audit-fix

Orchestrator skill — run **`/plan-audit-fix`** before **`/audit-fix-plan`**. Phase 1
reconciles git SSOT and PAC placement; Phase 2 delegates inline audit + fix.

**Changelog label:** *"plan-audit-fix pass complete"* = this skill was invoked (not a
separate artifact type).

## Path resolution (portable)

```bash
: "${MGMT_ROOT:?export MGMT_ROOT to workspace sibling-clones root}"
```

| Resource | Resolve order |
|----------|---------------|
| **This skill (Tier 1)** | `$MGMT_ROOT/documentation-standards/skills/plan-audit-fix/SKILL.md` |
| **audit-fix-plan (Phase 2)** | Repo profile `skills.audit_fix_plan` (e.g. O43) → `~/.claude/skills/audit-fix-plan/SKILL.md` |
| **WARDEN doc-place** | `$MGMT_ROOT/documentation-standards/scripts/warden-doc-place.mts` |
| **Owning repo** | Target doc frontmatter `repo:` or session primary repo |

---

## Phase 1 — PLAN (50x reasoning)

Run **read-only** unless the user explicitly assigns writes.

### 1.1 Ground truth (mandatory)

```bash
git fetch origin
git log origin/main -1 --oneline
git worktree list
git status -sb
```

| Check | Rule |
|-------|------|
| SSOT | **`origin/main` SHA** — never assume primary tree `main` is current |
| Worktrees | One lane per agent; **no** `checkout` / `reset` on shared trees |
| Locked lanes | Respect hook-locked worktree paths declared in session handoff or `.cortex-boot.json` |

### 1.2 Conflict scan (forensic-auditing + PAC doc-place)

Resolve `{owning-repo}` from target doc frontmatter `repo:` or current session primary repo.

| Source | Action |
|--------|--------|
| Target doc claims | List `version`, `doc_type`, `repo`, dates, counts from frontmatter |
| `origin/main` code | `git show origin/main:<path>` — FSD under `src/features/*`; never assume local tree |
| Peer plans | `{owning-repo}/docs/plans/*.md` — verify SCOPED-NAME + `repo:` match |
| Cross-repo plans | `$MGMT_ROOT/documentation-standards/docs/plans/*.md` — only when frontmatter names 2+ repos or workspace substrate |
| Peer handoffs | `{owning-repo}/docs/handoffs/` or legacy `{owning-repo}/docs/context-manifests/` — **`doc_type: handoff`** only |
| Session artifact index | `{owning-repo}/docs/session-artifacts/{YYYY-MM-DD}_{slug}/` — scoped folder, not flat unscoped paths |
| Agent session blobs | `{owning-repo}/docs/agent-sessions/{uuid}/artifacts/` — raw subagent output; not CORTEX body |
| Architecture / Solution / Spec peers | `{owning-repo}/docs/{SYSTEM}-ARCHITECTURE.md`, `-SOLUTION.md`, `-SPEC.md` — flat `docs/` per DOC-TYPE-RUBRIC |
| Active scope / prompts | `{owning-repo}/docs/active/`, `docs/prompts/{active,pending,completed}/` |
| Cross-repo charters | `$MGMT_ROOT/documentation-standards/docs/PRIME-*.md` — CANON hub only |
| CORTEX | `.cortex-boot.json` tasks + `doc:{repo}:{system}` pointers — index only, no body mirror |
| Merged PRs | PR body links — flag if plan path outside `{owning-repo}/docs/plans/` |

**Flag:** misplacement (PAC), name ≠ behavior, filename assumptions, stale counts, ignored git
HEAD, FSD layer mismatch, Tier 3 duplicate law.

**Do NOT scan** repo-specific filenames as global patterns (e.g. legacy `AGENT-HANDOFF-PLAN.md`,
`*-DELEGATION-PLAN.md`) — use path patterns above.

### 1.3 Blast radius (forecast-scrutiny)

| Dimension | Question |
|-----------|------------|
| Git | Which worktree/branch owns the fix PR? |
| Downstream docs | What links/manifests will drift? (`doc-forensic-inventory`) |
| Code vs doc | Docs-only or does code need a separate lane? |
| Owner locks | Declared phase/workstream authority in peer handoff or placement record? |
| Hub strays | App-scoped doc in `documentation-standards/docs/` when `repo:` ≠ `documentation-standards`? |

### 1.4 PLAN output (required before Phase 2)

Emit a short plan block (chat or temp note):

```markdown
## PLAN — {target}

**SSOT:** origin/main @ `{sha}`
**Owning repo:** {repo from frontmatter}
**Conflicts:** {list or NONE}
**Misplacement flags:** {PAC violations or NONE}
**Remediation scope:** {sections to edit}
**Out of scope:** {code fixes deferred}
**Publish lane:** {worktree branch for PR}
**DAG:** {blockers}
```

Wait for user go-ahead only if they asked for plan-only; otherwise proceed to Phase 2.

---

## Phase 2 — audit-fix-plan

Read and follow **`audit-fix-plan`** (resolve via repo profile `skills.audit_fix_plan`, fallback
`~/.claude/skills/audit-fix-plan/SKILL.md`):

1. Read target file completely
2. Apply: `forensic-auditing`, `forecast-scrutiny`, `doc-forensic-inventory`, `supabase-postgres-best-practices` (inline if unavailable)
3. Add `> [!WARNING]` / `> [!IMPORTANT]` at each risk
4. Execute remediation on target — **no unresolved findings**
5. Bump doc version + **Change Log** row
6. Add appendix row if audit was substantial

### Post-fix verify

```bash
: "${MGMT_ROOT:?export MGMT_ROOT}"

# doc-place on the owning repo's docs tree (adjust path to target repo)
npx tsx "$MGMT_ROOT/documentation-standards/scripts/warden-doc-place.mts" docs/ --json
```

For cross-repo targets, run from the owning repo root or pass the repo-relative `docs/` path.
Docs-only repos (`documentation-standards`) — no tsc/build gates; MALFIG doc-place only.

---

## Dependency chain

```
plan-audit-fix (this skill)
  → audit-fix-plan
      → doc-forensic-inventory (drift)
      → forecast-scrutiny (blast radius)
      → forensic-auditing (git SSOT + PAC placement)
      → supabase-postgres-best-practices (SQL sections only)
  → audit-fix-ship (optional — governed PR ship)
```

---

## Anti-patterns

| Do not | Do instead |
|--------|------------|
| audit-fix before checking `origin/main` | Phase 1 PLAN first |
| Fix routes/counts from memory | `git show origin/main:<path>` |
| Commit from dirty primary tree | Worktree PR per handoff rules |
| Write repo-scoped plans to hub `docs/plans/` | `{owning-repo}/docs/plans/{SCOPED-NAME}.md` |
| Use `doc_type: context-manifest` on new handoffs | `doc_type: handoff` |
| Scan ATB-only filenames as global SSOT | PAC path patterns in §1.2 |

---

## Example invocation

User: "Audit-fix the governance plan — reconcile with latest handoff, then fix in place"

1. **PLAN:** fetch, resolve `{owning-repo}` from target frontmatter, scan
   `{owning-repo}/docs/handoffs/` (or legacy `context-manifests/`) + `{owning-repo}/docs/plans/`,
   diff claims vs `origin/main`
2. **audit-fix-plan:** edit target doc → bump version + Change Log
3. **Verify:** `warden-doc-place.mts` on owning repo `docs/` — 0 blockers

---

## Governance references

- PAC placement: `maximus-ai/docs/prime-governance/PRIME-PLACEMENT-ASSIGNMENT-CHARTER.md`
- Doc types: `documentation-standards/docs/DOC-TYPE-RUBRIC.md`
- Artifacts: `maximus-ai/docs/agent-docs/ARTIFACTS-DIRECTIVE.md`
