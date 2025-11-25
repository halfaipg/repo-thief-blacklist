import { SimilarNameSearch } from './similar-name-search';
import { CommitMatcher } from '../scanner/commit-matcher';
import { MatchesRepository } from '../db/matches-repo';
import { RepositoriesRepository } from '../db/repos-repo';

async function findScams() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 HUNTING FOR SCAM REPOS');
  console.log('='.repeat(60) + '\n');

  const searcher = new SimilarNameSearch();
  const matcher = new CommitMatcher();
  const matchesRepo = new MatchesRepository();
  const reposRepo = new RepositoriesRepository();

  // Search for repos similar to known popular ones that might be copied
  const searchTerms = [
    'ai-in-japan',
    'javascript-algorithms',
    'awesome-chatgpt-prompts',
    '30-seconds-of-code',
  ];

  for (const term of searchTerms) {
    await searcher.searchSimilarNames(term, 5);
  }

  // Run matching on all repos
  console.log('\n=== Running Matching Algorithm ===\n');
  await matcher.findMatchesForAllRepos();

  // Show results
  console.log('\n=== SCAM DETECTION RESULTS ===\n');
  const matches = await matchesRepo.findHighConfidenceMatches(100);

  if (matches.length === 0) {
    console.log('  No high-confidence matches found.\n');
  } else {
    console.log(`  Found ${matches.length} potential scam repos:\n`);

    for (const match of matches) {
      const repo1 = await reposRepo.findById(match.repo1Id);
      const repo2 = await reposRepo.findById(match.repo2Id);

      if (repo1 && repo2) {
        console.log(`  🚨 MATCH #${match.id}`);
        console.log(`     Repo 1: ${repo1.fullName} (${repo1.stars} stars, created ${repo1.githubCreatedAt.toISOString().split('T')[0]})`);
        console.log(`     Repo 2: ${repo2.fullName} (${repo2.stars} stars, created ${repo2.githubCreatedAt.toISOString().split('T')[0]})`);
        console.log(`     Matching commits: ${match.matchingCommitsCount}`);
        console.log(`     Match percentage: ${match.matchPercentage.toFixed(2)}%`);
        console.log(`     Confidence: ${match.confidenceScore}/100 (${match.confidenceLevel})`);
        console.log(`     Commits predate repo: ${match.commitsPredateRepo ? 'YES ⚠️' : 'No'}`);
        console.log();
      }
    }
  }

  console.log('='.repeat(60) + '\n');
}

if (require.main === module) {
  findScams().catch(console.error);
}

export { findScams };

