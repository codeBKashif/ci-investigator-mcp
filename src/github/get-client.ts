import dotenv from 'dotenv';
dotenv.config();
import { GitHubClient } from './client.js';
import { LocalCache } from '../utils/local-cache.js';

let githubClient: GitHubClient | null = null;

export function getClient(): GitHubClient {
  if (!githubClient) {
    githubClient = new GitHubClient(new LocalCache(), process.env.GITHUB_TOKEN || '');
  }
  return githubClient;
}
