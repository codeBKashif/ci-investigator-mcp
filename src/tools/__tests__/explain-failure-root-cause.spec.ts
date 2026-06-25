import { describe, expect, it, vi } from 'vitest';

import { summarizeFailure } from '../summarize-failure.js';
import { explainFailureRootCause } from '../explain-failure-root-cause.js';

vi.mock('../summarize-failure.js', () => ({
  summarizeFailure: vi.fn(),
}));

describe('explainFailureRootCause', () => {
  it('classifies lint/type failures from log patterns', async () => {
    vi.mocked(summarizeFailure).mockResolvedValue({
      run_id: 77,
      failed_job: 'build',
      failed_step: 'lint',
      log_excerpt: 'TS2345: Argument of type string is not assignable\neslint failed',
    });

    const result = await explainFailureRootCause('octo', 'repo', 77);

    expect(result.category).toBe('lint_or_type');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.failed_job).toBe('build');
  });
});
