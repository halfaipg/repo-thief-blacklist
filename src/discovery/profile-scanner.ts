import { GitHubClient } from '../api/github-client';
import { ScanQueue } from '../queue/scan-queue';
import { CommitIndexer } from '../scanner/commit-indexer';

export interface ProfileStats {
  username: string;
  accountAge: number; // days
  repoCount: number;
  reposCreatedRecently: number; // repos created in last 30 days
  avgStarsPerRepo: number;
  suspiciousScore: number;
}

export class ProfileScanner {
  private githubClient: GitHubClient;
  private scanQueue: ScanQueue | null = null;
  private indexer: CommitIndexer;
  private useQueue: boolean;

  constructor(useQueue: boolean = true) {
    this.githubClient = new GitHubClient();
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
   * Analyze a GitHub profile for suspicious patterns
   */
  async analyzeProfile(username: string): Promise<ProfileStats | null> {
    try {
      // Get user's repos (this would need GitHub API)
      // For now, we'll use a simplified approach
      
      // Search for repos by this user
      const query = `user:${username} sort:created`;
      const repos = await this.githubClient.searchRepositories(query, 100);

      if (repos.length === 0) {
        return null;
      }

      // Calculate stats
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const reposCreatedRecently = repos.filter(
        r => r.createdAt > thirtyDaysAgo
      ).length;

      const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
      const avgStarsPerRepo = repos.length > 0 ? totalStars / repos.length : 0;

      // Estimate account age from oldest repo
      const oldestRepo = repos.reduce((oldest, repo) => 
        repo.createdAt < oldest.createdAt ? repo : oldest
      , repos[0]);
      const accountAge = Math.floor(
        (now.getTime() - oldestRepo.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate suspicious score
      let suspiciousScore = 0;
      
      // Many repos created recently
      if (reposCreatedRecently > 20) suspiciousScore += 30;
      else if (reposCreatedRecently > 10) suspiciousScore += 20;
      else if (reposCreatedRecently > 5) suspiciousScore += 10;

      // High repo count but low account age
      if (repos.length > 50 && accountAge < 180) suspiciousScore += 30;
      else if (repos.length > 30 && accountAge < 365) suspiciousScore += 20;

      // Low average stars (many repos but few stars)
      if (repos.length > 20 && avgStarsPerRepo < 1) suspiciousScore += 20;

      return {
        username,
        accountAge,
        repoCount: repos.length,
        reposCreatedRecently,
        avgStarsPerRepo,
        suspiciousScore: Math.min(100, suspiciousScore),
      };
    } catch (error: any) {
      console.error(`Error analyzing profile ${username}:`, error.message);
      return null;
    }
  }

  /**
   * Scan all repos from a suspicious profile
   */
  async scanSuspiciousProfile(username: string): Promise<void> {
    console.log(`\n=== Scanning Profile: ${username} ===\n`);

    const stats = await this.analyzeProfile(username);
    
    if (!stats) {
      console.log(`  ✗ Could not analyze profile\n`);
      return;
    }

    console.log(`  Account age: ${stats.accountAge} days`);
    console.log(`  Total repos: ${stats.repoCount}`);
    console.log(`  Repos created recently: ${stats.reposCreatedRecently}`);
    console.log(`  Avg stars/repo: ${stats.avgStarsPerRepo.toFixed(1)}`);
    console.log(`  Suspicious score: ${stats.suspiciousScore}/100\n`);

    if (stats.suspiciousScore >= 30) {
      console.log(`  ⚠️  Profile flagged as suspicious (score: ${stats.suspiciousScore})\n`);
      
      // Get all repos and queue them for scanning
      const query = `user:${username} sort:created`;
      const repos = await this.githubClient.searchRepositories(query, 100);

      console.log(`  Queuing ${repos.length} repos for scanning...\n`);

      let indexed = 0;
      let queued = 0;
      
      for (const repo of repos) {
        try {
          const queue = await this.getQueue();
          if (queue) {
            await queue.addScanJob(repo.owner, repo.name, 30);
            queued++;
          } else {
            throw new Error('Queue not available');
          }
        } catch (error: any) {
          // Index directly if queue not available
          try {
            await this.indexer.indexRepository(repo.owner, repo.name);
            indexed++;
          } catch (indexError: any) {
            console.error(`    ✗ Error indexing ${repo.fullName}: ${indexError.message}`);
          }
        }
      }

      if (queued > 0) {
        console.log(`  ✓ Queued ${queued} repos\n`);
      }
      if (indexed > 0) {
        console.log(`  ✓ Indexed ${indexed} repos directly\n`);
      }
    } else {
      console.log(`  ✓ Profile looks normal\n`);
    }
  }
}

