/**
 * AI Gateway & Prompt Intelligence Agents
 *
 * Inspired by maximus-ai C19 (intent classifier, ambiguity resolver, context-window manager),
 * C08 (codebase indexer, hallucination guard), C11 (prompt engineering critic,
 * token budgeting sentinel), and C20 (output quality scorer).
 *
 * Validates prompt templates, estimates token budgets, scores instruction quality,
 * and ensures AI-related config is consistent across repos.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function collectFiles(dir: string, exts: string[], maxDepth = 4, depth = 0): Promise<string[]> {
  if (depth > maxDepth) return [];
  const results: string[] = [];
  let entries: string[];
  try { entries = await readdir(dir); } catch { return results; }
  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', '.next'].includes(entry)) continue;
    const fullPath = join(dir, entry);
    const s = await stat(fullPath).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) results.push(...await collectFiles(fullPath, exts, maxDepth, depth + 1));
    else if (exts.some(e => entry.endsWith(e))) results.push(fullPath);
  }
  return results;
}

// Rough token estimation (1 token ≈ 4 bytes for English text)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Agent: Prompt Template Validator
// ---------------------------------------------------------------------------

const promptTemplateValidator: Agent = {
  id: 'prompt-template-validator',
  name: 'Prompt Template Validator',
  description: 'Validate .prompt.md files for required sections: context, task, constraints, output format',
  clusterId: 'ai-gateway',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Prompt Templates: ${ctx.repoAlias}`);

    const promptFiles = await collectFiles(ctx.localPath, ['.prompt.md']);
    const issues: string[] = [];
    const REQUIRED_SECTIONS = ['context', 'task', 'constraint', 'output'];

    for (const file of promptFiles.slice(0, 50)) {
      try {
        const content = await readFile(file, 'utf-8');
        const lowerContent = content.toLowerCase();

        const missing = REQUIRED_SECTIONS.filter(s => !lowerContent.includes(s));
        if (missing.length > 0) {
          issues.push(`${file}: Missing sections: ${missing.join(', ')}`);
        }

        // Check for overly long prompts
        const tokens = estimateTokens(content);
        if (tokens > 8000) {
          issues.push(`${file}: ~${tokens} tokens — consider splitting (>8K is expensive)`);
        }
      } catch { /* skip */ }
    }

    ctx.logger.info(`${promptFiles.length} prompt files, ${issues.length} issues`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: issues.length === 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${promptFiles.length} prompts, ${issues.length} issues`,
      artifacts: issues,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Instruction Quality Scorer
// ---------------------------------------------------------------------------

const instructionQualityScorer: Agent = {
  id: 'instruction-quality-scorer',
  name: 'Instruction Quality Scorer',
  description: 'Score .instructions.md files on clarity, completeness, and structure (0-100)',
  clusterId: 'ai-gateway',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Instruction Quality: ${ctx.repoAlias}`);

    const instrDir = join(ctx.localPath, '.github', 'instructions');
    const copilotInstr = join(ctx.localPath, '.github', 'copilot-instructions.md');
    const agentsMd = join(ctx.localPath, 'AGENTS.md');

    const scores: Array<{ file: string; score: number; notes: string[] }> = [];

    // Score copilot-instructions.md
    try {
      const content = await readFile(copilotInstr, 'utf-8');
      let score = 0;
      const notes: string[] = [];

      if (content.length > 200) score += 20; else notes.push('Too short (<200 chars)');
      if (content.includes('##')) score += 15; else notes.push('No structured headings');
      if (/\btsc\b|typescript/i.test(content)) score += 10; else notes.push('No TypeScript rules');
      if (/\bcommit|pre-commit/i.test(content)) score += 10; else notes.push('No commit workflow');
      if (/\bsupabase|database/i.test(content)) score += 10; else notes.push('No database rules');
      if (/\bdo\b.*\bdon't\b/is.test(content)) score += 10; else notes.push('No DO/DON\'T section');
      if (content.includes('```')) score += 10; else notes.push('No code examples');
      if (/\blast\s+updated/i.test(content)) score += 5; else notes.push('No last-updated date');
      if (content.length > 1000) score += 10; else notes.push('Minimal content');

      scores.push({ file: 'copilot-instructions.md', score, notes });
    } catch { /* no file */ }

    // Score AGENTS.md
    try {
      const content = await readFile(agentsMd, 'utf-8');
      let score = 0;
      const notes: string[] = [];

      if (content.length > 300) score += 20; else notes.push('Too short');
      if (content.includes('##')) score += 15; else notes.push('No structured headings');
      if (/\barchitecture|structure/i.test(content)) score += 15; else notes.push('No architecture section');
      if (/\bbuild|command/i.test(content)) score += 15; else notes.push('No build commands');
      if (content.includes('```')) score += 15; else notes.push('No code examples');
      if (/\bcritical|important|must/i.test(content)) score += 10; else notes.push('No critical warnings');
      if (/\bconvention/i.test(content)) score += 10; else notes.push('No conventions section');

      scores.push({ file: 'AGENTS.md', score, notes });
    } catch { /* no file */ }

    // Score instruction files
    try {
      const instrFiles = (await readdir(instrDir)).filter(f => f.endsWith('.instructions.md'));
      for (const f of instrFiles.slice(0, 10)) {
        try {
          const content = await readFile(join(instrDir, f), 'utf-8');
          let score = 0;
          const notes: string[] = [];

          if (/^---\napplyTo:/m.test(content)) score += 25; else notes.push('Missing applyTo frontmatter');
          if (content.length > 100) score += 25; else notes.push('Too short');
          if (content.includes('##')) score += 25; else notes.push('No headings');
          if (content.includes('```') || content.includes('`')) score += 25; else notes.push('No code refs');

          scores.push({ file: f, score, notes });
        } catch { /* skip */ }
      }
    } catch { /* no instructions dir */ }

    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
      : 0;

    for (const s of scores) {
      ctx.logger.info(`  ${s.file}: ${s.score}/100${s.notes.length > 0 ? ` (${s.notes.join(', ')})` : ''}`);
    }
    ctx.logger.info(`Average: ${avgScore}/100`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: avgScore >= 60 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${scores.length} files scored, avg ${avgScore}/100`,
      artifacts: scores.filter(s => s.score < 60).map(s => `low-score:${s.file}:${s.score}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Token Budget Estimator
// ---------------------------------------------------------------------------

const tokenBudgetEstimator: Agent = {
  id: 'token-budget-estimator',
  name: 'Token Budget Estimator',
  description: 'Estimate total token cost of all AI context files (copilot-instructions, AGENTS.md, prompts)',
  clusterId: 'ai-gateway',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Token Budget: ${ctx.repoAlias}`);

    const contextFiles = [
      '.github/copilot-instructions.md',
      'AGENTS.md',
      'CLAUDE.md',
    ];

    let totalTokens = 0;
    const breakdown: string[] = [];

    // Fixed context files
    for (const f of contextFiles) {
      try {
        const content = await readFile(join(ctx.localPath, f), 'utf-8');
        const tokens = estimateTokens(content);
        totalTokens += tokens;
        breakdown.push(`${f}: ~${tokens} tokens`);
      } catch { /* skip */ }
    }

    // Instruction files
    try {
      const instrDir = join(ctx.localPath, '.github', 'instructions');
      const instrFiles = (await readdir(instrDir)).filter(f => f.endsWith('.md'));
      let instrTokens = 0;
      for (const f of instrFiles) {
        try {
          const content = await readFile(join(instrDir, f), 'utf-8');
          instrTokens += estimateTokens(content);
        } catch { /* skip */ }
      }
      totalTokens += instrTokens;
      breakdown.push(`.github/instructions/ (${instrFiles.length} files): ~${instrTokens} tokens`);
    } catch { /* no dir */ }

    // Prompt files
    const promptFiles = await collectFiles(ctx.localPath, ['.prompt.md']);
    let promptTokens = 0;
    for (const f of promptFiles) {
      try {
        const content = await readFile(f, 'utf-8');
        promptTokens += estimateTokens(content);
      } catch { /* skip */ }
    }
    totalTokens += promptTokens;
    breakdown.push(`Prompt files (${promptFiles.length}): ~${promptTokens} tokens`);

    const status = totalTokens > 50000 ? 'failed' : 'success';
    ctx.logger.info(`Total context: ~${totalTokens} tokens`);
    for (const b of breakdown) ctx.logger.info(`  ${b}`);
    if (totalTokens > 50000) {
      ctx.logger.warn('  ⚠️ Over 50K tokens — agents may lose context. Consider pruning.');
    }
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status,
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `~${totalTokens} total context tokens (${breakdown.length} sources)`,
      artifacts: breakdown,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: AI Config Consistency Checker
// ---------------------------------------------------------------------------

const aiConfigConsistencyChecker: Agent = {
  id: 'ai-config-consistency',
  name: 'AI Config Consistency',
  description: 'Ensure AGENTS.md, copilot-instructions.md, and instruction files are consistent (no conflicts)',
  clusterId: 'ai-gateway',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`AI Config Consistency: ${ctx.repoAlias}`);

    const conflicts: string[] = [];

    // Read both main instruction files
    let copilotInstr = '';
    let agentsContent = '';
    try { copilotInstr = await readFile(join(ctx.localPath, '.github', 'copilot-instructions.md'), 'utf-8'); } catch { /* skip */ }
    try { agentsContent = await readFile(join(ctx.localPath, 'AGENTS.md'), 'utf-8'); } catch { /* skip */ }

    if (!copilotInstr && !agentsContent) {
      ctx.logger.info('No AI config files found');
      ctx.logger.groupEnd();
      return {
        agentId: this.id, status: 'skipped', repo: ctx.repoAlias,
        duration: Date.now() - start, message: 'No AI config files', artifacts: [],
      };
    }

    // Check for Supabase project ID consistency
    const supabaseIdPattern = /project[_-]?id[:\s]+['"]?(\w+)/gi;
    const copilotIds = [...copilotInstr.matchAll(supabaseIdPattern)].map(m => m[1]);
    const agentsIds = [...agentsContent.matchAll(supabaseIdPattern)].map(m => m[1]);

    if (copilotIds.length > 0 && agentsIds.length > 0) {
      const copilotSet = new Set(copilotIds);
      const agentsSet = new Set(agentsIds);
      for (const id of agentsSet) {
        if (!copilotSet.has(id)) {
          conflicts.push(`Supabase project ID "${id}" in AGENTS.md but not in copilot-instructions.md`);
        }
      }
    }

    // Check build commands consistency
    const buildCmds = ['tsc --noEmit', 'npm run lint', 'npm run build'];
    for (const cmd of buildCmds) {
      const inCopilot = copilotInstr.includes(cmd);
      const inAgents = agentsContent.includes(cmd);
      if (inCopilot !== inAgents && (copilotInstr.length > 0 && agentsContent.length > 0)) {
        conflicts.push(`"${cmd}" mentioned in ${inCopilot ? 'copilot-instructions' : 'AGENTS.md'} but not the other`);
      }
    }

    ctx.logger.info(`${conflicts.length} consistency issues`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: conflicts.length === 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${conflicts.length} config consistency issues`,
      artifacts: conflicts,
    };
  },
};

export const aiGatewayAgents: Agent[] = [
  promptTemplateValidator,
  instructionQualityScorer,
  tokenBudgetEstimator,
  aiConfigConsistencyChecker,
];
