import { GitHubClient } from '../api/github-client';
import { CommitIndexer } from '../scanner/commit-indexer';
import { RepositoriesRepository } from '../db/repos-repo';

export class SimilarNameSearch {
  private githubClient: GitHubClient;
  private indexer: CommitIndexer;
  private reposRepo: RepositoriesRepository;

  constructor() {
    this.githubClient = new GitHubClient();
    this.indexer = new CommitIndexer();
    this.reposRepo = new RepositoriesRepository();
  }

  /**
   * Search for repos with similar names to known popular repos
   */
  async searchSimilarNames(popularRepoName: string, limit: number = 20): Promise<void> {
    console.log(`\n=== Searching for repos similar to: ${popularRepoName} ===\n`);

    // Extract keywords from repo name
    const keywords = popularRepoName
      .split(/[-_\/]/)
      .filter(word => word.length > 2)
      .slice(0, 3);

    if (keywords.length === 0) {
      console.log('  ✗ Could not extract keywords\n');
      return;
    }

    const query = keywords.join(' ');
    console.log(`  Searching with keywords: ${query}\n`);

    try {
      const repos = await this.githubClient.searchRepositories(query, limit);

      console.log(`  Found ${repos.length} repos with similar names:\n`);

      for (const repo of repos) {
        // Check if already indexed
        const existing = await this.reposRepo.findByFullName(repo.fullName);
        
        if (existing && existing.scanStatus === 'completed') {
          console.log(`  → ${repo.fullName} (${repo.stars} stars) - already indexed`);
          continue;
        }

        console.log(`  → ${repo.fullName} (${repo.stars} stars, created ${repo.createdAt.toISOString().split('T')[0]})`);
        
        // Index it
        try {
          await this.indexer.indexRepository(repo.owner, repo.name);
          console.log(`    ✓ Indexed\n`);
        } catch (error: any) {
          console.error(`    ✗ Error: ${error.message}\n`);
        }
      }
    } catch (error: any) {
      console.error(`  ✗ Search failed: ${error.message}\n`);
    }
  }
}

