/**
 * Copilot Full Automation Generator — Unit Tests
 *
 * Tests the self-healing hardening features:
 * - Error output capture in Phase 3 (tsc, eslint, build)
 * - Retry counting in Phase 7
 * - Structured fix request comments
 * - Give-up after 3 attempts (escalation to human)
 */
import { describe, it, expect } from 'vitest';
import { generateCopilotFullAutomation } from './copilot-automation.js';
import type { RepoConfig } from '../config/repo-registry.js';

const baseRepo: RepoConfig = {
  alias: 'test-repo',
  slug: 'DaBigHomie/test-repo',
  framework: 'vite-react',
  supabaseProjectId: 'abc123',
  supabaseUrlSecret: 'SUPABASE_URL_TEST',
  supabaseServiceKeySecret: 'SUPABASE_SERVICE_ROLE_KEY_TEST',
  supabaseTypesPath: 'src/integrations/supabase/types.ts',
  extraLabels: [],
  localPath: '/tmp/test-repo',
  nodeVersion: '20',
  defaultBranch: 'main',
  hasE2E: false,
  e2eCommand: null,
};

describe('generateCopilotFullAutomation', () => {
  let yaml: string;

  // Generate once and reuse for all assertions
  yaml = generateCopilotFullAutomation(baseRepo);

  describe('Phase 3: error output capture', () => {
    it('declares tsc_errors, lint_errors, build_errors as job outputs', () => {
      expect(yaml).toContain('tsc_errors: ${{ steps.typescript.outputs.errors }}');
      expect(yaml).toContain('lint_errors: ${{ steps.eslint.outputs.errors }}');
      expect(yaml).toContain('build_errors: ${{ steps.build.outputs.errors }}');
    });

    it('captures TypeScript output into GITHUB_OUTPUT with heredoc', () => {
      expect(yaml).toContain('TSC_OUTPUT=$(npx tsc --noEmit 2>&1)');
      expect(yaml).toContain('grep -E "error TS"');
      expect(yaml).toContain('echo "errors<<UGWTF_EOF"');
    });

    it('captures ESLint output into GITHUB_OUTPUT', () => {
      expect(yaml).toContain('LINT_OUTPUT=$(npm run lint 2>&1)');
      expect(yaml).toContain('LINT_ERRORS=');
    });

    it('captures Build output into GITHUB_OUTPUT', () => {
      expect(yaml).toContain('BUILD_OUTPUT=$(npm run build 2>&1)');
      expect(yaml).toContain('BUILD_ERRORS=');
    });

    it('preserves original exit codes via set +e / exit $EXIT', () => {
      expect(yaml).toContain('TSC_EXIT=$?');
      expect(yaml).toContain('exit $TSC_EXIT');
      expect(yaml).toContain('LINT_EXIT=$?');
      expect(yaml).toContain('exit $LINT_EXIT');
      expect(yaml).toContain('BUILD_EXIT=$?');
      expect(yaml).toContain('exit $BUILD_EXIT');
    });
  });

  describe('Phase 7: retry counting', () => {
    it('counts previous fix attempt comments', () => {
      expect(yaml).toContain("c.body.includes('UGWTF Fix Attempt')");
      expect(yaml).toContain("core.setOutput('attempt_number'");
    });

    it('sets should_give_up threshold at 2 previous attempts', () => {
      expect(yaml).toContain("attempts >= 2 ? 'true' : 'false'");
    });
  });

  describe('Phase 7: structured fix request', () => {
    it('passes error outputs from Phase 3 to Phase 7 via env vars', () => {
      expect(yaml).toContain('TSC_ERRORS: ${{ needs.validate-pr.outputs.tsc_errors }}');
      expect(yaml).toContain('LINT_ERRORS: ${{ needs.validate-pr.outputs.lint_errors }}');
      expect(yaml).toContain('BUILD_ERRORS: ${{ needs.validate-pr.outputs.build_errors }}');
    });

    it('includes error sections in the fix request comment', () => {
      expect(yaml).toContain('### TypeScript Errors');
      expect(yaml).toContain('### ESLint Errors');
      expect(yaml).toContain('### Build Errors');
    });

    it('includes attempt counter in comment header', () => {
      expect(yaml).toContain('UGWTF Fix Attempt ${attempt}/3');
    });

    it('warns on last automatic attempt', () => {
      expect(yaml).toContain('Last automatic attempt');
    });

    it('has fallback for missing error output', () => {
      expect(yaml).toContain('No specific error output captured');
    });
  });

  describe('Phase 7: give-up after 3 attempts', () => {
    it('has escalation step that runs when should_give_up is true', () => {
      expect(yaml).toContain("steps.count-attempts.outputs.should_give_up == 'true'");
      expect(yaml).toContain('Max Retries Exceeded');
    });

    it('removes automation:in-progress label on escalation', () => {
      expect(yaml).toContain("name: 'automation:in-progress'");
    });

    it('adds needs-human-review label on escalation', () => {
      expect(yaml).toContain("'needs-review', 'needs-human-review'");
    });

    it('does NOT re-assign Copilot when giving up', () => {
      // The escalation step should not contain addAssignees
      // Split yaml to find escalation section
      const escalateIdx = yaml.indexOf('Escalate to human');
      const fixRequestIdx = yaml.indexOf('Post structured fix request');
      const escalateSection = yaml.slice(escalateIdx, fixRequestIdx);
      expect(escalateSection).not.toContain('addAssignees');
    });

    it('only re-assigns Copilot in the fix request step (not escalation)', () => {
      const fixRequestIdx = yaml.indexOf('Post structured fix request');
      const fixRequestSection = yaml.slice(fixRequestIdx);
      expect(fixRequestSection).toContain("assignees: ['copilot']");
    });
  });

  describe('Phase 7: conditional execution', () => {
    it('fix request step only runs when should_give_up is false', () => {
      expect(yaml).toContain("steps.count-attempts.outputs.should_give_up == 'false'");
    });

    it('Phase 7 job depends on validate-pr', () => {
      // Find the handle-failure job section
      const handleFailureIdx = yaml.indexOf('handle-failure:');
      const section = yaml.slice(handleFailureIdx, handleFailureIdx + 200);
      expect(section).toContain('needs: validate-pr');
    });

    it('Phase 7 runs only when all_checks_passed is false', () => {
      const handleFailureIdx = yaml.indexOf('handle-failure:');
      const section = yaml.slice(handleFailureIdx, handleFailureIdx + 200);
      expect(section).toContain("needs.validate-pr.outputs.all_checks_passed == 'false'");
    });
  });
});
