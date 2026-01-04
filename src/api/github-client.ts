import { Octokit } from '@octokit/rest';
import { createGitHubClient, waitForRateLimit, waitForSearchRateLimit } from '../config/github';

export interface GitHubCommit {
  sha: string;
  message: string;
  timestamp: Date;
  authorName: string;
  authorEmail: string;
  url: string;
}

export interface GitHubRepository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
  pushedAt: Date | null;
  stars: number;
  forks: number;
  description: string | null;
  topics: string[];
}

export class GitHubClient {
  private octokit: Octokit;

  constructor() {
    this.octokit = createGitHubClient();
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    await waitForRateLimit(this.octokit);
    
    const { data } = await this.octokit.rest.repos.get({
      owner,
      repo,
    });

    return {
      id: data.id,
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      pushedAt: data.pushed_at ? new Date(data.pushed_at) : null,
      stars: data.stargazers_count,
      forks: data.forks_count,
      description: data.description,
      topics: data.topics || [],
    };
  }

  async getCommits(
    owner: string,
    repo: string,
    limit: number = 1000
  ): Promise<GitHubCommit[]> {
    const commits: GitHubCommit[] = [];
    let page = 1;
    const perPage = 100;

    while (commits.length < limit) {
      await waitForRateLimit(this.octokit);

      const { data } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: perPage,
        page,
      });

      if (data.length === 0) {
        break;
      }

      for (const commit of data) {
        commits.push({
          sha: commit.sha,
          message: commit.commit.message.split('\n')[0], // First line only
          timestamp: new Date(commit.commit.author?.date || commit.commit.committer?.date || ''),
          authorName: commit.commit.author?.name || commit.commit.committer?.name || 'Unknown',
          authorEmail: commit.commit.author?.email || commit.commit.committer?.email || '',
          url: commit.html_url,
        });

        if (commits.length >= limit) {
          break;
        }
      }

      if (data.length < perPage) {
        break;
      }

