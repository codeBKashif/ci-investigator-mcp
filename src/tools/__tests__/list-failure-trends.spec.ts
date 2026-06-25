import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../../github/get-client.js';
import { createJob, createRun } from '../../tests/helper.js';
import { listFailureTrends } from '../list-failure-trends.js';

vi.mock('../../github/get-client.js', () => ({
  getClient: vi.fn(),
}));

describe('listFailureTrends', () => {
  const mockClient = {
    getRuns: vi.fn(),
    getJobs: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(mockClient as never);
  });

  it('aggregates top failing jobs within the window', async () => {
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        createRun({ id: 1, created_at: '2099-01-01T10:00:00Z', conclusion: 'failure' }),
        createRun({ id: 2, created_at: '2099-01-01T11:00:00Z', conclusion: 'failure' }),
      ],
    });

    mockClient.getJobs.mockImplementation(async (_owner: string, _repo: string, runId: number) => ({
      jobs:
        runId === 1
          ? [createJob({ name: 'unit', conclusion: 'failure' })]
          : [
              createJob({ name: 'unit', conclusion: 'failure' }),
              createJob({ id: 2, name: 'lint', conclusion: 'failure' }),
            ],
    }));

    const result = await listFailureTrends('octo', 'repo', 30, 'main', 50);

    expect(result.total_failures).toBe(2);
    expect(result.top_failing_jobs[0].job_name).toBe('unit');
    expect(result.top_failing_jobs[0].failures).toBe(2);
  });
});
