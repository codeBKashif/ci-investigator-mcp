import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../../github/get-client.js';
import { rerunAndTrack } from '../rerun-and-track.js';

vi.mock('../../github/get-client.js', () => ({
  getClient: vi.fn(),
}));

describe('rerunAndTrack', () => {
  const mockClient = {
    rerunFailedJobs: vi.fn(),
    rerunRun: vi.fn(),
    getRun: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(mockClient as never);
  });

  it('triggers rerun and returns immediate status when wait is disabled', async () => {
    mockClient.getRun.mockResolvedValue({ status: 'queued', conclusion: null });

    const result = await rerunAndTrack('octo', 'repo', 55, 'failed_jobs', false, 3, 1);

    expect(mockClient.rerunFailedJobs).toHaveBeenCalledWith('octo', 'repo', 55);
    expect(result.latest_status).toBe('queued');
    expect(result.poll_attempts).toBe(1);
  });
});
