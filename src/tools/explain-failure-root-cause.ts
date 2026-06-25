import { summarizeFailure } from './summarize-failure.js';
import { RootCauseAnalysis } from '../types.js';

function collectEvidence(logExcerpt: string, patterns: RegExp[]): string[] {
  const lines = logExcerpt.split('\n');
  const evidence = lines.filter((line) => patterns.some((pattern) => pattern.test(line)));
  return evidence.slice(0, 5);
}

const rulebook: Array<{
  category: RootCauseAnalysis['category'];
  confidence: number;
  patterns: RegExp[];
}> = [
  {
    category: 'auth_permissions',
    confidence: 0.9,
    patterns: [/403/, /401/, /forbidden/, /unauthorized/, /permission denied/, /token/],
  },
  {
    category: 'lint_or_type',
    confidence: 0.85,
    patterns: [/eslint/, /ts\d{4}/, /type error/, /compilation failed/, /no-unused-vars/],
  },
  {
    category: 'timeout',
    confidence: 0.85,
    patterns: [/timed out/, /timeout/, /deadline exceeded/, /operation exceeded/],
  },
  {
    category: 'dependency',
    confidence: 0.8,
    patterns: [/npm err/, /cannot find module/, /module not found/, /lockfile/, /peer dep/],
  },
  {
    category: 'infra_network',
    confidence: 0.8,
    patterns: [/econnreset/, /etimedout/, /network error/, /service unavailable/, /502|503|504/],
  },
  {
    category: 'test_regression',
    confidence: 0.75,
    patterns: [/failing test/, /assertionerror/, /expected .* to/, /test failed/, /vitest/],
  },
];

export async function explainFailureRootCause(
  owner: string,
  repo: string,
  runId: number,
): Promise<RootCauseAnalysis> {
  const summary = await summarizeFailure(owner, repo, runId);
  const logExcerpt = summary.log_excerpt.toLowerCase();

  for (const rule of rulebook) {
    if (rule.patterns.some((pattern) => pattern.test(logExcerpt))) {
      const evidence = collectEvidence(summary.log_excerpt, rule.patterns);
      return {
        run_id: runId,
        category: rule.category,
        confidence: rule.confidence,
        evidence,
        failed_job: summary.failed_job,
        failed_step: summary.failed_step,
      };
    }
  }

  return {
    run_id: runId,
    category: 'unknown',
    confidence: 0.4,
    evidence: summary.log_excerpt.split('\n').slice(0, 3),
    failed_job: summary.failed_job,
    failed_step: summary.failed_step,
  };
}
