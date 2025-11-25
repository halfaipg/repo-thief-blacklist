import { CommitsRepository } from '../db/commits-repo';
import { RepositoriesRepository } from '../db/repos-repo';
import { MatchesRepository, MatchStatistics } from '../db/matches-repo';
import { BlacklistRepository } from '../db/blacklist-repo';
import { calculateMatchStatistics } from './scoring';

export class CommitMatcher {
  private commitsRepo: CommitsRepository;
  private reposRepo: RepositoriesRepository;
  private matchesRepo: MatchesRepository;
  private blacklistRepo: BlacklistRepository;

  constructor() {
    this.commitsRepo = new CommitsRepository();
    this.reposRepo = new RepositoriesRepository();
    this.matchesRepo = new MatchesRepository();
    this.blacklistRepo = new BlacklistRepository();
  }

  async findMatchesForRepo(repoId: number): Promise<void> {
    const repo = await this.reposRepo.findById(repoId);
    if (!repo) {
      throw new Error(`Repository ${repoId} not found`);
    }

    const commits = await this.commitsRepo.findByRepoId(repoId);
    if (commits.length === 0) {
      return;
    }

    // Find all repos with matching commits
    const matchingRepos = new Set<number>();

    for (const commit of commits) {
      const matches = await this.commitsRepo.findMatchingCommits(
        commit.message,
        commit.timestamp,
        repoId
      );

      for (const match of matches) {
        matchingRepos.add(match.repoId);
      }
    }

    // Compare with each matching repo
    for (const otherRepoId of matchingRepos) {
      await this.compareRepositories(repoId, otherRepoId);
    }
  }

  async compareRepositories(repo1Id: number, repo2Id: number): Promise<void> {
    const repo1 = await this.reposRepo.findById(repo1Id);
    const repo2 = await this.reposRepo.findById(repo2Id);

    if (!repo1 || !repo2) {
      return;
    }

    // Get commits for both repos
    const repo1Commits = await this.commitsRepo.findByRepoId(repo1Id);
    const repo2Commits = await this.commitsRepo.findByRepoId(repo2Id);

    if (repo1Commits.length === 0 || repo2Commits.length === 0) {
      return;
    }

    // Calculate match statistics
    const statistics = calculateMatchStatistics(
      repo1Commits.map(c => ({
        message: c.message,
        timestamp: c.timestamp,
        authorName: c.authorName,
        authorEmail: c.authorEmail,
      })),
      repo2Commits.map(c => ({
        message: c.message,
        timestamp: c.timestamp,
        authorName: c.authorName,
        authorEmail: c.authorEmail,
      })),
      repo1.githubCreatedAt,
      repo2.githubCreatedAt,
      repo1.firstCommitDate,
      repo2.firstCommitDate
    );

    // Only create match if there are actual matching commits
    if (statistics.exactMatches === 0) {
      return;
    }

    // Create evidence object
    const evidence = {
      repo1: {
        fullName: repo1.fullName,
        createdAt: repo1.githubCreatedAt.toISOString(),
        firstCommit: repo1.firstCommitDate?.toISOString() || null,
        totalCommits: repo1Commits.length,
      },
      repo2: {
        fullName: repo2.fullName,
        createdAt: repo2.githubCreatedAt.toISOString(),
        firstCommit: repo2.firstCommitDate?.toISOString() || null,
        totalCommits: repo2Commits.length,
      },
      sampleMatchingCommits: statistics.sampleMatchingCommits.slice(0, 5),
    };

    // Store match
    await this.matchesRepo.upsert(repo1Id, repo2Id, statistics, evidence);

    // Update suspicion scores
    if (statistics.confidenceScore >= 50) {
      await this.reposRepo.updateSuspicionScore(repo1.fullName, statistics.confidenceScore);
      await this.reposRepo.updateSuspicionScore(repo2.fullName, statistics.confidenceScore);
    }

    // Auto-add to blacklist if high confidence
    if (statistics.confidenceScore >= 70) {
      // Determine which repo is the fake one (usually the one created later)
      const fakeRepo = repo2.githubCreatedAt > repo1.githubCreatedAt ? repo2 : repo1;
      const originalRepo = fakeRepo === repo2 ? repo1 : repo2;

      // Add scammer to blacklist
      await this.blacklistRepo.upsert(fakeRepo.owner);
      
      // Update blacklist stats
      await this.blacklistRepo.updateStats(fakeRepo.owner);
    }

    console.log(
      `Match found: ${repo1.fullName} <-> ${repo2.fullName} ` +
      `(${statistics.exactMatches} matches, ${statistics.confidenceLevel}, score: ${statistics.confidenceScore})`
    );
  }

  async findMatchesForAllRepos(): Promise<void> {
    // Find all duplicate commit message+timestamp pairs
    const duplicates = await this.commitsRepo.findDuplicateMessageTimestampPairs();

    console.log(`Found ${duplicates.length} duplicate commit patterns`);

    // For each duplicate pattern, compare all repos that have it
    const processedPairs = new Set<string>();

    for (const duplicate of duplicates) {
      const repoIds = duplicate.repoIds;

      // Compare all pairs of repos
      for (let i = 0; i < repoIds.length; i++) {
        for (let j = i + 1; j < repoIds.length; j++) {
          const pairKey = `${Math.min(repoIds[i], repoIds[j])}-${Math.max(repoIds[i], repoIds[j])}`;
          
          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            await this.compareRepositories(repoIds[i], repoIds[j]);
          }
        }
      }
    }
  }
}

