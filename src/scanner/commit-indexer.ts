import { GitHubClient } from '../api/github-client';
import { RepositoriesRepository } from '../db/repos-repo';
import { CommitsRepository } from '../db/commits-repo';

export class CommitIndexer {
  private githubClient: GitHubClient;
  private reposRepo: RepositoriesRepository;
  private commitsRepo: CommitsRepository;

  constructor() {
    this.githubClient = new GitHubClient();
    this.reposRepo = new RepositoriesRepository();
    this.commitsRepo = new CommitsRepository();
  }

  async indexRepository(owner: string, repo: string): Promise<void> {
    console.log(`Indexing repository: ${owner}/${repo}`);

    try {
      // Fetch repository metadata
      const githubRepo = await this.githubClient.getRepository(owner, repo);
      const repoRecord = await this.reposRepo.upsert(githubRepo);

      // Update scan status
      await this.reposRepo.updateScanStatus(githubRepo.fullName, 'indexing');

      // Fetch commits
      console.log(`Fetching commits for ${owner}/${repo}...`);
      const commits = await this.githubClient.getCommits(owner, repo, 10000);

      if (commits.length === 0) {
        console.log(`No commits found for ${owner}/${repo}`);
        await this.reposRepo.updateScanStatus(githubRepo.fullName, 'completed');
        return;
      }

      // Get first commit date
      const firstCommit = commits[commits.length - 1]; // Commits are in reverse chronological order
      await this.reposRepo.updateFirstCommitDate(githubRepo.fullName, firstCommit.timestamp);

      // Store commits in database
      console.log(`Storing ${commits.length} commits for ${owner}/${repo}...`);
      await this.commitsRepo.bulkInsert(repoRecord.id, commits);

      // Update scan status
      await this.reposRepo.updateScanStatus(githubRepo.fullName, 'completed');
      console.log(`Successfully indexed ${owner}/${repo} with ${commits.length} commits`);
    } catch (error: any) {
      console.error(`Error indexing ${owner}/${repo}:`, error.message);
      await this.reposRepo.updateScanStatus(`${owner}/${repo}`, 'failed');
      throw error;
    }
  }

  async indexFromUrl(repoUrl: string): Promise<void> {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub URL: ${repoUrl}`);
    }

    const [, owner, repo] = match;
    // Remove .git suffix if present
    const repoName = repo.replace(/\.git$/, '');
    
    await this.indexRepository(owner, repoName);
  }
}

