import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../../github/get-client.js';
import { createJob, createRun } from '../../tests/helper.js';
import { calculateCiHealthScore } from '../ci-health-score.js';

vi.mock('../../github/get-client.js', () => ({
  getClient: vi.fn(),
}));

describe('calculateCiHealthScore', () => {
  const mockClient = {
    getRuns: vi.fn(),
    getJobs: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(mockClient as never);
  });

  it('computes rates, flaky job count, and score', async () => {
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        createRun({ id: 1, conclusion: 'success', created_at: '2099-01-01T10:00:00Z' }),
        createRun({ id: 2, conclusion: 'failure', created_at: '2099-01-01T11:00:00Z' }),
      ],
    });

    mockClient.getJobs.mockImplementation(async (_owner: string, _repo: string, runId: number) => ({
      jobs:
        runId === 1
          ? [createJob({ name: 'unit', conclusion: 'success' })]
          : [createJob({ name: 'unit', conclusion: 'failure' })],
    }));

    const result = await calculateCiHealthScore('octo', 'repo', 'main', 30, 50);

    expect(result.total_runs).toBe(2);
    expect(result.pass_rate).toBe(0.5);
    expect(result.failure_rate).toBe(0.5);
    expect(result.flaky_jobs).toBe(1);
  });
});
