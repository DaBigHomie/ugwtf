#!/usr/bin/env npx tsx
// ADVISORY ONLY (v1.1.0): not wired to any git hook; wire fleet-wide only after slug+session+driver fixes are validated.
/**
 * code-safety-validator.mts - Advanced Quality Gate Agent & Pre-Commit Validator
 *
 * Verifies code quality and safety rules based on historical workspace issues:
 * 1. Location Awareness Check: Prevents executing scripts in the wrong repo folder.
 * 2. ESM Relative Import extension (.js): Prevents build crashes in ES Modules.
 * 3. Case-Sensitive File Imports: Prevents Mac-to-Linux path resolution failures.
 * 4. ANVIL Session Boot Enforcement: Enforces CORTEX DB session activation.
 * 5. Supabase Migration Destructive Guards: Catches DROP, TRUNCATE, and missing RLS.
 * 6. Design Token Linting: Catches raw color hex values and styling literals.
 *
 * Usage:
 *   npx tsx code-safety-validator.mts [--staged] [--repo-root=path]
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve, sep, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const VALIDATOR_VERSION = '1.1.0';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      return [k, v ?? 'true'];
    }
    return [a, 'true'];
  })
);

const checkStagedOnly = args['staged'] === 'true' || process.argv.includes('--staged');
const repoRoot = args['repo-root'] ? resolve(args['repo-root']) : process.cwd();

console.log(`[Safety Validator v${VALIDATOR_VERSION}] Starting advanced codebase audit...`);
console.log(`[Safety Validator] Repo Root: ${repoRoot}`);

interface SafetyViolation {
  file: string;
  line?: number;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

const violations: SafetyViolation[] = [];

// ---------------------------------------------------------------------------
// 1. Context & Location Verification
// ---------------------------------------------------------------------------
// folderSlug: always derived from the directory name (bootable alias)
const folderSlug = basename(repoRoot);
// repoSlug: attempt to derive from remote URL; fall back to folderSlug
let repoSlug = folderSlug;
try {
  const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (remoteUrl) {
    const match = remoteUrl.match(/\/([^/.]+)(?:\.git)?$/);
    if (match && match[1]) {
      repoSlug = match[1];
    }
  }
} catch {}

// Ensure we are not executing in a parent directory or wrong folder
if (process.cwd() !== repoRoot) {
  violations.push({
    file: 'Context Check',
    rule: 'LOCATION_AWARENESS_FAIL',
    message: `Active working directory (${process.cwd()}) does not match repo root target (${repoRoot}). Process halted.`,
    severity: 'error'
  });
}

// ---------------------------------------------------------------------------
// 2. ESM & package.json Properties
// ---------------------------------------------------------------------------
let isEsm = false;
try {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8'));
  isEsm = pkg.type === 'module';
} catch {}

// ---------------------------------------------------------------------------
// 3. ANVIL Session Verification (CORTEX DB)
// ---------------------------------------------------------------------------

// Resolve KB_DIR portably:
// Priority 1: env override
// Priority 2: walk up from repoRoot looking for .agent-kb/db/agent_kb.sqlite or
//             .system/handoff/agent-kb/db/agent_kb.sqlite
// Priority 3: peer directory fallback (repoRoot/../.agent-kb)
function resolveKbDir(): string {
  if (process.env.AGENT_KB_DIR) {
    return process.env.AGENT_KB_DIR;
  }
  // Walk up from repoRoot up to 5 levels
  let cursor = repoRoot;
  for (let i = 0; i < 5; i++) {
    const candidate1 = join(cursor, '.agent-kb');
    if (existsSync(join(candidate1, 'db', 'agent_kb.sqlite'))) {
      return candidate1;
    }
    const candidate2 = join(cursor, '.system', 'handoff', 'agent-kb');
    if (existsSync(join(candidate2, 'db', 'agent_kb.sqlite'))) {
      return candidate2;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break; // reached filesystem root
    cursor = parent;
  }
  // Fallback: peer directory relative to repoRoot
  return join(repoRoot, '..', '.agent-kb');
}

const KB_DIR = resolveKbDir();
const CORTEX_DB = join(KB_DIR, 'db', 'agent_kb.sqlite');

if (existsSync(CORTEX_DB)) {
  try {
    // Attempt to load better-sqlite3: try KB dir's node_modules first, then standard resolution
    let Database: any;
    const _requireKb = createRequire(join(KB_DIR, 'db', 'package.json'));
    try {
      Database = _requireKb('better-sqlite3');
    } catch {
      // Fall back to resolution relative to this script's location
      const _requireScript = createRequire(import.meta.url);
      Database = _requireScript('better-sqlite3');
    }

    const db = new Database(CORTEX_DB);
    db.pragma('journal_mode = WAL');

    // Query matches EITHER the remote-derived slug OR the folder name (bootable alias)
    // to prevent permanent lock-out when remote slug differs from folder name.
    const activeSession = db.prepare(
      `SELECT id FROM sessions WHERE repo IN (?, ?) AND status = 'active' ORDER BY created_at DESC LIMIT 1`
    ).get(repoSlug, folderSlug);

    if (!activeSession) {
      violations.push({
        file: 'CORTEX DB',
        rule: 'ANVIL_SESSION_REQUIRED',
        message: `No active ANVIL session found for repository "${folderSlug}" (remote slug: "${repoSlug}"). Boot the session first: "npx tsx ../.agent-kb/anvil/cortex-boot.mts --repo=${folderSlug} --agent=181"`,
        severity: 'error'
      });
    }
    db.close();
  } catch (e) {
    // If DB is locked or better-sqlite3 is unavailable, report as warning (fail-open)
    violations.push({
      file: 'CORTEX DB',
      rule: 'CORTEX_DB_ACCESS_WARNING',
      message: `Could not verify active session in CORTEX DB: ${(e as Error).message}`,
      severity: 'warning'
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Git Branch Sync Check (Prevent merge conflicts)
// ---------------------------------------------------------------------------
try {
  const gitStatus = execSync('git status -uno', { encoding: 'utf-8' });
  if (gitStatus.includes('is behind') || gitStatus.includes('have diverged')) {
    violations.push({
      file: 'Git Sync',
      rule: 'GIT_BRANCH_OUT_OF_SYNC',
      message: `Your local branch is out of sync with origin. Run "git fetch && git rebase" to align with origin first.`,
      severity: 'error'
    });
  }
} catch {}

// ---------------------------------------------------------------------------
// 5. Build file scanning lists
// ---------------------------------------------------------------------------
let filesToCheck: string[] = [];
if (checkStagedOnly) {
  try {
    const stdout = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' });
    filesToCheck = stdout.trim().split('\n').filter(Boolean).map(f => join(repoRoot, f));
  } catch {
    console.error(`Warning: Failed to retrieve staged files via Git.`);
  }
} else {
  const findFiles = (dir: string): string[] => {
    let results: string[] = [];
    if (!existsSync(dir)) return results;
    const list = readdirSync(dir);
    for (const file of list) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (file === 'node_modules' || file === '.next' || file === 'dist' || file === '.git' || file === 'out') continue;
        results = results.concat(findFiles(fullPath));
      } else {
        if (/\.(tsx?|jsx?|sql)$/.test(file)) {
          results.push(fullPath);
        }
      }
    }
    return results;
  };
  filesToCheck = findFiles(repoRoot);
}

// ---------------------------------------------------------------------------
// File Audit Loops
// ---------------------------------------------------------------------------
for (const file of filesToCheck) {
  const isSql = file.endsWith('.sql');
  const isTsOrJs = /\.(tsx?|jsx?)$/.test(file);
  const relativeFile = relativeFromRepo(file);

  let content = '';
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    continue; // File deleted
  }

  const lines = content.split('\n');

  if (isSql) {
    auditSupabaseMigration(file, relativeFile, content, lines);
  }

  if (isTsOrJs) {
    auditImportHygiene(file, relativeFile, lines);
    auditDesignTokens(file, relativeFile, lines);
    auditRulesOfHooks(file, relativeFile, lines);
    auditRoutingSanity(file, relativeFile, lines);
    auditEsLintHeaders(file, relativeFile, content);
  }
}

// ---------------------------------------------------------------------------
// Audit Implementations
// ---------------------------------------------------------------------------

function checkCaseSensitiveFileExists(filePath: string): boolean {
  const dir = dirname(filePath);
  const file = basename(filePath);
  if (!existsSync(dir)) return false;
  const files = readdirSync(dir);
  return files.includes(file);
}

function auditImportHygiene(file: string, relativeFile: string, lines: string[]) {
  const dir = dirname(file);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const importMatch = line.match(/(?:import|from)\s+['"](\.[^'"]+)['"]/);
    if (importMatch) {
      const importPath = importMatch[1]!;

      // A. ESM Extension Enforcement
      if (isEsm) {
        const allowedExtensions = ['.js', '.json', '.css', '.svg', '.png', '.jpg', '.jpeg'];
        const hasExt = allowedExtensions.some(ext => importPath.endsWith(ext));
        if (!hasExt) {
          violations.push({
            file: relativeFile,
            line: i + 1,
            rule: 'IMPORT_HYGIENE_ESM_EXTENSION',
            message: `Relative import "${importPath}" in ES Module project must explicitly include extension (e.g. "./utils.js" instead of "./utils").`,
            severity: 'error'
          });
        }
      }

      // B. Case-Sensitivity Check
      const resolvedPath = resolve(dir, importPath);
      let actualFileFound = '';
      const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

      for (const ext of extensions) {
        const candidate = resolvedPath + ext;
        if (existsSync(candidate)) {
          actualFileFound = candidate;
          break;
        }
      }

      if (actualFileFound) {
        if (!checkCaseSensitiveFileExists(actualFileFound)) {
          violations.push({
            file: relativeFile,
            line: i + 1,
            rule: 'IMPORT_HYGIENE_CASING',
            message: `Case mismatch in import path: "${importPath}" resolved on disk to "${basename(actualFileFound)}". This will fail on Linux/Vercel CI.`,
            severity: 'error'
          });
        }
      } else {
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
          violations.push({
            file: relativeFile,
            line: i + 1,
            rule: 'IMPORT_HYGIENE_UNRESOLVED',
            message: `Relative path "${importPath}" cannot be resolved. Verification required.`,
            severity: 'warning'
          });
        }
      }
    }
  }
}

function auditDesignTokens(file: string, relativeFile: string, lines: string[]) {
  if (basename(file).includes('config') || basename(file).includes('test') || file.includes('/shared/config/') || file.endsWith('.css')) return;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const hasHexColor = /#([0-9a-fA-F]{3,8})\b/.test(line);
    const hasRgbColor = /rgba?\([^)]+\)/.test(line);

    const isStyleLine = /(?:color|backgroundColor|borderColor|padding|margin|borderRadius|gap)\s*:/i.test(line);

    if (isStyleLine) {
      if (hasHexColor || hasRgbColor) {
        violations.push({
          file: relativeFile,
          line: i + 1,
          rule: 'DESIGN_TOKEN_COLOR_LITERAL',
          message: `Hex or RGB value detected in style block: "${line.trim()}". Replace with CSS variables or design system theme keys.`,
          severity: 'error'
        });
      }

      const hasPixelLiteral = /:\s*(?:['"]\d+px['"]|\d+)\b/.test(line);
      if (hasPixelLiteral) {
        violations.push({
          file: relativeFile,
          line: i + 1,
          rule: 'DESIGN_TOKEN_SPACING_LITERAL',
          message: `Raw pixel spacing literal detected in style block: "${line.trim()}". Replace with constants or design system tokens.`,
          severity: 'warning'
        });
      }
    }
  }
}

function auditRulesOfHooks(file: string, relativeFile: string, lines: string[]) {
  let insideCondition = false;
  let bracesCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (/\b(if|for|while|switch|map)\b\s*\(/.test(line)) {
      insideCondition = true;
    }

    if (insideCondition) {
      if (line.includes('{')) bracesCount++;
      if (line.includes('}')) {
        bracesCount--;
        if (bracesCount <= 0) {
          insideCondition = false;
          bracesCount = 0;
        }
      }

      const hasHookCall = /\buse[A-Z][a-zA-Z0-9_]*\s*\(/.test(line);
      if (hasHookCall) {
        violations.push({
          file: relativeFile,
          line: i + 1,
          rule: 'RULES_OF_HOOKS_VIOLATION',
          message: `React hook hook is invoked inside loop, map, or conditional block.`,
          severity: 'error'
        });
      }
    }
  }
}

function auditRoutingSanity(file: string, relativeFile: string, lines: string[]) {
  const isMobile = file.includes('/atl-table-booking-app/') || file.includes('/atb-sprint4-scale-polish/');
  const isWeb = file.includes('/maximus-ai/') || file.includes('/one4three-co-next-app/');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (isWeb) {
      const nextLinkMatch = line.match(/href=['"](\/[a-zA-Z0-9/_[-]*)['"]/);
      if (nextLinkMatch) {
        const route = nextLinkMatch[1]!;
        if (route !== '/' && !route.startsWith('/api') && !route.startsWith('/_')) {
          const appPathCandidates = [
            join(repoRoot, 'src', 'app', route, 'page.tsx'),
            join(repoRoot, 'src', 'app', route, 'page.ts'),
            join(repoRoot, 'app', route, 'page.tsx'),
            join(repoRoot, 'app', route, 'page.ts')
          ];
          if (!appPathCandidates.some(p => existsSync(p)) && !route.includes('[') && !route.includes(':')) {
            violations.push({
              file: relativeFile,
              line: i + 1,
              rule: 'ROUTING_SANITY_DEAD_LINK',
              message: `Next.js route destination page not found: "${route}"`,
              severity: 'warning'
            });
          }
        }
      }
    }

    if (isMobile) {
      const expoLinkMatch = line.match(/(?:href|router\.push|router\.replace)\s*\(?\s*['"](\/[a-zA-Z0-9/_[-]*)['"]/);
      if (expoLinkMatch) {
        const route = expoLinkMatch[1]!;
        if (route !== '/') {
          const mobileAppDir = join(repoRoot, 'apps', 'mobile', 'app');
          const appPathCandidates = [
            join(mobileAppDir, route + '.tsx'),
            join(mobileAppDir, route + '.ts'),
            join(mobileAppDir, route, 'index.tsx'),
            join(mobileAppDir, route, 'index.ts')
          ];
          if (!appPathCandidates.some(p => existsSync(p)) && !route.includes('[') && !route.includes(':')) {
            violations.push({
              file: relativeFile,
              line: i + 1,
              rule: 'ROUTING_SANITY_DEAD_LINK',
              message: `Expo Router path destination page not found: "${route}"`,
              severity: 'warning'
            });
          }
        }
      }
    }
  }
}

function auditEsLintHeaders(file: string, relativeFile: string, content: string) {
  // Enforce disable headers in node runner scripts that output to console or run global variables
  if (relativeFile.startsWith('scripts/') || relativeFile.startsWith('agents/')) {
    const usesConsole = content.includes('console.log') || content.includes('console.error');
    const usesProcess = content.includes('process.exit') || content.includes('process.argv') || content.includes('__dirname');

    if ((usesConsole || usesProcess) && !content.includes('eslint-disable')) {
      violations.push({
        file: relativeFile,
        line: 1,
        rule: 'ESLINT_HEADER_REQUIRED',
        message: `Node script uses console or process/global variables without ESLint disable header. Add: "/* eslint-disable no-console, no-undef */" at the top of the file to prevent Husky hook lint rejection.`,
        severity: 'warning'
      });
    }
  }
}

