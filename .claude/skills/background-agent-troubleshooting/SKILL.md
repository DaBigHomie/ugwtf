---
name: background-agent-troubleshooting
description: Spawn a background agent to run a rigorous, hypothesis-driven troubleshooting investigation of an ambiguous, cross-workstation, or reproducible-but-not-yet-understood bug — without polluting the main session's context. Use when the user says "troubleshoot", "why doesn't X work", "figure out what broke", "run a background agent to investigate", "regression across machines", or when the fault surface is wide (app logs, disk state, config, upstream vendor, version drift) and the diagnosis will take many read-only lookups. Produces a structured verdict (root cause + evidence + reproducer + ranked fixes + is-vendor-bug) — never mutates state, never a shallow "let me google it".
---

# background-agent-troubleshooting

Delegated, evidence-first bug diagnosis. Runs **in the background** so the main session
stays lean while the agent trawls logs, disk, versions, and vendor status.

**Non-negotiable stance**: read-only. Verify hypotheses against evidence. Rank fixes.
Return a report the user can act on without re-explaining the bug.

## When to invoke

Invoke this skill when ALL of the following are true:
- The symptom is reproducible or ongoing (not a one-off flake).
- The likely evidence is spread across ≥ 2 surfaces (logs + disk + version + vendor status + config).
- The main conversation should keep momentum — this investigation would otherwise eat context.
- No mutation is required to diagnose (config edits, restarts, uninstalls are OUT of scope).

Do NOT invoke for:
- A missing import or obvious stack trace already visible in the terminal — just fix it.
- Anything that needs the user to run interactive commands — ask them directly.
- Tasks that require writing/editing code — spawn a general-purpose agent instead.

## The prompt template

Send this shape to the background agent (`Agent` tool, `run_in_background: true`, `subagent_type: general-purpose` unless a more specific agent fits):

```
You are the background troubleshooting agent for <one-line summary of bug>.

## Symptoms (verbatim from user + your observation)
- <symptom 1, with exact error text / screenshot text if given>
- <symptom 2>
- Reproduces on: <all sessions / this workstation only / after date X>

## Prior context
- What was working before: <state / date>
- What changed (suspected): <version bump / config edit / upstream update>
- Any error text, log excerpt, or path already known: <verbatim>

## Hypotheses to verify OR refute (do not just agree)
1. <hypothesis 1 — mechanism, not restated symptom>
2. <hypothesis 2>
3. <hypothesis 3>

## Investigation checklist
1. **Logs** — tail 500 lines, freshest first, grep for <keywords>:
   - <path/to/log/1>
   - <path/to/log/2>
2. **Disk state** — verify <files/dirs/symlinks> exist and their type (`ls -la`, `readlink`, `git rev-parse`).
3. **App/tool version + update channel** — capture the exact version and last-updated timestamp.
4. **Config** — read (do not modify) <config paths>. Compare against defaults if known.
5. **Vendor status / known issues** — WebSearch + WebFetch:
   - vendor status page
   - github.com/<vendor>/<repo>/issues recent (last 30 days)
   - search terms: "<exact error string>", "<feature name> broken <year>"
6. **Cross-workstation angle** — if bug reproduces on multiple machines, isolate what they share (account, cloud-synced config, vendor-side change) vs what differs (OS version, local install).

## Deliverables — return in EXACTLY this shape
- **Root cause (1 paragraph)** — the actual mechanism, not restated symptoms.
- **Evidence** — specific log lines, file paths, versions, timestamps that prove the root cause.
- **Reproducer** — exact steps to trigger the failure.
- **Fix / workaround** — ranked list, each with the one-liner command or setting change.
- **Is this a vendor bug?** yes/no + link to issue if one exists, or a draft bug-report body if not.
- **Open questions** — anything the user must answer for you to finish.

## Constraints
- Read-only. No writes, no config changes, no killing processes, no restarts.
- No `find .` from `/` or from a huge repo root without `-maxdepth` and `-not -path node_modules`.
- Do NOT propose "restart the app and see" as a fix — that's a workaround masquerading as diagnosis.
- Cap the response at ~500 words. Bullet points over prose.
```

## Runtime rules for the main session

1. **Tell the user what you launched** in one sentence, then continue useful work. Don't idle.
2. **Do not duplicate the agent's work.** Don't grep the same logs or fetch the same vendor status page from the main session — you'll waste context and the agent already has it.
3. **On completion**, relay the report structure verbatim to the user. Do NOT paraphrase root cause / evidence — that's where accuracy matters most. You may summarize the intro sentence, but the 6-section deliverable stays intact.
4. **If the agent returns with open questions**, ask the user; don't guess.
5. **If the fix requires a mutation**, propose it explicitly and wait for confirmation. This skill diagnoses; it does not remediate.

## Anti-patterns

- **Shallow "google-it" agent**: dispatching a single WebSearch call without log/disk/version checks. If the prompt has < 3 investigation surfaces, you're wasting the background slot.
- **"Just try restarting"**: not a diagnosis. Reject any agent output whose "fix" is only a restart with no mechanism.
- **Assuming = concluding**: the agent must return evidence (log line, version string, file path) — not "likely because…".
- **Silent completion**: always surface the agent's verdict to the user, even if the answer is "no root cause found, here are the next-step probes."

## Composes with

- `problem-record-creation` — if the bug turns out to be a recurring class, file a Problem Record after diagnosis.
- `forensic-auditing` — for hypothesis-generation on code-level regressions.
- `ide-store-forensic-index` — for bugs specifically in Claude Code / Cursor / Gemini chat stores.
