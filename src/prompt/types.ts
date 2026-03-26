/**
 * Prompt types — shared across agents, scoring, and CLI scripts.
 *
 * Unified ParsedPrompt reconciles fields from both:
 *   - src/agents/prompt-agents.ts (format, hasDatabaseSchema)
 *   - scripts/validate-prompts.mts (hasFilesToModify)
 * Plus 4 new boolean fields for the 18-point scoring system.
 */

export interface ParsedPrompt {
  filePath: string;
  fileName: string;
  format: 'A' | 'B';
  title: string;
  priority: string | null;     // P0-P8 or null
  scope: string | null;        // e.g. "shop", "marketing", "db" — from YAML frontmatter
  type: string | null;         // e.g. "feat", "fix", "perf" — from YAML frontmatter
  status: string | null;       // COMPLETE, READY TO START, IN PROGRESS, etc.
  estimatedTime: string | null;
  agentType: string | null;
  revenueImpact: string | null;
  objective: string | null;
  hasSuccessCriteria: boolean;
  hasTestingChecklist: boolean;
  hasDatabaseSchema: boolean;
  hasReferenceImpl: boolean;
  hasCodeExamples: boolean;
  hasFilesToModify: boolean;
  hasTags: boolean;
  hasEnvironment: boolean;
  hasBlockingGate: boolean;
  hasMergeGate: boolean;
  sections: string[];
  checklistItems: number;
  totalLines: number;
  depends: string[];            // dependency references parsed from prompt body
  raw: string;
}

export interface CriterionResult {
  name: string;
  points: number;
  maxPoints: number;
  note: string;
}

export interface ValidationResult {
  prompt: ParsedPrompt;
  score: number;
  maxScore: number;
  percent: number;
  criteria: CriterionResult[];
}
