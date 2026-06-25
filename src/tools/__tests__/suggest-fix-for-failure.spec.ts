import { describe, expect, it, vi } from 'vitest';

import { explainFailureRootCause } from '../explain-failure-root-cause.js';
import { suggestFixForFailure } from '../suggest-fix-for-failure.js';

vi.mock('../explain-failure-root-cause.js', () => ({
  explainFailureRootCause: vi.fn(),
}));

describe('suggestFixForFailure', () => {
  it('returns category-specific suggestions', async () => {
    vi.mocked(explainFailureRootCause).mockResolvedValue({
      run_id: 11,
      category: 'timeout',
      confidence: 0.85,
      evidence: ['timed out after 10m'],
      failed_job: 'integration',
      failed_step: 'run tests',
    });

    const result = await suggestFixForFailure('octo', 'repo', 11);

    expect(result.category).toBe('timeout');
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.validation_steps.length).toBeGreaterThan(0);
  });
});
