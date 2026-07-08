---
name: study-guide-to-quiz
description: Convert any five-part study guide (docx/txt) into a self-contained, Pearson VUE / ATI styled multiple-choice exam app with answer feedback, per-question rationales, and a "Why this is tested" (Teacher Trick + ATI/NCLEX Trick) expander. Use when the user uploads a study guide or says "make me a quiz", "turn this into an NCLEX/ATI exam", "convert study guide to multiple choice", "make a practice test", "Pearson VUE quiz", or "ATI test screen". Pairs with multi-model-task-assignment for routing item generation to the NCLEX/ATI/Pearson VUE clusters.
---

# study-guide-to-quiz

Turn a study guide into a clickable, exam-styled practice test. The output is a single
standalone `.html` file (no server, works offline, light/dark host) plus a `.json` of the
parsed items.

## When to use
- User uploads a `.docx`/`.txt` study guide and wants to practice, OR
- User asks for an "NCLEX quiz", "ATI test", "Pearson VUE screen", "practice exam",
  "multiple choice app" from existing material.

## Source format this skill reads
The house five-part method, per sub-topic:
```
N.  Topic
N.M Subtopic
Core Concept: ...
Why (Rationale): ...
Teacher Trick: ...
ATI/NCLEX Trick: ...
Practice
Qn. <stem>
A. ...  B. ...  C. ...  D. ...   (2–5 options)
Answer: <letter>. <text>
Rationale: ...
```
The parser is tolerant: missing tricks just hide the "Why this is tested" expander; 2–5
options are accepted; topics without sub-numbers still group.

## How to run
1. Locate the source file the user provided (ask if ambiguous; default to the most recent
   `.docx` in `~/Downloads`).
2. Convert (TypeScript / `.mts` — MALFIG-compliant):
   ```bash
   npx tsx scripts/convert.mts "<path to guide.docx>" "<out.html>" --title "<exam title>"
   ```
   (`.docx` text is extracted via `unzip -p`; no npm dependency added.)
   - Output `.html` is the playable exam; a sibling `.json` holds the parsed items.
   - The script prints a per-topic question count — relay it to the user.
3. Preview: render the `<body>` fragment of the generated HTML inline with
   `mcp__visualize__show_widget` (title = snake_case exam name) so the user can click
   through it. Open on **question 1** (the exam screen is the opening).
4. Deliver the standalone `.html` with `SendUserFile` and copy it to `~/Downloads`.

## What the exam app includes
- Pearson VUE / ATI testing chrome: blue header, candidate + countdown clock, "Question X of Y",
  Flag for Review, progress bar, Calculator/Previous/Next footer.
- Radio-style options; on answer it locks, marks correct (green) / your wrong pick (red),
  and shows the item rationale.
- "Why this is tested" expander folding in the Teacher Trick + ATI/NCLEX Trick.
- Topic filter to drill one clinical area; scored results screen with per-topic breakdown.

## Item generation / routing (optional)
To *generate new* items (not just convert existing ones) or to scale across many guides,
route through `multi-model-task-assignment` using the exam clusters/swarms/agents defined in
`reference/nclex-ati-pvue-taxonomy.md`:
- New NGN/alternate-format item authoring → Cluster 35 (NCLEX Item Engineering), Swarm EXAM.
- Rationale + Teacher/ATI trick extraction → Cluster 36 (ATI Content Mastery).
- Exam UI fidelity, CAT logic, proctoring → Cluster 37 (Pearson VUE Delivery & CAT).
Seed those rows with `reference/seed-taxonomy.sql` (CORTEX DB `eccpracfbrocmkzuogec`).

## Files
- `scripts/convert.mts` — parser + Pearson/ATI HTML generator (self-contained template; `.mts`).
- `reference/nclex-ati-pvue-taxonomy.md` — clusters 35–37, Swarm EXAM, agents 581–600.
- `reference/seed-taxonomy.sql` — ready-to-run CORTEX seed for the taxonomy.
