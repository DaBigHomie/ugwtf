/**
 * Scaffold: new-agent
 *
 * Generates a boilerplate agent file and wires it into the cluster registry.
 *
 * Usage:
 *   ugwtf new-agent <agent-id> --cluster <cluster-id>
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(__dirname, '..');

interface NewAgentOptions {
  agentId: string;
  clusterId: string;
}

function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toPascalCase(kebab: string): string {
  const camel = toCamelCase(kebab);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function generateAgentCode(opts: NewAgentOptions): string {
  const constName = `${toCamelCase(opts.agentId)}Agent`;
  return `import type { Agent, AgentContext, AgentResult } from '../types.js';

const ${constName}: Agent = {
  id: '${opts.agentId}',
  name: '${toPascalCase(opts.agentId).replace(/([A-Z])/g, ' $1').trim()}',
  description: 'TODO: describe what this agent does',
  clusterId: '${opts.clusterId}',

  shouldRun(_ctx: AgentContext): boolean {
    return true;
  },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();

    // TODO: implement agent logic

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: '${toPascalCase(opts.agentId)} completed',
      artifacts: [],
    };
  },
};

export const agents = [${constName}];
`;
}

export function scaffoldAgent(opts: NewAgentOptions): void {
  const agentFile = resolve(SRC_ROOT, 'agents', `${opts.clusterId}-agents.ts`);

  if (existsSync(agentFile)) {
    // Append to existing file
    const existing = readFileSync(agentFile, 'utf-8');
    const constName = `${toCamelCase(opts.agentId)}Agent`;

    if (existing.includes(`id: '${opts.agentId}'`)) {
      console.error(`Agent '${opts.agentId}' already exists in ${agentFile}`);
      process.exit(1);
    }

    // Add the new agent constant before the exports array
    const agentBlock = `
const ${constName}: Agent = {
  id: '${opts.agentId}',
  name: '${toPascalCase(opts.agentId).replace(/([A-Z])/g, ' $1').trim()}',
  description: 'TODO: describe what this agent does',
  clusterId: '${opts.clusterId}',

  shouldRun(_ctx: AgentContext): boolean {
    return true;
  },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();

    // TODO: implement agent logic

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: '${toPascalCase(opts.agentId)} completed',
      artifacts: [],
    };
  },
};
`;

    // Insert before the last export
    const exportMatch = existing.match(/export const agents = \[([^\]]*)\]/);
    if (exportMatch) {
      const updated = existing.replace(
        /export const agents = \[([^\]]*)\]/,
        `${agentBlock}\nexport const agents = [$1, ${constName}]`,
      );
      writeFileSync(agentFile, updated, 'utf-8');
    } else {
      // Just append
      writeFileSync(agentFile, existing + agentBlock, 'utf-8');
    }

    console.log(`✅ Added agent '${opts.agentId}' to ${agentFile}`);
  } else {
    // Create new agents file
    writeFileSync(agentFile, generateAgentCode(opts), 'utf-8');
    console.log(`✅ Created ${agentFile}`);
  }

  console.log(`\nNext steps:`);
  console.log(`  1. Edit ${agentFile} — implement shouldRun() and execute()`);
  console.log(`  2. Wire into cluster: edit src/clusters/index.ts`);
  console.log(`  3. Run: npx tsc --noEmit && npx vitest run`);
}

export function parseNewAgentArgs(args: string[]): NewAgentOptions | null {
  const agentId = args[0];
  const clusterIdx = args.indexOf('--cluster');
  const clusterId = clusterIdx >= 0 ? args[clusterIdx + 1] : undefined;

  if (!agentId || !clusterId) {
    console.log(`
  Usage: ugwtf new-agent <agent-id> --cluster <cluster-id>

  Example:
    ugwtf new-agent rate-limit-check --cluster security
`);
    return null;
  }

  return { agentId, clusterId };
}
