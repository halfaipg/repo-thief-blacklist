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
  used: number;
}

export interface AllRateLimits {
  core: RateLimitInfo;
  search: RateLimitInfo;
}

// Track last search request time for throttling (30 req/min = 1 per 2 seconds)
let lastSearchRequestTime = 0;
const SEARCH_THROTTLE_MS = 2100; // 2.1 seconds between search requests (safe margin)

// Track last core request time for throttling
let lastCoreRequestTime = 0;
const CORE_THROTTLE_MS = 100; // 100ms between core requests

export async function getRateLimit(octokit: Octokit): Promise<AllRateLimits> {
  const { data } = await octokit.rest.rateLimit.get();
  return {
    core: {
      limit: data.resources.core.limit,
      remaining: data.resources.core.remaining,
      reset: data.resources.core.reset,
      used: data.resources.core.used,
    },
    search: {
      limit: data.resources.search.limit,
      remaining: data.resources.search.remaining,
      reset: data.resources.search.reset,
      used: data.resources.search.used,
    },
  };
}

export async function waitForRateLimit(octokit: Octokit, isSearchRequest: boolean = false): Promise<void> {
  const now = Date.now();
  
  if (isSearchRequest) {
    // Throttle search requests to 30/minute (1 per 2 seconds)
    const timeSinceLastSearch = now - lastSearchRequestTime;
    if (timeSinceLastSearch < SEARCH_THROTTLE_MS) {
      const waitTime = SEARCH_THROTTLE_MS - timeSinceLastSearch;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastSearchRequestTime = Date.now();
  } else {
    // Throttle core requests to avoid bursts
    const timeSinceLastCore = now - lastCoreRequestTime;
    if (timeSinceLastCore < CORE_THROTTLE_MS) {
      const waitTime = CORE_THROTTLE_MS - timeSinceLastCore;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastCoreRequestTime = Date.now();
  }
  
  // Check rate limits and wait if needed
  try {
    const rateLimits = await getRateLimit(octokit);
    const rateLimit = isSearchRequest ? rateLimits.search : rateLimits.core;
    
    // Log current rate limit status periodically
    if (rateLimit.remaining % 100 === 0 || rateLimit.remaining < 50) {
      const resetTime = new Date(rateLimit.reset * 1000);
      console.log(`📊 ${isSearchRequest ? 'Search' : 'Core'} API: ${rateLimit.remaining}/${rateLimit.limit} remaining (resets at ${resetTime.toLocaleTimeString()})`);
    }
    
    if (rateLimit.remaining === 0) {
      const waitTime = (rateLimit.reset * 1000) - Date.now() + 1000; // Add 1 second buffer
      console.log(`⏳ ${isSearchRequest ? 'Search' : 'Core'} rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds until reset...`);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, waitTime)));
    } else if (rateLimit.remaining < 10) {
      // Slow down when getting low
      console.log(`⚠️ ${isSearchRequest ? 'Search' : 'Core'} API low: ${rateLimit.remaining} remaining. Slowing down...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }
  } catch (error: any) {
    // If we can't check rate limits, wait a bit to be safe
    console.error('Error checking rate limits:', error.message);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Convenience function for search requests
export async function waitForSearchRateLimit(octokit: Octokit): Promise<void> {
  return waitForRateLimit(octokit, true);
}

