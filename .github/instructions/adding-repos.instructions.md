---
applyTo: "**/ugwtf/src/config/**"
---

# Adding Repos — Quick Reference

## RepoConfig Interface (src/config/repo-registry.ts)

```ts
interface RepoConfig {
  slug: string;                    // "Owner/repo-name"
  alias: string;                   // CLI shorthand
  framework: 'vite-react' | 'nextjs' | 'node';
  supabaseProjectId: string | null;
  supabaseUrlSecret: string | null;
  supabaseServiceKeySecret: string | null;
  supabaseTypesPath: string | null;
  nodeVersion: string;
  defaultBranch: string;
  hasE2E: boolean;
  e2eCommand: string | null;
  extraLabels: LabelDef[];
  localPath: string;
}
```

## Steps

1. Add entry to `REPOS` in `src/config/repo-registry.ts`
2. Create `projects/{alias}/README.md` (1-line description)
3. Generate `.instructions.md` for the target repo using `templates/ugwtf-workflow.instructions.md`
4. Run `npx tsc --noEmit && npx vitest run` to validate

## Scaffold Command

```bash
npx tsx src/index.ts new-repo <alias> --slug Owner/repo --framework nextjs
```

Generates config entry + project dir + instructions template.
