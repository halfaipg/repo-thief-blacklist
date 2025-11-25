import { GitHubClient } from '../api/github-client';
import { RepositoriesRepository } from '../db/repos-repo';
import { ScanQueue } from '../queue/scan-queue';
import { CommitIndexer } from '../scanner/commit-indexer';

export class PopularReposDiscovery {
  private githubClient: GitHubClient;
  private reposRepo: RepositoriesRepository;
  private scanQueue: ScanQueue | null = null;
  private indexer: CommitIndexer;
  private useQueue: boolean;

  constructor(useQueue: boolean = true) {
    this.githubClient = new GitHubClient();
    this.reposRepo = new RepositoriesRepository();
    this.indexer = new CommitIndexer();
    this.useQueue = useQueue;
  }

  private async getQueue(): Promise<ScanQueue | null> {
    if (!this.useQueue) return null;
    
    if (this.scanQueue === null) {
      try {
        this.scanQueue = new ScanQueue();
      } catch (error) {
        console.warn('Redis not available, queue disabled. Repos will be indexed directly.');
        return null;
      }
    }
    return this.scanQueue;
  }

  /**
   * Discover popular repositories to scan
   * Searches for repos with high star counts in various languages
   */
  async discoverPopularRepos(options: {
    minStars?: number;
    languages?: string[];
    limit?: number;
  } = {}): Promise<void> {
    const {
      minStars = 100,
      languages = ['javascript', 'typescript', 'python', 'go', 'rust', 'java'],
      limit = 100,
    } = options;

    console.log(`\n=== Discovering Popular Repos (min ${minStars} stars) ===\n`);

    const discovered: Set<string> = new Set();

    for (const language of languages) {
      console.log(`Searching ${language} repos with ${minStars}+ stars...`);
      
      try {
        const query = `language:${language} stars:>=${minStars} sort:stars`;
        const repos = await this.githubClient.searchRepositories(query, 30);

        for (const repo of repos) {
          const fullName = repo.fullName;
          
          // Check if already indexed
          const existing = await this.reposRepo.findByFullName(fullName);
          if (existing && existing.scanStatus === 'completed') {
            continue;
          }

          if (!discovered.has(fullName)) {
            discovered.add(fullName);
            console.log(`  → Found: ${fullName} (${repo.stars} stars)`);
            
            // Queue for scanning or index directly
            try {
              const queue = await this.getQueue();
              if (queue) {
                await queue.addScanJob(repo.owner, repo.name, 10);
              } else {
                throw new Error('Queue not available');
              }
            } catch (error: any) {
              // Index directly if queue not available
              try {
                await this.indexer.indexRepository(repo.owner, repo.name);
              } catch (indexError: any) {
                console.error(`    ✗ Error indexing ${fullName}: ${indexError.message}`);
              }
            }
          }
        }

        console.log(`  ✓ Found ${repos.length} ${language} repos\n`);
      } catch (error: any) {
        console.error(`  ✗ Error searching ${language}:`, error.message);
      }
    }

    console.log(`\n✓ Total unique repos discovered: ${discovered.size}`);
    console.log(`✓ Queued ${discovered.size} repos for scanning\n`);
  }

  /**
   * Discover trending repositories
   */
  async discoverTrendingRepos(limit: number = 50): Promise<void> {
    console.log(`\n=== Discovering Trending Repos ===\n`);

    try {
      // Search for recently created repos with activity
      const query = 'created:>2024-01-01 sort:stars';
      const repos = await this.githubClient.searchRepositories(query, limit);

      const discovered: Set<string> = new Set();

      for (const repo of repos) {
        const fullName = repo.fullName;
        
        // Check if already indexed
        const existing = await this.reposRepo.findByFullName(fullName);
        if (existing && existing.scanStatus === 'completed') {
          continue;
        }

        if (!discovered.has(fullName)) {
          discovered.add(fullName);
          console.log(`  → Found: ${fullName} (${repo.stars} stars, created ${repo.createdAt.toISOString().split('T')[0]})`);
          
          // Queue for scanning or index directly
          try {
            const queue = await this.getQueue();
            if (queue) {
              await queue.addScanJob(repo.owner, repo.name, 20);
            } else {
              throw new Error('Queue not available');
            }
          } catch (error: any) {
            // Index directly if queue not available
            try {
              await this.indexer.indexRepository(repo.owner, repo.name);
            } catch (indexError: any) {
              console.error(`    ✗ Error indexing ${fullName}: ${indexError.message}`);
            }
          }
        }
      }

      console.log(`\n✓ Discovered ${discovered.size} trending repos\n`);
    } catch (error: any) {
      console.error('Error discovering trending repos:', error.message);
    }
  }
}

