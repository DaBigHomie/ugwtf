---
name: problem-record-creation
description: >
  Capture, root-cause, route, and persist an ITSM Problem Record (PRM) when something
  goes wrong. Trigger on "problem record", "create a problem record", "PRM", "post-incident",
  "postmortem", "root cause", "known error", "data loss", "incident writeup", "ITSM problem",
  "log this problem", "we had an outage", "we had an incident", "this keeps happening", or
  whenever an incident needs to be captured, root-caused, and routed to remediation. A Problem
  Record addresses the underlying/recurring CAUSE (ITIL4 Problem Management) — distinct from a
  one-off Incident ticket that just restores service. Use this whenever a failure should not be
  allowed to recur silently. Composes the optional multi-model-task-assignment skill to route
  remediation; degrades gracefully to a plain task list if that module is absent.
---

# problem-record-creation

Turn an incident into a durable, actionable **Problem Record (PRM)** in CORTEX
(`cortex_problems`), root-caused and routed to remediation, mapped to COBIT 2019 /
ISO 27001 / ISO 42001.

**Why this exists:** an Incident ticket restores service and is forgotten. A *Problem*
Record captures the underlying cause so the same failure cannot recur silently. The
value is not the postmortem prose — it is the **package**: the narrative + the evidence
(paths, queries, verdicts) + the memory it writes + the MCPs it touched + the remediation
plan, persisted where the next session will recall it. That package is what makes the fix
*routable* and the cause *non-recurring*.

A PRM is for the *recurring/underlying* cause. If you just need to restore service once,
that is an Incident, not a Problem — but if you find yourself fixing the same class of thing
twice, write a PRM.

---

## When to use vs. not

- **Use** when: data loss, an outage, a repeated failure, a near-miss worth preventing, a
  governance finding, or any incident where the *cause* (not just the symptom) needs to be
  recorded and fixed so it does not recur.
- **Do not use** for: a routine one-off fix with no recurrence risk (that is an Incident),
  or for a feature/task (use the normal CORTEX task flow).

---

## Inputs the skill expects

- The incident narrative (from the live conversation, or a handoff/brief).
- Evidence: file paths, SQL queries + verdicts, advisor output, blast-radius facts.
- Optional: a markdown record doc to validate frontmatter on before upsert.

---

## Workflow — the packaging pattern (the heart of the skill)

Follow these in order. They are a *method*, not rigid MUSTs — explain the *why* as you go.

### 1. Capture context
Pull from (a) the live conversation, (b) CORTEX (`cortex_knowledge`, prior `cortex_handoffs`,
related `cortex_tasks`), and (c) relevant MCP state (e.g. Supabase advisors for a DB incident,
git for what survived). A PRM is a *package* — gather the narrative, the evidence, the memory
it should write, the MCPs it touched, and the seed of the remediation plan. Capturing context
*is* the discipline whose absence usually caused the incident in the first place.

### 2. Record
Assign the next `PRM-NNNN` id. Write: `title`, `summary` (narrative), `impact` (blast radius —
who/what is affected, with counts), `root_cause`, `known_error`, `workaround`. Author a
human-readable record doc with **forge-knowledge-base frontmatter** (`title, doc_type, repo,
session_id, created, status, tags`) and run:

```bash
npx tsx scripts/validate_frontmatter.mts <record.md>
```

### 3. Root-cause (5-whys)
Drive from symptom to underlying cause. Name the **known error** explicitly (the proven
defect + its trigger condition). Decide whether **AI-impact** applies (an AI agent/model caused
or amplified the harm) — if so, ISO 42001 AIMS / the G10 Continuous AI Impact gate is in scope.

### 4. Route remediation — [OPTIONAL MODULE: multi-model-task-assignment]
Each remediation item needs an owner. **If the `multi-model-task-assignment` skill is
available**, invoke it to compute blast radius and assign each task to a model + MAXIMUS agent
(1–580) + cluster (1–34) + swarm (A/B/C/D/E/GOV). **If it is absent**, degrade gracefully:
produce a plain task list (id, description, priority, a one-line owner guess) and add a note
`"routing: multi-model-task-assignment unavailable — manual assignment"`. Either way, persist
the items into `cortex_problems.remediation_tasks` and (where tracked) as `cortex_tasks`.

> Loose coupling: never hard-fail because the optional module is missing. Check, compose if
> present, fall back if not.

### 5. Persist
Upsert the record to `cortex_problems` (service-role):

```bash
npx tsx scripts/create_problem_record.mts --spec=<problem.json> --doc=<record.md>
```

Then write a **memory** entry (type `feedback` or `project`) summarizing the known error so
future sessions recall it, and run an ANVIL checkpoint:

```bash
npx tsx ../.agent-kb/anvil/checkpoint.mts --task=<TASK-ID> --status=complete
```

### 6. Map to framework
Fill `framework_mapping`:
- **COBIT 2019** — DSS03 (Problem Management), DSS04 (Continuity) for data-loss/availability.
- **ISO/IEC 27001 Annex A** — pick the controls the incident actually implicates (e.g. A.8.13
  backup, A.5.26 incident response, A.5.30 ICT continuity, A.8.10 information deletion).
- **ISO/IEC 42001** — only if AI-impact applies.

### 7. Track to closure
Lifecycle: `open → investigating → known_error → resolved → closed`. Set `resolved_at` when the
remediation lands. A PRM is not done at "documented" — it is done when the known error is fixed
or a permanent control exists, and the table proves it.

---

## Files

```
problem-record-creation/
  SKILL.md                          # this file
  scripts/
    lib/cortex-client.mts           # portable service-role Supabase client (CORTEX project)
    create_problem_record.mts       # validate + upsert a PRM to cortex_problems
    validate_frontmatter.mts        # check a record doc against the forge-kb ingestion schema
    backup-transcripts.mts          # layered transcript backup (iCloud + Supabase + --git index)
    disk-report.mts                 # VD/disk usage report + prune candidates
  references/
    itsm-problem-management.md      # ITIL4/ISO20000 practice + COBIT/ISO27001/42001 mapping
    cortex-schema.md                # cortex_problems / cortex_session_backups columns + examples
    packaging-pattern.md            # how a PRM packages skills+memory+MCP+context into a solution
```

## Guardrail (the missing precondition that causes data-loss incidents)

Before any archive/delete of a session transcript, run the guardrail and refuse on BLOCKED:

```bash
npx tsx scripts/assert-backed-up.mts --cli-session-id=<uuid>
# or --bridge-session-id=<session_01...> | --title="<title>"
```

Exit 0 (`OK: backup exists ...`) is the only signal that a delete is safe. Exit 1
(`BLOCKED: no cortex_session_backups row ...`) means no backup exists — do NOT archive or
delete; run `scripts/backup-transcripts.mts` (the producer) first, then re-check. A query
error also aborts (it must never be read as "no backup", which would greenlight a delete on
an infra outage). Enforce this precondition — a documented-but-unrun note is what caused the
prior data-loss incident. This guardrail is itself a remediation that a PRM should route and
verify.
