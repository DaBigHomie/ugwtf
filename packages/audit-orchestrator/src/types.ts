/**
 * @dabighomie/audit-orchestrator — Core types
 */

export interface AuditIssue {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: AuditCategory;
  description: string;
  affectedFiles: string[];
  completionPct: number;
  promptId?: string;
}

export type AuditCategory =
  | 'dark-mode'
  | 'layout'
  | 'content'
  | 'design'
  | 'functionality'
  | 'mobile'
  | 'accessibility'
  | 'integration'
  | 'checkout'
  | 'collections'
  | 'marquee'
  | 'testing';

export interface PromptCluster {
  id: string;
  name: string;
  prompts: string[];
  canParallelize: boolean;
  dependsOn: string[];
  estimatedMinutes: number;
  agentCount: number;
}

export interface AuditResult {
  totalIssues: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  overallCompletion: number;
  clusters: PromptCluster[];
  issues: AuditIssue[];
  timestamp: string;
  cwd: string;
  framework: string;
}

export interface FrameworkAdapter {
  framework: 'nextjs' | 'vite-react';
  resolveStylesheet(root: string): string;
  resolveConfig(root: string): string;
  resolveLayout(root: string): string;
  resolvePages(root: string): string;
  resolveComponents(root: string): string;
  resolveSrc(root: string): string;
  detectFramework(root: string): boolean;
}

export interface AuditRuleContext {
  root: string;
  adapter: FrameworkAdapter;
}

export type AuditRule = (ctx: AuditRuleContext) => AuditIssue[];

export interface ReporterOptions {
  result: AuditResult;
  outputPath?: string;
  verbose?: boolean;
}
