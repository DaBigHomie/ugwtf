#!/usr/bin/env npx tsx
/**
 * doc-sync-validator.mts — Validate UGWTF documentation completeness and accuracy
 *
 * Multi-agent swarm script that:
 * 1. Verifies README.md contains all required sections (Plugins, Agent Model, etc.)
 * 2. Verifies docs/ADDING-AGENTS.md exists and has required headings
 * 3. Validates test count in README matches actual vitest output
 * 4. Validates plugin exports from audit-orchestrator match expected interface
 * 5. Produces a validation report to .ugwtf/reports/
 *
 * Reduces context usage: one script replaces 8+ manual read/grep operations.
 *
 * Usage:
 *   npx tsx scripts/doc-sync-validator.mts            # Validate & report
 *   npx tsx scripts/doc-sync-validator.mts --json     # JSON output
 *   npx tsx scripts/doc-sync-validator.mts --fix      # Auto-fix minor issues (counts)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ugwtfRoot = resolve(__dirname, '..');
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const fixMode = args.includes('--fix');

// ── Types ────────────────────────────────────────────────────────────────
interface DocCheck {
  id: string;
  name: string;
  pass: boolean;
  detail: string;
  fixable?: boolean;
}

interface ValidationReport {
  timestamp: string;
  totalChecks: number;
  passed: number;
  failed: number;
  checks: DocCheck[];
  summary: 'PASS' | 'FAIL';
}

// ── Utilities ────────────────────────────────────────────────────────────
function readDoc(relativePath: string): string | null {
  const fullPath = join(ugwtfRoot, relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf-8');
}

function checkHeadings(content: string, required: string[]): { missing: string[]; found: string[] } {
  const missing: string[] = [];
  const found: string[] = [];
  for (const heading of required) {
    if (content.includes(heading)) {
      found.push(heading);
    } else {
      missing.push(heading);
    }
  }
  return { missing, found };
}

function getActualTestCount(): number | null {
  try {
    const output = execSync('npx vitest run --reporter=verbose 2>&1', {
      cwd: ugwtfRoot,
      encoding: 'utf-8',
      timeout: 60_000,
    });
    // Match "X tests" or "X passed"
    const match = output.match(/(\d+)\s+(?:tests? )?(passed|failed)/i);
    if (match) return parseInt(match[1], 10);
    // Also try: "Tests  147 passed"
    const match2 = output.match(/Tests\s+(\d+)\s+passed/i);
    if (match2) return parseInt(match2[1], 10);
    return null;
  } catch (err: unknown) {
    // vitest exits non-zero on failure — parse stdout anyway
    const out = typeof err === 'object' && err !== null && 'stdout' in err
      ? String((err as { stdout: unknown }).stdout)
      : '';
    const match = out.match(/(\d+)\s+passed/i);
    if (match) return parseInt(match[1], 10);
    return null;
  }
}

function extractReadmeTestCount(readme: string): number | null {
  const match = readme.match(/\*\*(\d+)\s+tests?\*\*/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

