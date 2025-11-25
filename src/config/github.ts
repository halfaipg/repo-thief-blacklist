import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

dotenv.config();

export function createGitHubClient(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  return new Octokit({
    auth: token,
    request: {
      timeout: 30000,
    },
  });
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export async function getRateLimit(octokit: Octokit): Promise<RateLimitInfo> {
  const { data } = await octokit.rest.rateLimit.get();
  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: data.rate.reset,
  };
}

export async function waitForRateLimit(octokit: Octokit): Promise<void> {
  const rateLimit = await getRateLimit(octokit);
  
  if (rateLimit.remaining === 0) {
    const waitTime = (rateLimit.reset * 1000) - Date.now() + 1000; // Add 1 second buffer
    console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