      page++;
    }

    return commits;
  }

  async getFirstCommit(owner: string, repo: string): Promise<GitHubCommit | null> {
    const commits = await this.getCommits(owner, repo, 1);
    return commits.length > 0 ? commits[0] : null;
  }

  async searchRepositories(query: string, limit: number = 100): Promise<GitHubRepository[]> {
    const repos: GitHubRepository[] = [];
    let page = 1;
    const perPage = 100;

    while (repos.length < limit) {
      // Use search-specific rate limiting (30 req/min)
      await waitForSearchRateLimit(this.octokit);

      const { data } = await this.octokit.rest.search.repos({
        q: query,
        per_page: perPage,
        page,
        sort: 'stars',
        order: 'desc',
      });

      if (data.items.length === 0) {
        break;
      }

      for (const item of data.items) {
        repos.push({
          id: item.id,
          owner: item.owner?.login || 'unknown',
          name: item.name,
          fullName: item.full_name,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at),
          pushedAt: item.pushed_at ? new Date(item.pushed_at) : null,
          stars: item.stargazers_count,
          forks: item.forks_count,
          description: item.description,
          topics: item.topics || [],
        });

        if (repos.length >= limit) {
          break;
        }
      }

      if (data.items.length < perPage) {
        break;
      }

      page++;
    }

    return repos;
  }

  /**
   * Search GitHub for repos that might have matching commits
   * Uses commit message content to find repos with similar commits
   */
  async findReposWithMatchingCommits(
    commits: GitHubCommit[],
    excludeOwner?: string,
    limit: number = 50
  ): Promise<GitHubRepository[]> {
    const foundRepos = new Map<string, GitHubRepository>();
    
    // Use GitHub code search to find commits with matching messages
    // We'll search for unique commit message snippets
    const uniqueCommitMessages = new Set<string>();
    
    for (const commit of commits.slice(0, 30)) { // Use first 30 commits
      // Extract unique phrases from commit messages (5+ words)
      const words = commit.message
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2);
      
      // Create 3-5 word phrases
      for (let i = 0; i <= words.length - 3; i++) {
        const phrase = words.slice(i, i + 3).join(' ');
        if (phrase.length >= 10) {
          uniqueCommitMessages.add(phrase);
        }
      }
    }

    // Search GitHub code search for these commit messages
    const searchQueries: string[] = [];
    const phrases = Array.from(uniqueCommitMessages).slice(0, 10);
    
    for (const phrase of phrases) {
      // Search for code containing this phrase (might be in commit messages)
      const query = `"${phrase}" language:markdown OR language:text`;
      searchQueries.push(query);
    }

    // Also search repos by unique commit message patterns
    // Look for distinctive commit messages that are likely to be unique
    const distinctiveCommits = commits
      .filter(c => {
        const msg = c.message.toLowerCase();
        // Skip generic commits
        return msg.length > 20 && 
               !msg.startsWith('update') &&
               !msg.startsWith('fix') &&
               !msg.startsWith('merge') &&
               !msg.startsWith('initial');
      })
      .slice(0, 10);

    for (const commit of distinctiveCommits) {
      // Extract a unique searchable part
      const words = commit.message.toLowerCase().split(/\s+/).slice(0, 5);
      if (words.length >= 3) {
        const searchTerm = words.join(' ');
        searchQueries.push(searchTerm);
      }
    }

    // Search GitHub for repos
    for (const query of searchQueries.slice(0, 10)) {
      try {
        // Use search-specific rate limiting (30 req/min)
        await waitForSearchRateLimit(this.octokit);
        
        // Try code search first (more specific)
        try {
          const { data: codeResults } = await this.octokit.rest.search.code({
            q: query,
            per_page: 10,
          });

          // Extract repo names from code search results
          for (const item of codeResults.items) {
            const repoFullName = `${item.repository.owner.login}/${item.repository.name}`;
            
            if (excludeOwner && item.repository.owner.login === excludeOwner) {
              continue;
            }

            if (!foundRepos.has(repoFullName)) {
              foundRepos.set(repoFullName, {
                id: item.repository.id,
                owner: item.repository.owner.login,
                name: item.repository.name,
                fullName: repoFullName,
                createdAt: new Date(item.repository.created_at || new Date()),
                updatedAt: new Date(item.repository.updated_at || new Date()),
                pushedAt: item.repository.pushed_at ? new Date(item.repository.pushed_at) : null,
                stars: item.repository.stargazers_count || 0,
                forks: item.repository.forks_count || 0,
                description: item.repository.description,
                topics: item.repository.topics || [],
              });
            }

            if (foundRepos.size >= limit) {
              break;
            }
          }
        } catch (codeError: any) {
          // Fall back to repo search
          const repos = await this.searchRepositories(query, 10);
          
          for (const repo of repos) {
            if (excludeOwner && repo.owner === excludeOwner) {
              continue;
            }
            
            if (!foundRepos.has(repo.fullName)) {
              foundRepos.set(repo.fullName, repo);
            }
            
            if (foundRepos.size >= limit) {
              break;
            }
          }
        }
        
        if (foundRepos.size >= limit) {
          break;
        }
      } catch (error: any) {
        // Rate limit or other error, continue
        console.error(`Error searching for "${query}":`, error.message);
      }
    }

    return Array.from(foundRepos.values()).slice(0, limit);
  }

  /**
   * Check if a repo has commits matching the given commits
   * Uses message-only matching since scammers often rewrite timestamps with git filter-branch
   */
  async checkRepoForMatchingCommits(
    owner: string,
    repo: string,
    targetCommits: GitHubCommit[],
    minMatches: number = 3
  ): Promise<{ matches: number; matchingCommits: GitHubCommit[] }> {
    try {
      const repoCommits = await this.getCommits(owner, repo, 1000);
      
      const matchingCommits: GitHubCommit[] = [];
      
      // Create a set of target commit messages (normalized)
      // Use message-only matching since scammers rewrite timestamps
      const targetMessages = new Set<string>();
      for (const commit of targetCommits) {
        // Normalize message: lowercase, trim, remove common prefixes
        const normalized = commit.message.toLowerCase().trim()
          .replace(/^(merge|revert|update|fix|add|remove|delete|create|initial):\s*/i, '')
          .substring(0, 100); // First 100 chars to avoid very long messages
        
        // Only add non-trivial messages (skip generic ones)
        if (normalized.length > 10 && 
            !normalized.startsWith('update readme') &&
            !normalized.startsWith('initial commit') &&
            !normalized.startsWith('first commit') &&
            !normalized.match(/^v?\d+\.\d+/)) { // Skip version-only commits
          targetMessages.add(normalized);
        }
      }
      
      // Check each repo commit
      for (const commit of repoCommits) {
        const normalized = commit.message.toLowerCase().trim()
          .replace(/^(merge|revert|update|fix|add|remove|delete|create|initial):\s*/i, '')
          .substring(0, 100);
        
        if (targetMessages.has(normalized)) {
          matchingCommits.push(commit);
        }
      }
      
      return {
        matches: matchingCommits.length,
        matchingCommits,
      };
    } catch (error: any) {
      // Repo might not exist or be private
      return { matches: 0, matchingCommits: [] };
    }
  }
}

