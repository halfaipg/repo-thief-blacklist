import { CommitsRepository } from '../db/commits-repo';
import { RepositoriesRepository } from '../db/repos-repo';
import { CommitMatcher } from '../scanner/commit-matcher';

export class CommitMatcherDiscovery {
  private commitsRepo: CommitsRepository;
  private reposRepo: RepositoriesRepository;
  private matcher: CommitMatcher;

  constructor() {
    this.commitsRepo = new CommitsRepository();
    this.reposRepo = new RepositoriesRepository();
    this.matcher = new CommitMatcher();
  }

  /**
   * Find repositories with duplicate commit patterns
   * This discovers repos that share commit messages+timestamps
   */
  async discoverFromCommitMatches(): Promise<void> {
    console.log('\n=== Discovering Repos from Commit Matches ===\n');

    // Find all duplicate commit patterns
    const duplicates = await this.commitsRepo.findDuplicateMessageTimestampPairs();
    console.log(`Found ${duplicates.length} duplicate commit patterns\n`);

    const repoIdsToScan = new Set<number>();

    // For each duplicate pattern, find repos that have it
    for (const duplicate of duplicates) {
      const repoIds = duplicate.repoIds;

      if (repoIds.length >= 2) {
        // These repos share commits - queue them for comparison
        for (const repoId of repoIds) {
          repoIdsToScan.add(repoId);
        }
      }
    }

    console.log(`Found ${repoIdsToScan.size} repos with duplicate commit patterns\n`);

    // Run matching on all discovered repos
    console.log('Running matching algorithm...\n');
    await this.matcher.findMatchesForAllRepos();
  }

  /**
   * Discover new repos by searching for repos with matching commit messages
   * This is more expensive but finds repos we haven't indexed yet
   */
  async discoverByCommitMessageSearch(
    sampleCommits: Array<{ message: string; timestamp: Date }>,
    limit: number = 10
  ): Promise<void> {
    console.log('\n=== Discovering Repos by Commit Message Search ===\n');

    // This would require GitHub's code search API or web scraping
    // For now, we'll use the commit index we already have
    console.log('Using indexed commits to find matches...\n');

    const repoIdsToCheck = new Set<number>();

    for (const sampleCommit of sampleCommits.slice(0, limit)) {
      const matches = await this.commitsRepo.findMatchingCommits(
        sampleCommit.message,
        sampleCommit.timestamp
      );

      for (const match of matches) {
        repoIdsToCheck.add(match.repoId);
      }
    }

    console.log(`Found ${repoIdsToCheck.size} repos with matching commits\n`);

    // Queue these repos for full comparison
    for (const repoId of repoIdsToCheck) {
      const repo = await this.reposRepo.findById(repoId);
      if (repo) {
        await this.matcher.findMatchesForRepo(repoId);
      }
    }
  }
}

