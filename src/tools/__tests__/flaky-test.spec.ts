import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../../github/get-client.js';
import { createJob, createRun } from '../../tests/helper.js';
import { GitHubJob } from '../../types.js';
import { detectFlakyTests } from '../flaky-test.js';

vi.mock('../../github/get-client.js', () => ({
  getClient: vi.fn(),
}));

describe('detectFlakyTests', () => {
  const mockClient = {
    getRuns: vi.fn(),
    getJobs: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(mockClient as never);
  });

  it('aggregates pass and fail counts for jobs on the selected branch', async () => {
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        createRun({ id: 1, head_branch: 'main', created_at: '2026-06-24T09:00:00Z' }),
        createRun({ id: 2, head_branch: 'main', created_at: '2026-06-24T10:00:00Z' }),
        createRun({ id: 3, head_branch: 'main', created_at: '2026-06-24T11:00:00Z' }),
        createRun({ id: 4, head_branch: 'develop', created_at: '2026-06-24T12:00:00Z' }),
      ],
    });

    mockClient.getJobs.mockImplementation(async (_owner: string, _repo: string, runId: number) => {
      const jobsByRun: Record<number, GitHubJob[]> = {
        1: [createJob({ name: 'unit', conclusion: 'success' })],
        2: [
          createJob({ name: 'unit', conclusion: 'failure' }),
          createJob({ id: 2, name: 'integration', conclusion: 'success' }),
        ],
        3: [
          createJob({ name: 'unit', conclusion: 'failure' }),
          createJob({ id: 2, name: 'integration', conclusion: 'failure' }),
        ],
      };

      return { jobs: jobsByRun[runId] ?? [] };
    });

    const result = await detectFlakyTests('octo', 'repo', 'main', 10);

    expect(mockClient.getRuns).toHaveBeenCalledWith('octo', 'repo', {
      per_page: 10,
      status: 'completed',
    });
    expect(result).toEqual({
      repo: 'octo/repo',
      branch: 'main',
      total_runs_analyzed: 3,
      flaky_jobs: [
        {
          job_name: 'integration',
          pass_count: 1,
          fail_count: 1,
          flakiness_score: 0.5,
          last_seen: '2026-06-24T11:00:00Z',
        },
        {
          job_name: 'unit',
          pass_count: 1,
          fail_count: 2,
          flakiness_score: 0.67,
          last_seen: '2026-06-24T11:00:00Z',
        },
      ].sort((a, b) => b.flakiness_score - a.flakiness_score),
    });
  });

  it('ignores runs whose jobs cannot be fetched', async () => {
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        createRun({ id: 10, head_branch: 'main', created_at: '2026-06-24T09:00:00Z' }),
        createRun({ id: 11, head_branch: 'main', created_at: '2026-06-24T10:00:00Z' }),
      ],
    });

    mockClient.getJobs.mockImplementation(async (_owner: string, _repo: string, runId: number) => {
      if (runId === 11) {
        throw new Error('rate limited');
      }

      return { jobs: [createJob({ name: 'unit', conclusion: 'success' })] };
    });

    const result = await detectFlakyTests('octo', 'repo', 'main', 10);

    expect(result.total_runs_analyzed).toBe(2);
    expect(result.flaky_jobs).toEqual([]);
  });
});
