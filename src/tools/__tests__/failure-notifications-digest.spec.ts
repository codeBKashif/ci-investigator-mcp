import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../../github/get-client.js';
import { createRun } from '../../tests/helper.js';
import { summarizeFailure } from '../summarize-failure.js';
import { buildFailureNotificationsDigest } from '../failure-notifications-digest.js';

vi.mock('../../github/get-client.js', () => ({
  getClient: vi.fn(),
}));

vi.mock('../summarize-failure.js', () => ({
  summarizeFailure: vi.fn(),
}));

describe('buildFailureNotificationsDigest', () => {
  const mockClient = {
    getRuns: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(mockClient as never);
  });

  it('groups similar failures by signature', async () => {
    mockClient.getRuns.mockResolvedValue({
      workflow_runs: [
        createRun({ id: 11, created_at: '2099-01-01T10:00:00Z' }),
        createRun({ id: 12, created_at: '2099-01-01T11:00:00Z' }),
      ],
    });

    vi.mocked(summarizeFailure)
      .mockResolvedValueOnce({
        run_id: 11,
        failed_job: 'build',
        failed_step: 'test',
        log_excerpt: 'assertion failed',
      })
      .mockResolvedValueOnce({
        run_id: 12,
        failed_job: 'build',
        failed_step: 'test',
        log_excerpt: 'assertion failed again',
      });

    const result = await buildFailureNotificationsDigest('octo', 'repo', 24, 'main', 10);

    expect(result.total_failures).toBe(2);
    expect(result.grouped_failures).toHaveLength(1);
    expect(result.grouped_failures[0].signature).toBe('build::test');
    expect(result.grouped_failures[0].occurrences).toBe(2);
  });
});
