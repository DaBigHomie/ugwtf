/**
 * Scaffold: new-repo
 *
 * Generates a RepoConfig entry and project directory structure.
 *
 * Usage:
 *   ugwtf new-repo <alias> --slug Owner/repo --framework nextjs
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Framework } from '../config/repo-registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

interface NewRepoOptions {
  alias: string;
  slug: string;
  framework: Framework;
}

const VALID_FRAMEWORKS: Framework[] = ['vite-react', 'nextjs', 'node'];

function generateRepoConfig(opts: NewRepoOptions): string {
  const HOME = '${HOME}';
  const repoName = opts.slug.split('/')[1] ?? opts.alias;

  return `
  ${opts.alias}: {
    slug: '${opts.slug}',
    alias: '${opts.alias}',
    framework: '${opts.framework}',
    supabaseProjectId: null,
    supabaseUrlSecret: null,
    supabaseServiceKeySecret: null,
    supabaseTypesPath: null,
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: false,
    e2eCommand: null,
    extraLabels: [],
    localPath: \`${HOME}/management-git/${repoName}\`,
    ci: {
      lintCommand: null,
      typeCheckCommand: null,
      buildCommand: null,
      unitTestCommand: null,
      e2e: null,
    },
  },`;
}

function generateInstructionsFile(opts: NewRepoOptions): string {
  const templatePath = resolve(PROJECT_ROOT, 'templates', 'ugwtf-workflow.instructions.md');

  if (existsSync(templatePath)) {
    const template = readFileSync(templatePath, 'utf-8');
    return template.replaceAll('{{REPO_ALIAS}}', opts.alias);
  }

  // Fallback if template missing
  return `---
applyTo: "**"
---

# UGWTF Workflow Management

This repo is registered as **\`${opts.alias}\`** in the UGWTF orchestrator.

\`\`\`bash
cd ~/management-git/ugwtf
npx tsx src/index.ts audit ${opts.alias} --verbose
\`\`\`
`;
}

export function scaffoldRepo(opts: NewRepoOptions): void {
  // 1. Create project directory
  const projectDir = resolve(PROJECT_ROOT, 'projects', opts.alias);
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      resolve(projectDir, 'README.md'),
      `# ${opts.alias}\n\nManaged by UGWTF. Slug: \`${opts.slug}\`\n`,
      'utf-8',
    );
    console.log(`✅ Created ${projectDir}/README.md`);
  } else {
    console.log(`⏭️  ${projectDir} already exists`);
  }

  // 2. Generate instructions file
  const instructionsDir = resolve(projectDir, 'instructions');
  if (!existsSync(instructionsDir)) {
    mkdirSync(instructionsDir, { recursive: true });
  }
  const instructionsFile = resolve(instructionsDir, 'ugwtf-workflow.instructions.md');
  writeFileSync(instructionsFile, generateInstructionsFile(opts), 'utf-8');
  console.log(`✅ Created ${instructionsFile}`);

  // 3. Print config snippet to add manually
  console.log(`\n📋 Add this to src/config/repo-registry.ts → REPOS:\n`);
  console.log(generateRepoConfig(opts));
  console.log(`\nNext steps:`);
  console.log(`  1. Paste the config above into src/config/repo-registry.ts`);
  console.log(`  2. Copy ${instructionsFile} to the target repo's .github/instructions/`);
  console.log(`  3. Run: npx tsc --noEmit && npx vitest run`);
}

export function parseNewRepoArgs(args: string[]): NewRepoOptions | null {
  const alias = args[0];
  const slugIdx = args.indexOf('--slug');
  const slug = slugIdx >= 0 ? args[slugIdx + 1] : undefined;
  const fwIdx = args.indexOf('--framework');
  const framework = fwIdx >= 0 ? (args[fwIdx + 1] as Framework) : undefined;

  if (!alias || !slug || !framework || !VALID_FRAMEWORKS.includes(framework)) {
    console.log(`
  Usage: ugwtf new-repo <alias> --slug Owner/repo --framework <framework>

  Frameworks: ${VALID_FRAMEWORKS.join(', ')}

  Example:
    ugwtf new-repo myapp --slug DaBigHomie/my-app --framework nextjs
`);
    return null;
  }

  return { alias, slug, framework };
}
