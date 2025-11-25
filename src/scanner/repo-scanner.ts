import { CommitIndexer } from './commit-indexer';
import { CommitMatcher } from './commit-matcher';
import { RepositoriesRepository } from '../db/repos-repo';

export class RepoScanner {
  private indexer: CommitIndexer;
  private matcher: CommitMatcher;
  private reposRepo: RepositoriesRepository;

  constructor() {
    this.indexer = new CommitIndexer();
    this.matcher = new CommitMatcher();
    this.reposRepo = new RepositoriesRepository();
  }

  async scanRepository(owner: string, repo: string): Promise<void> {
    console.log(`\n=== Scanning ${owner}/${repo} ===`);

    // Step 1: Index the repository
    await this.indexer.indexRepository(owner, repo);

    // Step 2: Find matches
    const repoRecord = await this.reposRepo.findByFullName(`${owner}/${repo}`);
    if (repoRecord) {
      await this.matcher.findMatchesForRepo(repoRecord.id);
    }
  }

  async scanFromUrl(repoUrl: string): Promise<void> {
    await this.indexer.indexFromUrl(repoUrl);
    
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      const [, owner, repo] = match;
      const repoName = repo.replace(/\.git$/, '');
      const repoRecord = await this.reposRepo.findByFullName(`${owner}/${repoName}`);
      
      if (repoRecord) {
        await this.matcher.findMatchesForRepo(repoRecord.id);
      }
    }
  }

  async runMatching(): Promise<void> {
    console.log('\n=== Running matching algorithm ===');
    await this.matcher.findMatchesForAllRepos();
  }
}

