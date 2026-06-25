import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from '../client.js';
import axios from 'axios';
import { LocalCache } from '../../utils/local-cache.js';

vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(),
      isAxiosError: vi.fn(),
    },
  };
});

describe('GitHubClient', () => {
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.mocked(axios.create).mockReturnValue({ get: mockGet } as never);
  });

  describe('getRunLogs', () => {
    it('should call the correct API endpoint with the provided parameters', async () => {
      mockGet.mockResolvedValue({ data: new ArrayBuffer(8) });
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const runId = 123;

      await gitHubClient.getRunLogs(owner, repo, runId);

      expect(mockGet).toHaveBeenCalledWith(`/repos/${owner}/${repo}/actions/runs/${runId}/logs`, {
        responseType: 'arraybuffer',
      });
    });

    it('should throw an error with a descriptive message if the API call fails', async () => {
      const mockError = new Error('Network Error');
      mockGet.mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(false);
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const runId = 123;

      await expect(gitHubClient.getRunLogs(owner, repo, runId)).rejects.toThrow(
        `Failed to fetch runs: ${mockError.message}`,
      );
    });
  });

  describe('getJobLogs', () => {
    it('should call the correct API endpoint with the provided parameters', async () => {
      mockGet.mockResolvedValue({ data: 'job logs' });
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const jobId = 456;

      await gitHubClient.getJobLogs(owner, repo, jobId);

      expect(mockGet).toHaveBeenCalledWith(`/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
        responseType: 'text',
      });
    });

    it('should throw an error with a descriptive message if the API call fails', async () => {
      const mockError = new Error('Network Error');
      mockGet.mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(false);
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const jobId = 456;

      await expect(gitHubClient.getJobLogs(owner, repo, jobId)).rejects.toThrow(
        `Failed to fetch job logs: ${mockError.message}`,
      );
    });
  });

  describe('getRuns', () => {
    it('should call the correct API endpoint with the provided parameters', async () => {
      mockGet.mockResolvedValue({ data: { workflow_runs: [] } });
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const params = { status: 'completed', per_page: 10 };

      await gitHubClient.getRuns(owner, repo, params);

      expect(mockGet).toHaveBeenCalledWith(`/repos/${owner}/${repo}/actions/runs`, { params });
    });

    it('should throw an error with a descriptive message if the API call fails', async () => {
      const mockError = new Error('Network Error');
      mockGet.mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(false);
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const params = { status: 'completed', per_page: 10 };

      await expect(gitHubClient.getRuns(owner, repo, params)).rejects.toThrow(
        `Failed to fetch workflow runs: ${mockError.message}`,
      );
    });
  });

  describe('getJobs', () => {
    it('should call the correct API endpoint with the provided parameters', async () => {
      mockGet.mockResolvedValue({ data: { jobs: [] } });
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const runId = 789;

      await gitHubClient.getJobs(owner, repo, runId);

      expect(mockGet).toHaveBeenCalledWith(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs`);
    });

    it('should throw an error with a descriptive message if the API call fails', async () => {
      const mockError = new Error('Network Error');
      mockGet.mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(false);
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const runId = 789;

      await expect(gitHubClient.getJobs(owner, repo, runId)).rejects.toThrow(
        `Failed to fetch jobs: ${mockError.message}`,
      );
    });
  });

  describe('caching behavior', () => {
    it('returns cached results for repeated getRuns calls within TTL', async () => {
      const mockData = { workflow_runs: [{ id: 1, conclusion: 'success' }] };
      mockGet.mockResolvedValue({ data: mockData });
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const params = { status: 'completed', per_page: 10 };

      // First call should hit the API
      const result1 = await gitHubClient.getRuns(owner, repo, params);
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Second call should return cached result
      const result2 = await gitHubClient.getRuns(owner, repo, params);
      expect(mockGet).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2).toEqual(result1);
    });

    it('returns cached results for repeated getJobs calls within TTL', async () => {
      const mockData = { jobs: [{ id: 1, name: 'test-job' }] };
      mockGet.mockResolvedValue({ data: mockData });
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';
      const runId = 789;

      // First call should hit the API
      const result1 = await gitHubClient.getJobs(owner, repo, runId);
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Second call should return cached result
      const result2 = await gitHubClient.getJobs(owner, repo, runId);
      expect(mockGet).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2).toEqual(result1);
    });

    it('makes separate API calls for different parameters', async () => {
      mockGet.mockResolvedValue({ data: { workflow_runs: [] } });
      const gitHubClient = new GitHubClient(new LocalCache(), 'test-token');

      const owner = 'test-owner';
      const repo = 'test-repo';

      // Call with different status params
      await gitHubClient.getRuns(owner, repo, { status: 'completed' });
      await gitHubClient.getRuns(owner, repo, { status: 'in_progress' });

      // Should make separate API calls for different parameters
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('HTTP configuration', () => {
    it('creates axios instance with timeout configured', () => {
      new GitHubClient(new LocalCache(), 'test-token');

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 15000, // 15 seconds
        }),
      );
    });

    it('creates axios instance with keep-alive agents', () => {
      new GitHubClient(new LocalCache(), 'test-token');

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpAgent: expect.any(Object),
          httpsAgent: expect.any(Object),
        }),
      );
    });
  });
});
