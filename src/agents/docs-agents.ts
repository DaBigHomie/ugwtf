/**
 * Documentation Quality Agents
 *
 * README completeness, doc coverage, and cross-reference validation.
 */
import type { Agent, AgentResult, AgentFinding } from '../types.js';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: README Completeness Checker
// ---------------------------------------------------------------------------

const readmeCompletenessChecker: Agent = {
  id: 'readme-completeness-checker',
  name: 'README Completeness Checker',
  description: 'Validate README has essential sections (Setup, Usage, Architecture)',
  clusterId: 'docs',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`README Check: ${ctx.repoAlias}`);

    let content: string;
    try {
      content = await readFile(join(ctx.localPath, 'README.md'), 'utf-8');
    } catch {
      ctx.logger.warn('No README.md');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No README.md', artifacts: ['missing-readme'] };
    }

    const requiredSections = [
      { name: 'Setup / Installation', pattern: /#+\s*(setup|install|getting\s*started)/i },
      { name: 'Usage', pattern: /#+\s*(usage|how\s*to\s*use|quick\s*start)/i },
      { name: 'Tech Stack', pattern: /#+\s*(tech\s*stack|architecture|stack|built\s*with)/i },
    ];

    const missing: string[] = [];
    for (const section of requiredSections) {
      if (!section.pattern.test(content)) {
        missing.push(section.name);
      }
    }

    const lineCount = content.split('\n').length;
    if (lineCount < 20) {
      missing.push('Content too short (<20 lines)');
    }

    ctx.logger.info(`README lines: ${lineCount} | Missing sections: ${missing.length}`);
    for (const m of missing) ctx.logger.warn(`  ❌ ${m}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: missing.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'README complete',
      artifacts: missing,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Doc Coverage Scanner
// ---------------------------------------------------------------------------

const docCoverageScanner: Agent = {
  id: 'doc-coverage-scanner',
  name: 'Doc Coverage Scanner',
  description: 'Check for presence of essential documentation files',
  clusterId: 'docs',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Doc Coverage: ${ctx.repoAlias}`);

    const essentialDocs = [
      { path: 'README.md', label: 'README' },
      { path: 'AGENTS.md', label: 'AGENTS (agent instructions)' },
      { path: '.github/copilot-instructions.md', label: 'Copilot instructions' },
    ];

    const found: string[] = [];
    const missingDocs: string[] = [];

    for (const doc of essentialDocs) {
      try {
        await access(join(ctx.localPath, doc.path));
        found.push(doc.label);
      } catch {
        missingDocs.push(doc.label);
      }
    }

    // Check for docs/ directory
    try {
      const docs = await readdir(join(ctx.localPath, 'docs'));
      if (docs.length > 0) {
        found.push(`docs/ (${docs.length} files)`);
      }
    } catch {
      missingDocs.push('docs/ directory');
    }

    const coverage = Math.round((found.length / (found.length + missingDocs.length)) * 100);
    ctx.logger.info(`Doc coverage: ${coverage}% (${found.length} found, ${missingDocs.length} missing)`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: coverage >= 75 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Doc coverage: ${coverage}%`,
      artifacts: missingDocs.map(m => `missing:${m}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: AGENTS.md Checker
// ---------------------------------------------------------------------------

const agentsMdChecker: Agent = {
  id: 'agents-md-checker',
  name: 'AGENTS.md Checker',
  description: 'Validate AGENTS.md exists with required sections',
  clusterId: 'docs',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`AGENTS.md: ${ctx.repoAlias}`);

    const findings: AgentFinding[] = [];
    let content: string;

    try {
      content = await readFile(join(ctx.localPath, 'AGENTS.md'), 'utf-8');
    } catch {
      findings.push({
        severity: 'warning',
        message: 'AGENTS.md missing',
        suggestion: 'Create AGENTS.md with project architecture and build commands',
      });
      ctx.logger.warn('No AGENTS.md');
      ctx.logger.groupEnd();
      return {
        agentId: this.id,
        status: 'failed',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: 'AGENTS.md missing',
        artifacts: ['missing-agents-md'],
        findings,
      };
    }

    const sections = [
      { name: 'Build Commands', pattern: /#+\s*(build|commands|quick\s*start)/i },
      { name: 'Architecture', pattern: /#+\s*(architecture|structure|project)/i },
      { name: 'Pre-Commit', pattern: /#+\s*(pre.?commit|commit)/i },
    ];

    for (const section of sections) {
      if (!section.pattern.test(content)) {
        findings.push({
          severity: 'info',
          message: `AGENTS.md missing section: ${section.name}`,
          file: 'AGENTS.md',
          suggestion: `Add a ## ${section.name} section`,
        });
      }
    }

    const lineCount = content.split('\n').length;
    ctx.logger.info(`AGENTS.md: ${lineCount} lines, ${findings.length} suggestions`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `AGENTS.md: ${lineCount} lines`,
      artifacts: findings.map(f => f.message),
      findings,
    };
  },
};

export const docsAgents: Agent[] = [readmeCompletenessChecker, docCoverageScanner, agentsMdChecker];
