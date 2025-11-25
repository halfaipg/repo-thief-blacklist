import { RepoScanner } from './repo-scanner';
import { CommitMatcher } from './commit-matcher';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'scan' && args.length >= 3) {
    const owner = args[1];
    const repo = args[2];
    
    const scanner = new RepoScanner();
    await scanner.scanRepository(owner, repo);
  } else if (command === 'match') {
    const matcher = new CommitMatcher();
    await matcher.findMatchesForAllRepos();
  } else if (command === 'scan-url' && args.length >= 2) {
    const repoUrl = args[1];
    
    const scanner = new RepoScanner();
    await scanner.scanFromUrl(repoUrl);
  } else {
    console.log(`
Usage:
  npm run scanner scan <owner> <repo>     - Scan a specific repository
  npm run scanner scan-url <repo-url>     - Scan from GitHub URL
  npm run scanner match                    - Run matching algorithm on all indexed repos
    `);
    process.exit(1);
  }
}

main().catch(console.error);

