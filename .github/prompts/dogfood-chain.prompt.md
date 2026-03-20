agent: true
description: "Bootstrap and validate UGWTF self-publish chain with no manual exploration"

# Dogfood Self-Publish Chain

Run the self-publish dogfood flow (hardcoded to ugwtf repo):

1. `npm run dogfood:setup`
2. `npm run dogfood:verify`
3. (Optional execution) `npm run dogfood:execute`

## Generic Chain Workflow (Any Repo)

For prompt folders in any registered repo, use the generic commands:

```bash
npm run chain:folder:verify -- <repo> --path <folder>
npm run chain:folder:run -- <repo> --verbose
```

## Rules

- Use `chain:folder:*` for any repo's prompts, `dogfood:*` for self-publish only.
- Keep `--dry-run` for verification steps when validating logic.
- If verification fails, fix root causes before execution.
