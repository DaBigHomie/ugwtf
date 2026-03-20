#!/usr/bin/env npx tsx
/**
 * Generate 40 .prompt.md files + scripts/prompt-chain.json
 * for the UGWTF self-publish pipeline (dogfooding the chain system).
 *
 * Usage: npx tsx scripts/generate-publish-chain.mts
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const PROMPTS_DIR = join(ROOT, 'docs', 'agent-prompts', 'publish-chain');

// ---------------------------------------------------------------------------
// Task definitions — extracted from docs/40X-PUBLISH-PLAN.md
// ---------------------------------------------------------------------------

interface Task {
  id: number;
  title: string;
  priority: string;  // P0-P3
  wave: number;
  depends: number[]; // task IDs
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  files: string[];
  commands: string[];
  verify: string;
}

const tasks: Task[] = [
  // Wave 1: Build Hygiene (BLOCKING)
  {
    id: 1, title: 'Exclude test files from tsconfig', priority: 'P0', wave: 1,
    depends: [], severity: 'critical',
    description: 'Add *.test.ts and __mocks__/ to tsconfig.json exclude array to prevent 40 test files from being compiled into dist/, bloating tarball by ~400 KB.',
    files: ['tsconfig.json'],
    commands: ['Edit tsconfig.json exclude array'],
    verify: 'npm run build && find dist -name "*.test.*" | wc -l → 0',
  },
  {
    id: 2, title: 'Remove __mocks__ from dist', priority: 'P0', wave: 1,
    depends: [1], severity: 'critical',
    description: 'Verify dist/__mocks__/ no longer exists after tsconfig fix. Mock files (github.js, logger.js) must not ship to production users.',
    files: ['tsconfig.json'],
    commands: ['Covered by Task 1 tsconfig exclude'],
    verify: 'ls dist/__mocks__/ 2>/dev/null → "No such file or directory"',
  },
  {
    id: 3, title: 'Rebuild dist after tsconfig fix', priority: 'P0', wave: 1,
    depends: [1, 2], severity: 'critical',
    description: 'Clean rebuild to verify test files and mocks are excluded from dist/. Target: ~600 KB dist (down from 1.2 MB).',
    files: ['dist/'],
    commands: ['npm run build', 'find dist -name "*.test.*" | wc -l', 'du -sh dist'],
    verify: 'find dist -name "*.test.*" | wc -l → 0 && find dist -name "__mocks__" | wc -l → 0',
  },
  {
    id: 4, title: 'Verify tests still pass after tsconfig change', priority: 'P0', wave: 1,
    depends: [3], severity: 'critical',
    description: 'Vitest uses its own config (vitest.config.ts), not tsconfig — but must confirm all 383 tests still pass and TypeScript reports 0 errors.',
    files: ['vitest.config.ts'],
    commands: ['npx vitest run', 'npx tsc --noEmit'],
    verify: 'npx vitest run → 383 passed, 20 files && npx tsc --noEmit → 0 errors',
  },
  {
    id: 5, title: 'Run npm publish dry run post-rebuild', priority: 'P0', wave: 1,
    depends: [4], severity: 'critical',
    description: 'Verify tarball size reduced to ~80 KB compressed / ~95 files, with NO test files in listing.',
    files: ['package.json'],
    commands: ['npm publish --dry-run 2>&1 | head -30', 'npm pack --dry-run 2>&1 | tail -20'],
    verify: 'File count ~95, compressed size ~80 KB, NO test files in listing',
  },

  // Wave 2: Dependency Resolution (BLOCKING)
  {
    id: 6, title: 'Decide audit-orchestrator strategy', priority: 'P0', wave: 2,
    depends: [], severity: 'critical',
    description: 'Decision: Publish @dabighomie/audit-orchestrator separately (Option A). External users cannot resolve file: protocol dependencies.',
    files: ['package.json'],
    commands: ['Decision already made: Option A — publish separately'],
    verify: 'N/A — decision task',
  },
  {
    id: 7, title: 'Publish @dabighomie/audit-orchestrator', priority: 'P0', wave: 2,
    depends: [6], severity: 'critical',
    description: 'Publish audit-orchestrator v1.1.0 to npm as a separate public package. Has dist/ already built and prepublishOnly script.',
    files: ['packages/audit-orchestrator/package.json'],
    commands: ['cd packages/audit-orchestrator', 'npm publish --dry-run', 'npm publish --access public'],
    verify: 'npm info @dabighomie/audit-orchestrator → shows version 1.1.0',
  },
  {
    id: 8, title: 'Update ugwtf dependency from file: to version', priority: 'P0', wave: 2,
    depends: [7], severity: 'critical',
    description: 'Change audit-orchestrator from "file:./packages/audit-orchestrator" to "^1.1.0" in package.json dependencies.',
    files: ['package.json'],
    commands: ['Edit package.json dependencies'],
    verify: 'grep "file:" package.json | wc -l → 0',
  },
  {
    id: 9, title: 'Clean install to verify external resolution', priority: 'P0', wave: 2,
    depends: [8], severity: 'critical',
    description: 'Remove node_modules and package-lock.json, fresh install to verify audit-orchestrator resolves from npm registry.',
    files: ['package.json', 'package-lock.json'],
    commands: ['rm -rf node_modules package-lock.json', 'npm install', 'npx tsc --noEmit', 'npx vitest run'],
    verify: 'npm install succeeds && npx tsc --noEmit → 0 errors && npx vitest run → 383 passed',
  },
  {
    id: 10, title: 'Update monorepo.test.ts for registry dependency', priority: 'P0', wave: 2,
    depends: [8], severity: 'critical',
    description: 'Update test that checks file: dependency to verify ^1.1.0 instead. Keep structure/type-contract/build-artifacts/exports/runtime tests intact.',
    files: ['src/monorepo.test.ts'],
    commands: ['Edit monorepo.test.ts'],
    verify: 'npx vitest run src/monorepo.test.ts → all pass',
  },

  // Wave 3: Package Metadata (BLOCKING)
  {
    id: 11, title: 'Add repository field to package.json', priority: 'P0', wave: 3,
    depends: [], severity: 'critical',
    description: 'Add repository, bugs, and homepage fields to package.json for npm page linking.',
    files: ['package.json'],
    commands: ['Edit package.json — add repository, bugs, homepage'],
    verify: 'grep "repository" package.json → present',
  },
  {
    id: 12, title: 'Add engines field to package.json', priority: 'P1', wave: 3,
    depends: [], severity: 'high',
    description: 'Add engines.node >= 20.0.0 to package.json so users know minimum Node version.',
    files: ['package.json'],
    commands: ['Edit package.json — add engines field'],
    verify: 'grep "engines" package.json → present',
  },
  {
    id: 13, title: 'Run npm pkg fix', priority: 'P2', wave: 3,
    depends: [], severity: 'medium',
    description: 'Fix npm publish warning about bin[ugwtf] script name being cleaned.',
    files: ['package.json'],
    commands: ['npm pkg fix', 'git diff package.json'],
    verify: 'npm publish --dry-run 2>&1 | grep -i "cleaned" | wc -l → 0',
  },
  {
    id: 14, title: 'Verify templates/ is in files array', priority: 'P2', wave: 3,
    depends: [], severity: 'medium',
    description: 'Confirm templates/ugwtf-workflow.instructions.md will be included in tarball via files array.',
    files: ['package.json'],
    commands: ['npm pack --dry-run 2>&1 | grep templates'],
    verify: 'npm pack --dry-run output includes templates/',
  },
  {
    id: 15, title: 'Add explicit publishConfig for scoped public access', priority: 'P2', wave: 3,
    depends: [], severity: 'medium',
    description: 'Add publishConfig.access = "public" so npm publish works without --access public flag.',
    files: ['package.json'],
    commands: ['Edit package.json — add publishConfig'],
    verify: 'grep "publishConfig" package.json → present',
  },

  // Wave 4: Legal & Compliance
  {
    id: 16, title: 'Create LICENSE file for ugwtf', priority: 'P1', wave: 4,
    depends: [], severity: 'high',
    description: 'Create MIT LICENSE file. package.json claims license: MIT but no LICENSE file exists — legally ambiguous.',
    files: ['LICENSE'],
    commands: ['Create LICENSE with MIT text, copyright 2026 DaBigHomie'],
    verify: 'cat LICENSE → MIT text present',
  },
  {
    id: 17, title: 'Create LICENSE file for audit-orchestrator', priority: 'P1', wave: 4,
    depends: [7], severity: 'high',
    description: 'Create LICENSE file for packages/audit-orchestrator/ with same MIT text.',
    files: ['packages/audit-orchestrator/LICENSE'],
    commands: ['Create packages/audit-orchestrator/LICENSE'],
    verify: 'cat packages/audit-orchestrator/LICENSE → MIT text present',
  },
  {
    id: 18, title: 'Reconcile README license section', priority: 'P2', wave: 4,
    depends: [16], severity: 'medium',
    description: 'README says "Private — DaBigHomie" in License section. Must update to MIT to match package.json and LICENSE file.',
    files: ['README.md'],
    commands: ['Update License section in README.md'],
    verify: 'grep -A2 "## License" README.md → contains "MIT"',
  },
  {
    id: 19, title: 'Verify LICENSE in npm tarball', priority: 'P3', wave: 4,
    depends: [16], severity: 'low',
    description: 'npm automatically includes LICENSE in tarball even without files array entry. Verify this is the case.',
    files: ['package.json'],
    commands: ['npm pack --dry-run 2>&1 | grep -i license'],
    verify: 'npm pack --dry-run output includes LICENSE',
  },

  // Wave 5: Documentation Accuracy
  {
    id: 20, title: 'Update AGENTS.md test count', priority: 'P1', wave: 5,
    depends: [], severity: 'high',
    description: 'Fix 3 occurrences of "272 tests across 15 test files" → "383 tests across 20 test files" in AGENTS.md.',
    files: ['AGENTS.md'],
    commands: ['sed replacements in AGENTS.md'],
    verify: 'grep "383" AGENTS.md | wc -l ≥ 3',
  },
  {
    id: 21, title: 'Update copilot-instructions.md test count', priority: 'P1', wave: 5,
    depends: [], severity: 'high',
    description: 'Fix "261+ tests" (2 occurrences) and "15 files" → "383 tests across 20 files" in .github/copilot-instructions.md.',
    files: ['.github/copilot-instructions.md'],
    commands: ['Edit copilot-instructions.md'],
    verify: 'grep "383" .github/copilot-instructions.md | wc -l ≥ 2',
  },
  {
    id: 22, title: 'Update 05-TESTING.md', priority: 'P1', wave: 5,
    depends: [], severity: 'high',
    description: 'Fix "261 tests across 15 files" → "383 tests across 20 files". Add the 5 new test files from PR #10.',
    files: ['docs/agent-guide/05-TESTING.md'],
    commands: ['Edit 05-TESTING.md'],
    verify: 'grep "383" docs/agent-guide/05-TESTING.md → present',
  },
  {
    id: 23, title: 'Update README.md test count', priority: 'P1', wave: 5,
    depends: [], severity: 'high',
    description: 'Fix "156 tests" in README.md Testing section → "383 tests across 20 files".',
    files: ['README.md'],
    commands: ['Edit README.md'],
    verify: 'grep "383" README.md → present',
  },
  {
    id: 24, title: 'Update README.md agent/cluster count', priority: 'P2', wave: 5,
    depends: [], severity: 'medium',
    description: 'Fix "~85 agents across 34 clusters" → "86 agents across 35 clusters" in README.md.',
    files: ['README.md'],
    commands: ['Edit README.md'],
    verify: 'grep "86 agents" README.md → present',
  },
  {
    id: 25, title: 'Fix AUDIT-RESULTS.json hardcoded paths', priority: 'P2', wave: 5,
    depends: [], severity: 'medium',
    description: 'Replace 5 occurrences of /Users/dame/management-git/ugwtf/src/... with relative paths src/...',
    files: ['docs/AUDIT-RESULTS.json'],
    commands: ['sed -i replacement in AUDIT-RESULTS.json'],
    verify: 'grep "/Users/" docs/AUDIT-RESULTS.json | wc -l → 0',
  },
  {
    id: 26, title: 'Update 09-GAPS.md with resolved gaps', priority: 'P2', wave: 5,
    depends: [], severity: 'medium',
    description: 'Mark the 5 test coverage gaps resolved by PR #10 in docs/agent-guide/09-GAPS.md.',
    files: ['docs/agent-guide/09-GAPS.md'],
    commands: ['Edit 09-GAPS.md — mark 5 gaps as resolved'],
    verify: 'grep "resolved" docs/agent-guide/09-GAPS.md | wc -l ≥ 5',
  },
  {
    id: 27, title: 'Update copilot-instructions stats section', priority: 'P2', wave: 5,
    depends: [], severity: 'medium',
    description: 'Align all stats in .github/copilot-instructions.md (86 agents, 35 clusters, 383 tests, 20 files).',
    files: ['.github/copilot-instructions.md'],
    commands: ['Edit copilot-instructions.md stats'],
    verify: 'grep "86 agents" .github/copilot-instructions.md → present',
  },

  // Wave 6: Publish Infrastructure
  {
    id: 28, title: 'Create CHANGELOG.md', priority: 'P2', wave: 6,
    depends: [], severity: 'medium',
    description: 'Create CHANGELOG.md documenting v1.0.0 release with all features (86 agents, 35 clusters, 23 CLI commands, etc).',
    files: ['CHANGELOG.md'],
    commands: ['Create CHANGELOG.md'],
    verify: 'cat CHANGELOG.md → contains "1.0.0"',
  },
  {
    id: 29, title: 'Create .npmignore', priority: 'P3', wave: 6,
    depends: [], severity: 'low',
    description: 'Create .npmignore as defense-in-depth — excludes src/, tests/, docs/, scripts/, packages/, etc.',
    files: ['.npmignore'],
    commands: ['Create .npmignore'],
    verify: 'cat .npmignore → excludes src/, docs/, scripts/, packages/',
  },
  {
    id: 30, title: 'Verify release.yml workflow', priority: 'P2', wave: 6,
    depends: [], severity: 'medium',
    description: 'Check .github/workflows/release.yml uses NPM_TOKEN secret and runs build before publish.',
    files: ['.github/workflows/release.yml'],
    commands: ['cat .github/workflows/release.yml'],
    verify: 'Workflow uses NPM_TOKEN and builds before publish',
  },
  {
    id: 31, title: 'Confirm version number strategy', priority: 'P2', wave: 6,
    depends: [], severity: 'medium',
    description: 'Decision confirmed: Keep v1.0.0. Package has 383 tests, proven CLI, 5 active repos — production-ready.',
    files: ['package.json'],
    commands: ['Verify version is 1.0.0'],
    verify: 'grep \'"version": "1.0.0"\' package.json → present',
  },
  {
    id: 32, title: 'Verify packages/ excluded from tarball', priority: 'P3', wave: 6,
    depends: [], severity: 'low',
    description: 'Confirm packages/ directory is NOT in npm tarball (not in files array).',
    files: ['package.json'],
    commands: ['npm pack --dry-run 2>&1 | grep packages'],
    verify: 'npm pack --dry-run output does NOT include packages/',
  },
  {
    id: 33, title: 'Verify global install flow', priority: 'P2', wave: 6,
    depends: [], severity: 'medium',
    description: 'Pre-publish: verify shebang in dist/index.js and bin entry in package.json are correct.',
    files: ['dist/index.js', 'package.json'],
    commands: ['head -1 dist/index.js', 'grep bin package.json'],
    verify: 'dist/index.js starts with #!/usr/bin/env node',
  },

  // Wave 7: Polish
  {
    id: 34, title: 'Create CLAUDE.md', priority: 'P3', wave: 7,
    depends: [], severity: 'low',
    description: 'Create CLAUDE.md for Claude Code users with quick-start pointing to AGENTS.md and docs/agent-guide/.',
    files: ['CLAUDE.md'],
    commands: ['Create CLAUDE.md'],
    verify: 'cat CLAUDE.md → contains "AGENTS.md"',
  },
  {
    id: 35, title: 'Run npm audit on dependencies', priority: 'P2', wave: 7,
    depends: [], severity: 'medium',
    description: 'Check for 0 vulnerabilities in production dependencies.',
    files: [],
    commands: ['npm audit', 'npm audit --omit=dev'],
    verify: 'npm audit → 0 vulnerabilities in production deps',
  },
  {
    id: 36, title: 'Verify dist/index.js exports', priority: 'P3', wave: 7,
    depends: [], severity: 'low',
    description: 'Verify both package.json exports paths resolve correctly: "." → dist/index.js, "./types" → dist/types.js.',
    files: ['package.json', 'dist/index.js'],
    commands: ['node -e "import(\'./dist/index.js\')"'],
    verify: 'Both export paths resolve without error',
  },
  {
    id: 37, title: 'Check for console.log in production code', priority: 'P3', wave: 7,
    depends: [], severity: 'low',
    description: 'Ensure only logger utility uses console. No stray console.log in agents/clusters source.',
    files: ['src/'],
    commands: ['grep -rn "console.log" src/ --include="*.ts" | grep -v ".test." | grep -v "__mocks__"'],
    verify: 'Only logger.ts uses console — no stray console.log',
  },
  {
    id: 38, title: 'Verify all repo configs load correctly', priority: 'P3', wave: 7,
    depends: [], severity: 'low',
    description: 'Run status command for all 6 registered repos (including ugwtf self-target) to verify config loading.',
    files: ['src/config/repo-registry.ts'],
    commands: ['npx tsx src/index.ts status ugwtf --dry-run'],
    verify: 'All 6 repo configs resolve without error',
  },

  // Wave 8: Publish
  {
    id: 39, title: 'Final pre-publish checklist', priority: 'P0', wave: 8,
    depends: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38],
    severity: 'critical',
    description: 'Run every quality gate: tsc, lint, build, vitest, publish --dry-run. Verify LICENSE, CHANGELOG, repository, engines fields, no file: deps, test files excluded.',
    files: ['package.json'],
    commands: ['npx tsc --noEmit', 'npm run lint', 'npm run build', 'npx vitest run', 'npm publish --dry-run'],
    verify: 'ALL gates green — 0 errors, 0 test files in dist, LICENSE exists, CHANGELOG exists',
  },
  {
    id: 40, title: 'npm publish v1.0.0', priority: 'P0', wave: 8,
    depends: [39], severity: 'critical',
    description: 'Tag v1.0.0, push, and publish @dabighomie/ugwtf to npm public registry.',
    files: ['package.json'],
    commands: ['git tag v1.0.0', 'git push origin main --tags', 'npm publish --access public'],
    verify: 'npm info @dabighomie/ugwtf → version 1.0.0',
  },
];

// ---------------------------------------------------------------------------
// Generate .prompt.md files (Format B — docs/agent-prompts/)
// ---------------------------------------------------------------------------

function generatePromptFile(task: Task): string {
  const depStr = task.depends.length === 0
    ? 'None — can run in parallel'
    : task.depends.map(d => `#${d}`).join(', ');

  const filesStr = task.files.length > 0
    ? task.files.map(f => `- \`${f}\``).join('\n')
    : '- N/A';

  const commandsStr = task.commands.map(c => `- \`${c}\``).join('\n');

  return `# PROMPT: Task ${task.id} — ${task.title}

**Priority**: ${task.priority}  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: ${depStr}

---

## Objective

${task.description}

---

## Files to Modify

${filesStr}

---

## Commands

${commandsStr}

---

## Success Criteria

- [ ] ${task.verify}
- [ ] TypeScript: \`npx tsc --noEmit\` → 0 errors
- [ ] Tests: \`npx vitest run\` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: \`npx tsc --noEmit\`
- [ ] Run tests: \`npx vitest run\`
- [ ] Run build: \`npm run build\`
`;
}

// ---------------------------------------------------------------------------
// Generate scripts/prompt-chain.json (ChainConfig v3)
// ---------------------------------------------------------------------------

interface ChainEntry {
  position: number;
  prompt: string;
  file: string;
  wave: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  depends: string[];
  issue: number | null;
}

interface ChainConfig {
  version: number;
  description: string;
  repo: string;
  labels: string[];
  chain: ChainEntry[];
}

function buildChainConfig(): ChainConfig {
  const chain: ChainEntry[] = tasks.map((t, i) => ({
    position: i + 1,
    prompt: `FI-${String(t.id).padStart(2, '0')}`,
    file: `docs/agent-prompts/publish-chain/${String(t.id).padStart(2, '0')}-${slugify(t.title)}.prompt.md`,
    wave: t.wave,
    severity: t.severity,
    depends: t.depends.map(d => `FI-${String(d).padStart(2, '0')}`),
    issue: null,
  }));

  return {
    version: 3,
    description: `UGWTF self-publish chain — 40 tasks across 8 waves (dogfooding validation)`,
    repo: 'DaBigHomie/ugwtf',
    labels: ['automation:copilot', 'agent:copilot', 'publish', 'dogfood'],
    chain,
  };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // 1. Create prompts directory
  mkdirSync(PROMPTS_DIR, { recursive: true });
  console.log(`✅ Created ${PROMPTS_DIR}`);

  // 2. Generate .prompt.md files
  let created = 0;
  for (const task of tasks) {
    const filename = `${String(task.id).padStart(2, '0')}-${slugify(task.title)}.prompt.md`;
    const filepath = join(PROMPTS_DIR, filename);
    const content = generatePromptFile(task);
    writeFileSync(filepath, content, 'utf-8');
    created++;
  }
  console.log(`✅ Generated ${created} .prompt.md files`);

  // 3. Generate prompt-chain.json
  const config = buildChainConfig();
  const chainPath = join(ROOT, 'scripts', 'prompt-chain.json');
  writeFileSync(chainPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`✅ Generated ${chainPath}`);

  // 4. Summary
  const waves = new Set(tasks.map(t => t.wave));
  console.log('');
  console.log('📊 Chain Summary:');
  console.log(`   Tasks: ${tasks.length}`);
  console.log(`   Waves: ${waves.size}`);
  console.log(`   Format: B (docs/agent-prompts/)`);
  console.log(`   Chain config: scripts/prompt-chain.json (v3)`);
  console.log('');
  for (const w of [...waves].sort()) {
    const waveTasks = tasks.filter(t => t.wave === w);
    const severities = waveTasks.map(t => t.severity);
    console.log(`   Wave ${w}: ${waveTasks.length} tasks (${severities[0]})`);
  }
}

main();
