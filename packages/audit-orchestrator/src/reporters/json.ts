/**
 * Reporter: JSON — structured output for CI/CD and tooling.
 */

import { writeFileSync } from 'node:fs';
import type { AuditResult, ReporterOptions } from '../types.js';

export function reportJson(options: ReporterOptions): void {
  const json = JSON.stringify(options.result, null, 2);

  if (options.outputPath) {
    writeFileSync(options.outputPath, json);
    if (options.verbose) console.log(`JSON written to ${options.outputPath}`);
  } else {
    console.log(json);
  }
}
