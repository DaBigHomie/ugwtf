---
name: ide-store-forensic-index
description: >-
  Deep-dive forensic index of ~/.cursor, ~/.claude, and ~/.gemini chat stores.
  Combines cross-store parallel Agent fan-out, 50x forensic auditing, and a
  structured artifact index. Use when finding prior IDE chat work, indexing
  sessions, tracing session IDs (e.g. f680d680), or locating quizzes/study
  guides/skills across stores. Triggers: "forensic index", "deep dive IDE
  sessions", "cross-store forensic", "index chat stores", "where is the Adult
  Health quiz".
---

# ide-store-forensic-index

Read-only forensic sweep + index across Cursor, Claude, and Gemini local stores.

## Claude-native procedure

### 1. Scope target

Extract session UUID, artifact filenames, topic synonyms. Apply forensic-auditing **name≠behavior** — verify snippets, reject false positives.

### 2. Deterministic scan

```bash
npx tsx ~/.cursor/skills/ide-store-forensic-index/scripts/scan.mts \
  --terms="{terms}" --session={uuid-prefix} [--json]
```

Shared script lives in Cursor skills path (machine-wide).

### 3. Parallel Agent fan-out (cheap, background)

Launch three `Agent` calls in one turn with `model: "haiku"` and `run_in_background: true`:

| Agent | Scope |
|---|---|
| Search Claude sessions | `rg -l -i '{terms}' ~/.claude/projects/ --glob '*.jsonl'` + tool-results |
| Search Cursor stores | `~/.cursor/projects/`, `~/.cursor/chats/` |
| Search Gemini brain | `~/.gemini/antigravity-ide/brain/`, conversations metadata |

Each agent: bounded rg only, no cat whole files, return path + snippet + relevance.

### 4. Forensic checks

- Trace lineage: session → subagents → tool-results → Downloads → bundles
- `ls -la` verify every artifact path
- Report zero-hit stores explicitly

### 5. Output

Structured index: session registry, artifact registry, subagent map, recommended actions.

## Anchor: Adult Health Exam 3 (f680d680)

| Artifact | Path |
|---|---|
| Transcript | `~/.claude/projects/-Users-dabighomie/f680d680-8c63-458f-ba3a-722a29d01a31.jsonl` |
| Tool results | `.../f680d680-.../tool-results/` (19 files) |
| Study guide | `~/Downloads/Adult Health 1 Exam3 MasterStudyGuide copy.docx` |
| Quiz HTML | `~/Downloads/AdultHealth1_Exam3_Quiz.html` |
| Skill | `~/.claude/skills/study-guide-to-quiz/` |
| Bundle | `~/Management Git/exported-ai-chats/imac-capture-20260701-claude-f680d680.tgz` |

## Related skills

- `forensic-auditing` — 50x rules
- `multi-model-task-assignment` — route before fan-out
- `study-guide-to-quiz` — output artifact from f680d680
