#!/usr/bin/env node

/**
 * @dabighomie/audit-orchestrator CLI
 *
 * Usage:
 *   audit-orchestrator                          # Full audit (terminal output)
 *   audit-orchestrator --cwd ../my-project      # Target a different directory
 *   audit-orchestrator --json                   # JSON output to stdout
 *   audit-orchestrator --json -o results.json   # JSON output to file
 *   audit-orchestrator --markdown               # Markdown output to stdout
 *   audit-orchestrator --markdown -o REPORT.md  # Markdown output to file
 *   audit-orchestrator --parallel-map           # Show parallel execution map only
 *   audit-orchestrator --verbose                # Include descriptions and file lists
 */

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { detectAdapter } from './adapters/index.js';
import { buildAuditResult } from './rules/index.js';
import { reportTerminal } from './reporters/terminal.js';
import { reportJson } from './reporters/json.js';
import { reportMarkdown } from './reporters/markdown.js';
import type { AuditRuleContext } from './types.js';

const { values } = parseArgs({
  options: {
    cwd: { type: 'string', default: '.' },
    json: { type: 'boolean', default: false },
    markdown: { type: 'boolean', default: false },
    'parallel-map': { type: 'boolean', default: false },
    cluster: { type: 'string' },
    output: { type: 'string', short: 'o' },
    verbose: { type: 'boolean', short: 'v', default: false },
  },
  strict: true,
  allowPositionals: false,
});

const root = resolve(values.cwd ?? '.');
const adapter = detectAdapter(root);

const ctx: AuditRuleContext = { root, adapter };
const clusterFilter = values.cluster as string | undefined;
const result = buildAuditResult(ctx, clusterFilter);

if (values['parallel-map']) {
  // Reuse terminal reporter's parallel map (just clusters)
  reportTerminal({ result, verbose: false });
} else if (values.json) {
  reportJson({ result, outputPath: values.output, verbose: values.verbose });
} else if (values.markdown) {
  reportMarkdown({ result, outputPath: values.output, verbose: values.verbose });
} else {
  reportTerminal({ result, verbose: values.verbose });

  // Also write JSON result to docs/ if it exists
  const { existsSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const docsDir = join(root, 'docs');
  if (existsSync(docsDir)) {
    const outPath = join(docsDir, 'AUDIT-RESULTS.json');
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Results written to docs/AUDIT-RESULTS.json`);
  }
}