function auditSupabaseMigration(file: string, relativeFile: string, content: string, lines: string[]) {
  const createdTables: string[] = [];
  const rlsEnabledTables: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const cleanLine = line.replace(/--.*/, '').trim();

    if (/\bDROP\s+TABLE\b/i.test(cleanLine)) {
      violations.push({
        file: relativeFile,
        line: i + 1,
        rule: 'DB_DESTRUCTIVE_DROP_TABLE',
        message: `Destructive migration: "DROP TABLE" statement detected. Confirm data recovery/backup policies.`,
        severity: 'error'
      });
    }

    if (/\bDROP\s+COLUMN\b/i.test(cleanLine)) {
      violations.push({
        file: relativeFile,
        line: i + 1,
        rule: 'DB_DESTRUCTIVE_DROP_COLUMN',
        message: `Destructive migration: "DROP COLUMN" statement detected. Will trigger data loss on tables.`,
        severity: 'error'
      });
    }

    if (/\bTRUNCATE\b/i.test(cleanLine)) {
      violations.push({
        file: relativeFile,
        line: i + 1,
        rule: 'DB_DESTRUCTIVE_TRUNCATE',
        message: `Data clearing statement "TRUNCATE" detected.`,
        severity: 'error'
      });
    }

    const createTableMatch = cleanLine.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/i);
    if (createTableMatch) {
      createdTables.push(createTableMatch[1]!);
    }

    const rlsMatch = cleanLine.match(/ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    if (rlsMatch) {
      rlsEnabledTables.push(rlsMatch[1]!);
    }
  }

  for (const table of createdTables) {
    if (!rlsEnabledTables.includes(table)) {
      violations.push({
        file: relativeFile,
        rule: 'DB_SECURITY_MISSING_RLS',
        message: `New table "${table}" created without Row Level Security (RLS) activation. You MUST add "ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;" to prevent unauthorized DB access.`,
        severity: 'error'
      });
    }
  }
}

