---
applyTo: "**"
---

# File Creation Safety — Terminal-Proof Authoring

## Purpose

Prevent silent file-write failures, terminal pollution, and instruction drift when generating scripts, prompts, agents, and docs.

This rule is **mandatory** when creating or editing files in this workspace.

---

## 1) User Directives Override Everything

- If user says **"stop"**, **"don’t run terminal"**, **"no python"**, or **"no node in terminal"**:
  - Immediately stop terminal execution
  - Do not run more shell commands
  - Use file editing tools only
  - Acknowledge and proceed with non-terminal workflow

---

## 2) Never Write Large Files via Terminal

For file creation/editing, **DO NOT** use terminal-based content injection for substantial content:

- `cat <<EOF ... EOF`
- `node -e "...writeFileSync(...)"`
- `python -c "..."`
- long pipes carrying file bodies

### Threshold

- If file content is more than ~20 lines or includes template literals, regex, YAML frontmatter, or markdown fences:
  - **Always use editor file tools** (create/edit/patch)
  - Never use shell inline-content methods

---

## 3) Failure Circuit Breaker

If any file-write attempt fails or output is garbled:

1. Stop retrying same method
2. Switch method immediately to file tools
3. Do not perform a third terminal write attempt

**Max retry policy**:
- Max 2 attempts with one method
- Third attempt must be different method (file tools)

---

## 4) Terminal Pollution Handling

Symptoms: hanging prompt, `heredoc>` states, truncated output, random token noise.

Rules:
- Do not continue content-writing in polluted terminal
- Do not trust prior command success without verifying file existence via file tools
- Resume with file tools only

---

## 5) Preferred Creation Workflow (Token-Efficient + Reliable)

1. Create/update files with file editing tools directly
2. Batch related edits with patch operations
3. Use one subagent for read-only discovery if needed
4. Keep terminal for execution/verification only (unless user disabled terminal)

---

## 6) Verification Rule

After creating or editing files:

- Verify file exists using file inspection/search tools
- Verify contents using file read tools
- Do not assume shell success means write success

---

## 7) PR/Manifest Work Under Terminal Restrictions

If user requests PR/context-manifest while saying terminal is disallowed:

- Collect available state from existing workspace artifacts and tool-based file inspection
- Generate/update manifest file via file tools
- If PR creation requires terminal/CLI and is disallowed, report exact blocker and ask for one-time permission or perform metadata prep only

---

## 8) Guardrail Summary

- **Author files with file tools, not shell-injected content**
- **Respect stop/no-terminal directives immediately**
- **Switch methods after 2 failures**
- **Verify on disk using file tools**
- **No repeated terminal retries for file writing**
