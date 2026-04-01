/**
 * ugwtf agents — scan, score, and sync VS Code custom agents
 *
 * Usage:
 *   ugwtf agents scan  [--path <dir>]   Discover .agent.md files
 *   ugwtf agents score [--path <dir>]   Score against 20-point rubric
 *   ugwtf agents sync  [--hub <dir>]    Sync hub → workspace → spokes
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';

interface AgentFrontmatter {
  id?: string;
  version?: string;
  status?: string;
  description?: string;
  [key: string]: unknown;
}

interface ScoredAgent {
  filename: string;
  score: number;
  maxScore: number;
  frontmatter: AgentFrontmatter;
  criteria: Array<{ name: string; awarded: number; maxPoints: number; reason: string }>;
}

function parseFrontmatter(content: string): AgentFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: AgentFrontmatter = {};
  for (const line of match[1]!.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      fm[key] = val;
    }
  }
  return fm;
}

function scoreAgent(filename: string, content: string, fm: AgentFrontmatter): ScoredAgent {
  const criteria: ScoredAgent['criteria'] = [];
  const body = content.replace(/^---[\s\S]*?---/, '').trim();

  // 1. Clear Objective (2pt)
  const hasDesc = !!fm.description && String(fm.description).length > 20;
  const hasTriggers = /use when:/i.test(String(fm.description || ''));
  criteria.push({ name: 'Clear Objective', maxPoints: 2, awarded: hasDesc && hasTriggers ? 2 : hasDesc ? 1 : 0, reason: hasDesc && hasTriggers ? 'Description with triggers' : hasDesc ? 'Description but no triggers' : 'Missing description' });

  // 2. Scoped Boundaries (2pt)
  const hasRole = /## (your )?role/i.test(body);
  const hasNot = /do(es)? not|never |don't |NOT/i.test(body);
  criteria.push({ name: 'Scoped Boundaries', maxPoints: 2, awarded: hasRole && hasNot ? 2 : hasRole ? 1 : 0, reason: hasRole && hasNot ? 'Clear scope and boundaries' : hasRole ? 'Role defined but no boundaries' : 'Missing role section' });

  // 3. Actionable Workflow Steps (2pt)
  const hasSteps = /## (workflow|steps)/i.test(body);
  const hasCode = /```(bash|typescript|ts|sh)/i.test(body);
  criteria.push({ name: 'Actionable Workflow Steps', maxPoints: 2, awarded: hasSteps && hasCode ? 2 : hasSteps ? 1 : 0, reason: hasSteps && hasCode ? 'Steps with code examples' : hasSteps ? 'Steps without code' : 'No workflow section' });

  // 4. Output Format Defined (2pt)
  const hasOutput = /## output/i.test(body);
  const hasTemplate = /```(markdown|md)?[\s\S]*?\|.*\|/m.test(body);
  criteria.push({ name: 'Output Format Defined', maxPoints: 2, awarded: hasOutput && hasTemplate ? 2 : hasOutput ? 1 : 0, reason: hasOutput && hasTemplate ? 'Format spec with template' : hasOutput ? 'Format defined but no template' : 'No output format' });

  // 5. Critical Rules / Safety (1pt)
  const hasRules = /## (critical )?rules|## safety/i.test(body);
  criteria.push({ name: 'Critical Rules / Safety', maxPoints: 1, awarded: hasRules ? 1 : 0, reason: hasRules ? 'Safety rules defined' : 'No rules section' });

  // 6. Tool List Minimal (1pt)
  const toolMatch = fm.tools || '';
  const toolCount = String(toolMatch).split(',').filter(Boolean).length;
  criteria.push({ name: 'Tool List Minimal', maxPoints: 1, awarded: toolCount <= 5 ? 1 : 0, reason: toolCount <= 5 ? `${toolCount} tools (good)` : `${toolCount} tools (too many)` });

  // 7. Agent Cross-References (1pt)
  const hasRefs = /## .*cross.?ref|## .*related|→.*\.agent\.md/i.test(body);
  criteria.push({ name: 'Agent Cross-References', maxPoints: 1, awarded: hasRefs ? 1 : 0, reason: hasRefs ? 'References other agents' : 'No cross-references' });

  // 8. Persona Defined (1pt)
  const hasPersona = /you are the \*\*/i.test(body);
  criteria.push({ name: 'Persona Defined', maxPoints: 1, awarded: hasPersona ? 1 : 0, reason: hasPersona ? 'Persona established' : 'No persona statement' });

  // 9. Input/Output Contract (2pt)
  const hasIO = /input|output|contract|interface |type /i.test(body);
  const hasInterface = /interface\s+\w+|type\s+\w+\s*=|```typescript/i.test(body);
  criteria.push({ name: 'Input/Output Contract', maxPoints: 2, awarded: hasIO && hasInterface ? 2 : hasIO ? 1 : 0, reason: hasIO && hasInterface ? 'Clear I/O contract' : hasIO ? 'Partial I/O spec' : 'No I/O contract' });

  // 10. Error Handling (1pt)
  const hasErrors = /error|fail|fallback|retry|rollback/i.test(body);
  criteria.push({ name: 'Error Handling', maxPoints: 1, awarded: hasErrors ? 1 : 0, reason: hasErrors ? 'Error cases covered' : 'No error handling' });

  // 11. Context Optimization (1pt)
  const hasTables = /\|.*\|.*\|/m.test(body);
  criteria.push({ name: 'Context Optimization', maxPoints: 1, awarded: hasTables ? 1 : 0, reason: hasTables ? 'Uses tables for structured data' : 'No tables' });

  // 12. Reference Implementation (1pt)
  const hasRefs2 = /reference|see also|related|→/i.test(body);
  criteria.push({ name: 'Reference Implementation', maxPoints: 1, awarded: hasRefs2 ? 1 : 0, reason: hasRefs2 ? 'References linked' : 'No references' });

  // 13. Frontmatter Complete (1pt)
  const hasFM = !!(fm.id && fm.version && fm.status && fm.description);
  criteria.push({ name: 'Frontmatter Complete', maxPoints: 1, awarded: hasFM ? 1 : 0, reason: hasFM ? 'All lifecycle fields present' : 'Missing lifecycle fields' });

  // 14. Blast Radius Awareness (1pt) — added after PR #573 post-mortem
  const hasBlastRadius = /blast.?radius|grep -r|search.*codebase|where else/i.test(body);
  criteria.push({ name: 'Blast Radius Awareness', maxPoints: 1, awarded: hasBlastRadius ? 1 : 0, reason: hasBlastRadius ? 'Includes blast radius check' : 'No blast radius awareness' });

  // 15. A11y / Accessibility (1pt)
  const hasA11y = /a11y|aria-|accessibility|wcag|heading.?hierarchy|screen.?reader/i.test(body);
  criteria.push({ name: 'A11y / Accessibility', maxPoints: 1, awarded: hasA11y ? 1 : 0, reason: hasA11y ? 'A11y requirements present' : 'No a11y requirements' });

  const score = criteria.reduce((s, c) => s + c.awarded, 0);
  return { filename, score, maxScore: 20, frontmatter: fm, criteria };
}

function discoverAgents(basePath: string): ScoredAgent[] {
  const agentsDir = join(resolve(basePath), 'agents');
  try {
    const files = readdirSync(agentsDir).filter(f => f.endsWith('.agent.md'));
    return files.map(f => {
      const content = readFileSync(join(agentsDir, f), 'utf-8');
      const fm = parseFrontmatter(content);
      return scoreAgent(f, content, fm);
    });
  } catch {
    return [];
  }
}

export function parseAgentsArgs(args: string[]): { subcommand: string; path: string } | null {
  const sub = args[0] || 'scan';
  const pathIdx = args.indexOf('--path');
  const path = pathIdx !== -1 && args[pathIdx + 1] ? args[pathIdx + 1]! : './.github';
  if (!['scan', 'score', 'help'].includes(sub)) {
    console.error(`Unknown agents subcommand: ${sub}`);
    console.error('Valid: scan, score, help');
    return null;
  }
  return { subcommand: sub, path };
}

export function agentsCommand(opts: { subcommand: string; path: string }): void {
  if (opts.subcommand === 'help') {
    console.log(`ugwtf agents — VS Code custom agent lifecycle management\n`);
    console.log(`Subcommands:`);
    console.log(`  scan   [--path <dir>]  Discover .agent.md files and show scores`);
    console.log(`  score  [--path <dir>]  Detailed 20-point rubric breakdown`);
    return;
  }

  const agents = discoverAgents(opts.path);
  if (agents.length === 0) {
    console.log(`No .agent.md files found in ${opts.path}/agents/`);
    return;
  }

  const passed = agents.filter(a => a.score >= 15).length;
  const failed = agents.length - passed;

  if (opts.subcommand === 'scan') {
    console.log(`\n📦 Agent Mastery Scan — ${agents.length} agents\n`);
    console.log(`  ✅ Deploy-ready (≥15/20): ${passed}`);
    if (failed > 0) console.log(`  ⚠️  Below threshold: ${failed}`);
    console.log();
    for (const a of agents.sort((x, y) => y.score - x.score)) {
      const icon = a.score >= 15 ? '✅' : '⚠️';
      const id = a.frontmatter.id || 'no-id';
      console.log(`  ${icon} ${a.filename.padEnd(38)} ${a.score}/${a.maxScore}  [${id}]`);
    }
  } else if (opts.subcommand === 'score') {
    for (const a of agents) {
      const icon = a.score >= 15 ? '✅' : '❌';
      console.log(`\n${icon} ${a.filename} — ${a.score}/${a.maxScore}  [${a.frontmatter.id || 'no-id'}]`);
      for (const c of a.criteria) {
        const ci = c.awarded === c.maxPoints ? '✓' : c.awarded > 0 ? '~' : '✗';
        console.log(`  [${ci}] ${c.name}: ${c.awarded}/${c.maxPoints} — ${c.reason}`);
      }
    }
    console.log(`\n━━━ Summary: ${passed}/${agents.length} deploy-ready (≥15/20) ━━━`);
  }
}