function relativeFromRepo(absolute: string): string {
  const rel = relative(repoRoot, absolute);
  return rel.split(sep).join('/');
}

// ---------------------------------------------------------------------------
// Reporting & Exiting
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
console.log(`Audit Report Summary — Safety Validator v${VALIDATOR_VERSION}`);
console.log('='.repeat(60));

const errors = violations.filter(v => v.severity === 'error');
const warnings = violations.filter(v => v.severity === 'warning');

if (violations.length === 0) {
  console.log(`[Safety Validator] All safety gates passed successfully. No violations found.`);
  process.exit(0);
}

for (const v of violations) {
  const label = v.severity === 'error' ? '[ERROR]' : '[WARN] ';
  const lineInfo = v.line ? `:${v.line}` : '';
  console.log(`${label} ${v.file}${lineInfo} [${v.rule}]`);
  console.log(`         ${v.message}`);
}

console.log('\n' + '='.repeat(60));
console.log(`TOTAL: ${violations.length} finding(s) (${errors.length} error(s), ${warnings.length} warning(s))`);
console.log('='.repeat(60));

if (errors.length > 0) {
  console.log(`\n[Safety Validator] Safety gate FAILED due to critical errors. Fix outstanding violations before committing.`);
  process.exit(1);
} else {
  console.log(`\n[Safety Validator] Safety gate passed with warnings. Ready to commit.`);
  process.exit(0);
}
