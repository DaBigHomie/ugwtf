#!/usr/bin/env npx tsx
/**
 * advance-chain.mts — Advance the prompt chain to the next open position
 *
 * Usage:
 *   npx tsx scripts/advance-chain.mts <path-to-prompt-chain.json> [--dry-run]
 *
 * Logic:
 *   1. Reads prompt-chain.json
 *   2. Finds closed issues (via `gh issue view`)
 *   3. Identifies the next open issue whose dependencies are resolved
 *   4. Posts a context comment and assigns Copilot
 *
 * Example:
 *   npx tsx scripts/advance-chain.mts projects/o43/prompt-chain.json --dry-run
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

interface ChainEntry {
  position: number;
  prompt: string;
  file: string;
  wave: number;
  severity: string;
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

const args = process.argv.slice(2);
const configPath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

if (!configPath) {
  console.error('Usage: npx tsx scripts/advance-chain.mts <path-to-prompt-chain.json> [--dry-run]');
  process.exit(1);
}

const config: ChainConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

// Check which issues are closed
function isIssueClosed(repo: string, issueNum: number): boolean {
  try {
    const result = execSync(
      `gh issue view ${issueNum} --repo "${repo}" --json state --jq '.state'`,
      { encoding: 'utf-8', timeout: 15000 }
    ).trim();
    return result === 'CLOSED';
  } catch {
    return false;
  }
}

console.log(`\nRepo: ${config.repo}`);
console.log(`Chain entries: ${config.chain.length}`);
console.log(`Dry run: ${dryRun}\n`);

// Find entries with issues
const withIssues = config.chain.filter(e => e.issue !== null);
if (withIssues.length === 0) {
  console.error('No issues created yet. Run create-chain-issues.mts first.');
  process.exit(1);
}

// Check closed status
console.log('Checking issue states...');
const closedSet = new Set<string>();
for (const entry of withIssues) {
  if (isIssueClosed(config.repo, entry.issue!)) {
    closedSet.add(entry.prompt);
    console.log(`  ✅ ${entry.prompt} (#${entry.issue}) — CLOSED`);
  } else {
    console.log(`  ⏳ ${entry.prompt} (#${entry.issue}) — OPEN`);
  }
}

// Find next advanceable entry
const sorted = [...config.chain].sort((a, b) => a.position - b.position);
let nextEntry: ChainEntry | undefined;

for (const entry of sorted) {
  if (entry.issue === null) continue;
  if (closedSet.has(entry.prompt)) continue;

  // Check dependencies
  const depsResolved = entry.depends.every(d => closedSet.has(d));
  if (depsResolved) {
    nextEntry = entry;
    break;
  }
}

if (!nextEntry) {
  console.log('\n🎉 All chain entries completed or no advanceable entry found!');
  process.exit(0);
}

console.log(`\n🔄 Next: ${nextEntry.prompt} (pos ${nextEntry.position}, issue #${nextEntry.issue})`);

if (dryRun) {
  console.log('  [DRY] Would assign Copilot and add automation:in-progress label');
  process.exit(0);
}

// Post context comment
const depsList = nextEntry.depends.length > 0
  ? nextEntry.depends.map(d => {
      const dep = config.chain.find(e => e.prompt === d);
      return dep?.issue ? `- ✅ #${dep.issue} (${d}) — resolved` : `- ${d}`;
    }).join('\n')
  : '_None_';

const comment = [
  `## 🤖 Chain Advancement — Position ${nextEntry.position}`,
  '',
  `**Prompt**: \`${nextEntry.prompt}\``,
  `**File**: \`${nextEntry.file}\``,
  '',
  '### Resolved Dependencies',
  depsList,
  '',
  '### Instructions',
  `Read \`${nextEntry.file}\` and implement all changes described.`,
  '',
  '---',
  '_Advanced by UGWTF chain management_',
].join('\n');

try {
  execSync(
    `gh issue comment ${nextEntry.issue} --repo "${config.repo}" --body "${comment.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', timeout: 15000 }
  );
  console.log(`  Posted context comment on #${nextEntry.issue}`);
} catch (err) {
  console.error(`  WARNING: Could not post comment: ${err instanceof Error ? err.message : String(err)}`);
}

try {
  execSync(
    `gh issue edit ${nextEntry.issue} --repo "${config.repo}" --add-label "automation:in-progress"`,
    { encoding: 'utf-8', timeout: 15000 }
  );
  console.log(`  Added automation:in-progress label to #${nextEntry.issue}`);
} catch (err) {
  console.error(`  WARNING: Could not add label: ${err instanceof Error ? err.message : String(err)}`);
}

console.log('\nDone. Chain advanced.');
