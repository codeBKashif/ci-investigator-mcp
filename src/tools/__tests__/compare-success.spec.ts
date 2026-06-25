import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../../github/get-client.js';
import { createRun } from '../../tests/helper.js';
import { compareWithLastSuccess } from '../compare-success.js';

vi.mock('../../github/get-client.js', () => ({
  getClient: vi.fn(),
}));

describe('compareWithLastSuccess', () => {
  const mockClient = {
    getRuns: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(mockClient as never);
  });

  it('compares a failed run with the latest prior success on the same branch', async () => {
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        createRun({
          id: 10,
          conclusion: 'failure',
          head_sha: 'bbbbbbbbbbbbbbbb',
          created_at: '2026-06-24T12:00:00Z',
          head_commit: {
            message: 'Break CI\n\nMore details',
            author: { name: 'Ali' },
          },
          event: 'pull_request',
        }),
        createRun({
          id: 9,
          conclusion: 'success',
          head_sha: 'aaaaaaaaaaaaaaaa',
          created_at: '2026-06-24T11:00:00Z',
          head_commit: {
            message: 'Base commit\n\nwith details',
            author: { name: 'Kashif' },
          },
        }),
        createRun({
          id: 8,
          conclusion: 'success',
          head_branch: 'develop',
          created_at: '2026-06-24T11:30:00Z',
        }),
      ],
    });

    const result = await compareWithLastSuccess('octo', 'repo', 10);

    expect(mockClient.getRuns).toHaveBeenCalledWith('octo', 'repo', {
      per_page: 100,
      status: 'completed',
    });
    expect(result).toEqual({
      failed_run: {
        id: 10,
        commit: 'bbbbbbb',
        commit_message: 'Break CI',
        author: 'Ali',
        branch: 'main',
        created_at: '2026-06-24T12:00:00Z',
        event: 'pull_request',
      },
      last_success: {
        id: 9,
        commit: 'aaaaaaa',
        commit_message: 'Base commit',
        author: 'Kashif',
        branch: 'main',
        created_at: '2026-06-24T11:00:00Z',
        event: 'push',
      },
      diff: {
        commit_changed: true,
        author_changed: true,
        event_changed: true,
        commits_between: 'https://github.com/octo/repo/compare/aaaaaaaaaaaaaaaa...bbbbbbbbbbbbbbbb',
      },
    });
  });

  it('returns a null baseline when no earlier success exists on the branch', async () => {
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        createRun({
          id: 22,
          conclusion: 'failure',
          created_at: '2026-06-24T12:00:00Z',
        }),
        createRun({
          id: 21,
          conclusion: 'success',
          head_branch: 'release',
          created_at: '2026-06-24T11:00:00Z',
        }),
      ],
    });

    const result = await compareWithLastSuccess('octo', 'repo', 22);

    expect(result.last_success).toBeNull();
    expect(result.diff).toEqual({
      commit_changed: false,
      author_changed: false,
      event_changed: false,
      commits_between: 'no previous success found on this branch',
    });
  });

  it('throws when the requested run id does not exist', async () => {
    mockClient.getRuns.mockResolvedValue({ workflow_runs: [createRun({ id: 1 })] });

    await expect(compareWithLastSuccess('octo', 'repo', 99)).rejects.toThrow('Run 99 not found');
  });

  it('ignores runs from different branches when finding the baseline', async () => {
    // Simulates branch filtering optimization: filters by branch first
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        // Failed run on main
        createRun({
          id: 100,
          head_branch: 'main',
          conclusion: 'failure',
          created_at: '2026-06-24T12:00:00Z',
        }),
        // Recent success on develop (should be ignored)
        createRun({
          id: 99,
          head_branch: 'develop',
          conclusion: 'success',
          created_at: '2026-06-24T11:50:00Z',
        }),
        // Older success on main (should be used)
        createRun({
          id: 98,
          head_branch: 'main',
          conclusion: 'success',
          created_at: '2026-06-24T11:00:00Z',
        }),
      ],
    });

    const result = await compareWithLastSuccess('octo', 'repo', 100);

    // Should compare with run 98 (same branch), not 99 (different branch)
    expect(result.last_success?.id).toBe(98);
    expect(result.last_success?.branch).toBe('main');
  });
});
