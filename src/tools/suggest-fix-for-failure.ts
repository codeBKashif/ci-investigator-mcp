import { explainFailureRootCause } from './explain-failure-root-cause.js';
import { SuggestedFix } from '../types.js';

const suggestionMap: Record<string, { suggestions: string[]; validation_steps: string[] }> = {
  auth_permissions: {
    suggestions: [
      'Verify GITHUB_TOKEN permissions include actions:read and checks:read.',
      'Ensure the token is available in the MCP process environment.',
      'If using GitHub App token, check installation access to the repository.',
    ],
    validation_steps: [
      'Run get_failed_runs on the same repo to verify authentication works.',
      'Retry summarize_failure for the failed run and confirm log fetch succeeds.',
    ],
  },
  lint_or_type: {
    suggestions: [
      'Run local lint/type-check and fix reported diagnostics.',
      'Pin toolchain versions to match CI (Node, TypeScript, eslint configs).',
      'Avoid introducing stricter lint rules without updating baseline code.',
    ],
    validation_steps: [
      'Run npm run lint and npm run build locally.',
      'Push fix and verify rerun concludes with success.',
    ],
  },
  timeout: {
    suggestions: [
      'Split long-running job steps into smaller stages.',
      'Increase job timeout in workflow configuration where appropriate.',
      'Cache dependencies/artifacts to reduce setup time.',
    ],
    validation_steps: [
      'Compare step durations before and after change.',
      'Verify rerun completes under timeout threshold.',
    ],
  },
  dependency: {
    suggestions: [
      'Regenerate lockfile and commit deterministic dependency versions.',
      'Check private registry credentials and package availability.',
      'Avoid floating versions for critical build dependencies.',
    ],
    validation_steps: [
      'Run a clean install locally (remove node_modules and lockfile cache).',
      'Confirm dependency install step is stable across two reruns.',
    ],
  },
  infra_network: {
    suggestions: [
      'Add retry/backoff for network-dependent steps.',
      'Use mirrored package registries or service health checks.',
      'Mark flaky external calls as non-blocking when safe.',
    ],
    validation_steps: [
      'Rerun failed jobs and observe whether transient errors disappear.',
      'Check failure trend over 7 days to confirm incident is transient.',
    ],
  },
  test_regression: {
    suggestions: [
      'Inspect failing test assertions and recent code changes in compare URL.',
      'Add or update fixtures/mocks for changed behavior.',
      'Stabilize non-deterministic tests (time, random, async race conditions).',
    ],
    validation_steps: [
      'Run test suite locally for impacted package/test file.',
      'Use detect_flaky_tests to ensure failures are not intermittent.',
    ],
  },
  unknown: {
    suggestions: [
      'Inspect the complete logs and job annotations for hidden error details.',
      'Compare against the last successful run to identify regressions.',
      'Re-run failed jobs to distinguish transient failure from deterministic breakage.',
    ],
    validation_steps: [
      'Execute summarize_failure and compare_with_last_success for the same run.',
      'If reproducible, create an issue with log excerpt and failing step.',
    ],
  },
};

export async function suggestFixForFailure(
  owner: string,
  repo: string,
  runId: number,
): Promise<SuggestedFix> {
  const analysis = await explainFailureRootCause(owner, repo, runId);
  const details = suggestionMap[analysis.category] ?? suggestionMap.unknown;

  return {
    run_id: runId,
    category: analysis.category,
    suggestions: details.suggestions,
    validation_steps: details.validation_steps,
  };
}
