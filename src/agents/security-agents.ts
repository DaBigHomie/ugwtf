/**
 * Security & Hardening Agents
 *
 * Dependency vulnerability audit, secret scanning, and
 * env file leak detection.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Agent: Dependency Vulnerability Scanner
// ---------------------------------------------------------------------------

const dependencyVulnScanner: Agent = {
  id: 'dependency-vuln-scanner',
  name: 'Dependency Vulnerability Scanner',
  description: 'Run npm audit to detect known vulnerabilities',
  clusterId: 'security',
  shouldRun(ctx) {
    return true; // All repos have package.json
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Dependency Audit: ${ctx.repoAlias}`);

    if (ctx.dryRun) {
      ctx.logger.info('[dry-run] Would run npm audit');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: 'dry-run', artifacts: [] };
    }

    try {
      const output = execSync('npm audit --json 2>/dev/null', {
        cwd: ctx.localPath,
        encoding: 'utf-8',
        timeout: 60_000,
      });

      const audit = JSON.parse(output);
      const total = audit.metadata?.vulnerabilities ?? {};
      const critical = total.critical ?? 0;
      const high = total.high ?? 0;

      const msg = `Critical: ${critical} | High: ${high}`;
      ctx.logger.info(msg);
      ctx.logger.groupEnd();

      return {
        agentId: this.id,
        status: critical > 0 ? 'failed' : 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: msg,
        artifacts: critical > 0 ? ['has-critical-vulns'] : [],
      };
    } catch {
      // npm audit exits non-zero when vulnerabilities exist
      ctx.logger.warn('npm audit returned non-zero (vulnerabilities present or audit failed)');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: Date.now() - start, message: 'Audit found issues or failed', artifacts: ['audit-nonzero'] };
    }
  },
};

// ---------------------------------------------------------------------------
// Agent: Secret Leak Detector
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?ey/i,
  /STRIPE_SECRET_KEY\s*=\s*["']?sk_live/i,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
  /ghp_[A-Za-z0-9]{36,}/,
  /sk-[A-Za-z0-9]{48,}/, // OpenAI key pattern
];

const secretLeakDetector: Agent = {
  id: 'secret-leak-detector',
  name: 'Secret Leak Detector',
  description: 'Scan tracked source files for exposed secrets',
  clusterId: 'security',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Secret Scan: ${ctx.repoAlias}`);

    const leaks: string[] = [];
    const srcDir = join(ctx.localPath, 'src');

    async function scanDir(dir: string): Promise<void> {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const { default: { lstatSync } } = await import('node:fs');
        const s = lstatSync(fullPath);
        if (s.isDirectory() && entry !== 'node_modules' && entry !== '.git') {
          await scanDir(fullPath);
        } else if (s.isFile() && /\.(ts|tsx|js|jsx|json|env)$/.test(entry)) {
          try {
            const content = await readFile(fullPath, 'utf-8');
            for (const pattern of SECRET_PATTERNS) {
              if (pattern.test(content)) {
                const rel = fullPath.replace(ctx.localPath + '/', '');
                leaks.push(rel);
                ctx.logger.error(`  🔑 Secret found: ${rel}`);
                break; // One match per file is enough
              }
            }
          } catch {
            // Skip unreadable
          }
        }
      }
    }

    await scanDir(srcDir);

    // Also scan root-level files
    const rootFiles = ['.env', '.env.local', '.env.production'];
    for (const f of rootFiles) {
      try {
        await access(join(ctx.localPath, f));
        const content = await readFile(join(ctx.localPath, f), 'utf-8');
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(content)) {
            leaks.push(f);
            ctx.logger.error(`  🔑 Secret in ${f}`);
            break;
          }
        }
      } catch {
        // File doesn't exist
      }
    }

    ctx.logger.info(`Files with secrets: ${leaks.length}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: leaks.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: leaks.length > 0 ? `Found secrets in ${leaks.length} files` : 'No secrets detected',
      artifacts: leaks,
    };
  },
};

export const securityAgents: Agent[] = [dependencyVulnScanner, secretLeakDetector];
