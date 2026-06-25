import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { API_BASE_URL } from '../constant.js';

import {
  GitHubWorkflowRunsResponse,
  GitHubJobsResponse,
  GitHubCheckRunAnnotation,
  RunOptions,
} from '../types.js';

import { LocalCache } from '../utils/local-cache.js';

export class GitHubClient {
  private readonly token: string;
  private readonly apiClient: AxiosInstance;
  private readonly apiBaseUrl: string = API_BASE_URL;

  constructor(
    private cache: LocalCache,
    token: string,
  ) {
    this.token = token;

    // Configure axios with HTTP keep-alive and request timeout
    const httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 30000 });
    const httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 30000 });

    this.apiClient = axios.create({
      baseURL: this.apiBaseUrl,
      headers: this.getAuthHeaders(),
      httpAgent,
      httpsAgent,
      timeout: 15000, // 15 second timeout
    });
  }

  private getCacheKey(endpoint: string, params?: unknown): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramString}`;
  }

  private getAuthHeaders() {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Only include auth when a token is configured.
    if (this.token.trim().length > 0) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const details =
        typeof error.response?.data === 'string'
          ? error.response.data
          : error.response?.data?.message;

      return [status, statusText, details].filter(Boolean).join(' ');
    }

    return error instanceof Error ? error.message : String(error);
  }

  public async getRunLogs(owner: string, repo: string, runId: number): Promise<ArrayBuffer> {
    try {
      const response = await this.apiClient.get(
        `/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
        { responseType: 'arraybuffer' },
      );
      return response.data;
    } catch (error) {
      const message = this.getErrorMessage(error);
      throw new Error(`Failed to fetch runs: ${message}`);
    }
  }

  public async getJobLogs(owner: string, repo: string, jobId: number): Promise<string> {
    try {
      const response = await this.apiClient.get(
        `/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
        { responseType: 'text' },
      );

      return typeof response.data === 'string' ? response.data : String(response.data);
    } catch (error) {
      throw new Error(`Failed to fetch job logs: ${this.getErrorMessage(error)}`);
    }
  }

  public async getRuns(
    owner: string,
    repo: string,
    params: RunOptions,
  ): Promise<GitHubWorkflowRunsResponse> {
    try {
      const endpoint = `/repos/${owner}/${repo}/actions/runs`;
      const cacheKey = this.getCacheKey(endpoint, params);

      // Check cache first
      const cached = this.cache.getCached<GitHubWorkflowRunsResponse>(cacheKey);
      if (cached) return cached;

      const response = await this.apiClient.get(endpoint, { params });
      this.cache.setCached(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch workflow runs: ${this.getErrorMessage(error)}`);
    }
  }

  public async getRun(owner: string, repo: string, runId: number) {
    try {
      const response = await this.apiClient.get(`/repos/${owner}/${repo}/actions/runs/${runId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch workflow run: ${this.getErrorMessage(error)}`);
    }
  }

  public async getJobs(owner: string, repo: string, runId: number): Promise<GitHubJobsResponse> {
    try {
      const endpoint = `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`;
      const cacheKey = this.getCacheKey(endpoint);

      // Check cache first
      const cached = this.cache.getCached<GitHubJobsResponse>(cacheKey);
      if (cached) return cached;

      const response = await this.apiClient.get(endpoint);
      this.cache.setCached(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch jobs: ${this.getErrorMessage(error)}`);
    }
  }

  public async getCheckRunAnnotations(
    owner: string,
    repo: string,
    checkRunId: number,
    perPage: number = 30,
  ): Promise<GitHubCheckRunAnnotation[]> {
    try {
      const response = await this.apiClient.get(
        `/repos/${owner}/${repo}/check-runs/${checkRunId}/annotations`,
        { params: { per_page: perPage } },
      );

      return response.data as GitHubCheckRunAnnotation[];
    } catch (error) {
      throw new Error(`Failed to fetch check-run annotations: ${this.getErrorMessage(error)}`);
    }
  }

  public async getCommitPullRequests(owner: string, repo: string, sha: string) {
    try {
      const response = await this.apiClient.get(`/repos/${owner}/${repo}/commits/${sha}/pulls`, {
        headers: {
          Accept: 'application/vnd.github+json',
        },
      });

      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      throw new Error(`Failed to fetch pull requests for commit: ${this.getErrorMessage(error)}`);
    }
  }

  public async rerunFailedJobs(owner: string, repo: string, runId: number): Promise<void> {
    try {
      await this.apiClient.post(`/repos/${owner}/${repo}/actions/runs/${runId}/rerun-failed-jobs`);
    } catch (error) {
      throw new Error(`Failed to rerun failed jobs: ${this.getErrorMessage(error)}`);
    }
  }

  public async rerunRun(owner: string, repo: string, runId: number): Promise<void> {
    try {
      await this.apiClient.post(`/repos/${owner}/${repo}/actions/runs/${runId}/rerun`);
    } catch (error) {
      throw new Error(`Failed to rerun workflow: ${this.getErrorMessage(error)}`);
    }
  }
}
