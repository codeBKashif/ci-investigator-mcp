import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../../github/get-client.js';
import { createRun } from '../../tests/helper.js';
import { findRegressionPrOrCommit } from '../find-regression-pr-or-commit.js';

vi.mock('../../github/get-client.js', () => ({
  getClient: vi.fn(),
}));

describe('findRegressionPrOrCommit', () => {
  const mockClient = {
    getRuns: vi.fn(),
    getCommitPullRequests: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(mockClient as never);
  });

  it('returns suspect commit and linked pull request', async () => {
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        createRun({
          id: 100,
          conclusion: 'failure',
          head_sha: 'bbbbbbbbbbbbbbbb',
          created_at: '2026-06-24T12:00:00Z',
        }),
        createRun({
          id: 99,
          conclusion: 'success',
          head_sha: 'aaaaaaaaaaaaaaaa',
          created_at: '2026-06-24T11:00:00Z',
        }),
      ],
    });

    mockClient.getCommitPullRequests.mockResolvedValue([
      {
        number: 42,
        title: 'Fix parser',
        html_url: 'https://github.com/octo/repo/pull/42',
        state: 'closed',
        merged_at: '2026-06-24T10:00:00Z',
      },
    ]);

    const result = await findRegressionPrOrCommit('octo', 'repo', 100);

    expect(result.suspect_commit_sha).toBe('bbbbbbbbbbbbbbbb');
    expect(result.suspect_pr?.number).toBe(42);
    expect(result.compare_url).toContain('aaaaaaaaaaaaaaaa...bbbbbbbbbbbbbbbb');
  });
});