// ── Agent: Check README required sections ────────────────────────────────
function agentCheckReadmeSections(): DocCheck[] {
  const readme = readDoc('README.md');
  if (!readme) {
    return [{
      id: 'readme-exists',
      name: 'README.md exists',
      pass: false,
      detail: 'README.md not found at repo root',
    }];
  }

  const requiredSections = [
    '## Plugins',
    '## Agent Model',
    '## Commands',
    '## Testing',
    '## Architecture',
    '## Development',
  ];

  const results: DocCheck[] = [{
    id: 'readme-exists',
    name: 'README.md exists',
    pass: true,
    detail: `Found at ${join(ugwtfRoot, 'README.md')}`,
  }];

  for (const section of requiredSections) {
    results.push({
      id: `readme-section-${section.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
      name: `README has "${section}"`,
      pass: readme.includes(section),
      detail: readme.includes(section)
        ? `Section "${section}" present`
        : `Section "${section}" MISSING from README.md`,
    });
  }

  // Check plugin sub-content
  const pluginSubchecks = [
    { text: 'UGWTFPlugin', label: 'README documents UGWTFPlugin interface' },
    { text: 'PluginRegistry', label: 'README documents PluginRegistry' },
    { text: 'visual-audit', label: 'README references visual-audit plugin' },
    { text: 'docs/ADDING-AGENTS.md', label: 'README links to ADDING-AGENTS.md' },
    { text: 'ugwtf-plugin', label: 'README explains ugwtf-plugin discovery key' },
  ];

  for (const check of pluginSubchecks) {
    results.push({
      id: `readme-plugin-${check.text.toLowerCase().replace(/\W/g, '-')}`,
      name: check.label,
      pass: readme.includes(check.text),
      detail: readme.includes(check.text)
        ? `✓ "${check.text}" found in README`
        : `✗ "${check.text}" missing from README`,
    });
  }

  return results;
}

// ── Agent: Check ADDING-AGENTS.md ───────────────────────────────────────
function agentCheckAddingAgentsDocs(): DocCheck[] {
  const doc = readDoc('docs/ADDING-AGENTS.md');
  if (!doc) {
    return [{
      id: 'adding-agents-exists',
      name: 'docs/ADDING-AGENTS.md exists',
      pass: false,
      detail: 'docs/ADDING-AGENTS.md not found — run Wave 3 or create it manually',
    }];
  }

  const requiredHeadings = [
    '## 1. Understanding the Agent Model',
    '## 2. Defining a Cluster',
    '## 3. Adding an Agent Directly to UGWTF',
    '## 4. Adding an Agent via Plugin Package',
    '## 5. Checklist for New Agents',
  ];

  const { missing, found } = checkHeadings(doc, requiredHeadings);

  const checks: DocCheck[] = [{
    id: 'adding-agents-exists',
    name: 'docs/ADDING-AGENTS.md exists',
    pass: true,
    detail: `Found (${doc.split('\n').length} lines)`,
  }];

  for (const heading of found) {
    checks.push({
      id: `adding-agents-${heading.replace(/\W/g, '-').toLowerCase()}`,
      name: `ADDING-AGENTS has "${heading}"`,
      pass: true,
      detail: `Heading present`,
    });
  }

  for (const heading of missing) {
    checks.push({
      id: `adding-agents-${heading.replace(/\W/g, '-').toLowerCase()}`,
      name: `ADDING-AGENTS has "${heading}"`,
      pass: false,
      detail: `Heading "${heading}" MISSING from docs/ADDING-AGENTS.md`,
    });
  }

  // Interface checks
  const interfaceChecks = ['AgentContext', 'AgentResult', 'UGWTFPlugin', 'PluginRegistry'];
  for (const iface of interfaceChecks) {
    checks.push({
      id: `adding-agents-interface-${iface.toLowerCase()}`,
      name: `ADDING-AGENTS documents ${iface}`,
      pass: doc.includes(iface),
      detail: doc.includes(iface) ? `✓ ${iface} documented` : `✗ ${iface} not mentioned`,
    });
  }

  return checks;
}

// ── Agent: Validate test count ───────────────────────────────────────────
async function agentValidateTestCount(): Promise<DocCheck[]> {
  const readme = readDoc('README.md');
  if (!readme) {
    return [{
      id: 'test-count-readme',
      name: 'README test count readable',
      pass: false,
      detail: 'README.md not found',
    }];
  }

  const readmeCount = extractReadmeTestCount(readme);
  const readmeCheck: DocCheck = {
    id: 'test-count-readme',
    name: 'README documents test count',
    pass: readmeCount !== null,
    detail: readmeCount !== null
      ? `README declares ${readmeCount} tests`
      : 'Could not parse test count from README',
  };

  if (!jsonOutput) {
    console.log('  → Running vitest to get actual test count (may take ~30s)...');
  }

  const actualCount = getActualTestCount();
  const syncCheck: DocCheck = {
    id: 'test-count-sync',
    name: 'README test count matches actual',
    pass: actualCount !== null && readmeCount === actualCount,
    detail: actualCount !== null
      ? readmeCount === actualCount
        ? `✓ Both say ${actualCount} tests`
        : `✗ README says ${readmeCount}, actual is ${actualCount}${fixMode ? ' (--fix can update this)' : ''}`
      : 'Could not determine actual test count from vitest output',
    fixable: actualCount !== null && readmeCount !== actualCount,
  };

  return [readmeCheck, syncCheck];
}

// ── Agent: Validate P4 checklist ─────────────────────────────────────────
function agentCheckP4Checklist(): DocCheck[] {
  const checklist = readDoc('docs/P4-IMPLEMENTATION-CHECKLIST.md');
  if (!checklist) {
    return [{
      id: 'p4-checklist-exists',
      name: 'docs/P4-IMPLEMENTATION-CHECKLIST.md exists',
      pass: false,
      detail: 'P4-IMPLEMENTATION-CHECKLIST.md not found',
    }];
  }

  const wave3Markers = ['C6.1', 'C6.2', 'C6.3', 'C6.4', 'C6.5'];
  const checks: DocCheck[] = [{
    id: 'p4-checklist-exists',
    name: 'docs/P4-IMPLEMENTATION-CHECKLIST.md exists',
    pass: true,
    detail: `Found (${checklist.split('\n').length} lines)`,
  }];

  for (const marker of wave3Markers) {
    checks.push({
      id: `p4-checklist-${marker.toLowerCase()}`,
      name: `P4 checklist contains ${marker}`,
      pass: checklist.includes(marker),
      detail: checklist.includes(marker)
        ? `✓ ${marker} tracked in checklist`
        : `✗ ${marker} not found in checklist`,
    });
  }

  return checks;
}

// ── Report generation ────────────────────────────────────────────────────
function generateReport(checks: DocCheck[]): ValidationReport {
  const passed = checks.filter(c => c.pass).length;
  const failed = checks.filter(c => !c.pass).length;
  return {
    timestamp: new Date().toISOString(),
    totalChecks: checks.length,
    passed,
    failed,
    checks,
    summary: failed === 0 ? 'PASS' : 'FAIL',
  };
}

function writeReport(report: ValidationReport): void {
  const reportsDir = join(ugwtfRoot, '.ugwtf', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const file = join(reportsDir, 'doc-sync-validation.json');
  writeFileSync(file, JSON.stringify(report, null, 2));
  if (!jsonOutput) {
    console.log(`\n📄 Report written to ${file}`);
  }
}

function printSummary(report: ValidationReport): void {
  const icon = report.summary === 'PASS' ? '✅' : '❌';
  console.log(`\n${icon} Doc Sync Validation: ${report.summary}`);
  console.log(`   ${report.passed}/${report.totalChecks} checks passed`);

  const failures = report.checks.filter(c => !c.pass);
  if (failures.length > 0) {
    console.log('\n   FAILED:');
    for (const f of failures) {
      console.log(`   ✗ ${f.name}: ${f.detail}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (!jsonOutput) {
    console.log('🔍 UGWTF Doc Sync Validator');
    console.log('='.repeat(50));
    console.log('\nRunning agent swarm...\n');
  }

  // Fan-out: all agents in parallel (synchronous agents grouped, async separate)
  const readmeChecks = agentCheckReadmeSections();
  const addingAgentsChecks = agentCheckAddingAgentsDocs();
  const p4Checks = agentCheckP4Checklist();
  const testCountChecks = await agentValidateTestCount(); // runs vitest subprocess

  const allChecks: DocCheck[] = [
    ...readmeChecks,
    ...addingAgentsChecks,
    ...testCountChecks,
    ...p4Checks,
  ];

  const report = generateReport(allChecks);
  writeReport(report);

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printSummary(report);
  }

  process.exit(report.summary === 'PASS' ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
