import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../../github/get-client.js';
import { createRun } from '../../tests/helper.js';
import { fetchFailedRuns } from '../failed-runs.js';

vi.mock('../../github/get-client.js', () => ({
  getClient: vi.fn(),
}));

describe('fetchFailedRuns', () => {
  const mockClient = {
    getRuns: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(mockClient as never);
  });

  it('maps failed runs into the public response shape', async () => {
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        createRun({
          id: 7,
          name: 'Build and Test',
          head_branch: 'release',
          head_sha: '1234567890abcdef',
          html_url: 'https://github.com/octo/repo/actions/runs/7',
        }),
      ],
    });

    const result = await fetchFailedRuns('octo', 'repo', 5);

    expect(result).toEqual([
      {
        id: 7,
        name: 'Build and Test',
        branch: 'release',
        commit: '1234567',
        url: 'https://github.com/octo/repo/actions/runs/7',
        created_at: '2026-06-24T10:00:00Z',
        updated_at: '2026-06-24T10:05:00Z',
      },
    ]);
  });

  it('uses the default failure filter and limit', async () => {
    mockClient.getRuns.mockResolvedValue({ workflow_runs: [] });

    await fetchFailedRuns('octo', 'repo');

    expect(mockClient.getRuns).toHaveBeenCalledWith('octo', 'repo', {
      status: 'failure',
      per_page: 10,
    });
  });

  it('returns an empty array when there are no failed runs', async () => {
    mockClient.getRuns.mockResolvedValue({ workflow_runs: [] });

    await expect(fetchFailedRuns('octo', 'repo', 3)).resolves.toEqual([]);
  });
});
