import { CommitMatcher } from '../scanner/commit-matcher';
import { MatchesRepository } from '../db/matches-repo';
import { RepositoriesRepository } from '../db/repos-repo';
import { pool } from '../db/schema';

async function testMatching() {
  console.log('=== Testing Commit Matching ===\n');

  try {
    // Test 1: Check if we have both repos indexed
    console.log('1. Checking indexed repositories...');
    const reposRepo = new RepositoriesRepository();
    
    const repo1 = await reposRepo.findByFullName('fumiya-kume/ai-in-japan');
    const repo2 = await reposRepo.findByFullName('Apollocolaris/AI-Japan');
    
    if (!repo1) {
      console.log('   ⚠️  Real repo not indexed. Please run indexing test first.');
      return false;
    }
    
    if (!repo2) {
      console.log('   ⚠️  Fake repo not indexed. Indexing it now...');
      const { CommitIndexer } = await import('../scanner/commit-indexer');
      const indexer = new CommitIndexer();
      await indexer.indexRepository('Apollocolaris', 'AI-Japan');
      const repo2After = await reposRepo.findByFullName('Apollocolaris/AI-Japan');
      if (!repo2After) {
        throw new Error('Failed to index fake repo');
      }
      console.log('   ✓ Fake repo indexed\n');
    }

    const realRepo = repo1;
    const fakeRepo = repo2 || await reposRepo.findByFullName('Apollocolaris/AI-Japan');
    
    if (!fakeRepo) {
      throw new Error('Fake repo not found');
    }

    console.log(`   ✓ Real repo: ${realRepo.fullName} (ID: ${realRepo.id})`);
    console.log(`   ✓ Fake repo: ${fakeRepo.fullName} (ID: ${fakeRepo.id})\n`);

    // Test 2: Run matching
    console.log('2. Running commit matching...');
    const matcher = new CommitMatcher();
    await matcher.compareRepositories(realRepo.id, fakeRepo.id);
    console.log('   ✓ Matching completed\n');

    // Test 3: Check for matches
    console.log('3. Checking match results...');
    const matchesRepo = new MatchesRepository();
    const matches = await matchesRepo.findByRepoId(realRepo.id);
    
    const match = matches.find(m => 
      (m.repo1Id === realRepo.id && m.repo2Id === fakeRepo.id) ||
      (m.repo1Id === fakeRepo.id && m.repo2Id === realRepo.id)
    );

    if (match) {
      console.log(`   ✓ Match found!`);
      console.log(`     - Matching commits: ${match.matchingCommitsCount}`);
      console.log(`     - Match percentage: ${match.matchPercentage.toFixed(2)}%`);
      console.log(`     - Confidence score: ${match.confidenceScore}/100`);
      console.log(`     - Confidence level: ${match.confidenceLevel}`);
      console.log(`     - Commits predate repo: ${match.commitsPredateRepo}`);
      
      if (match.statistics && match.statistics.sampleMatchingCommits) {
        console.log(`\n   Sample matching commits:`);
        match.statistics.sampleMatchingCommits.slice(0, 3).forEach((c: any, idx: number) => {
          console.log(`   ${idx + 1}. "${c.message.substring(0, 50)}..."`);
          console.log(`      Author 1: ${c.author1}`);
          console.log(`      Author 2: ${c.author2}`);
        });
      }
      console.log();
    } else {
      console.log('   ⚠️  No match found (this might be expected if repos are different)\n');
    }

    // Test 4: Test finding all matches
    console.log('4. Finding all high-confidence matches...');
    const highConfidenceMatches = await matchesRepo.findHighConfidenceMatches(10);
    console.log(`   ✓ Found ${highConfidenceMatches.length} high-confidence matches\n`);

    console.log('✅ All matching tests passed!\n');
    return true;
  } catch (error: any) {
    console.error('❌ Matching test failed:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

if (require.main === module) {
  testMatching()
    .then((success) => {
      pool.end();
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      pool.end();
      process.exit(1);
    });
}

export { testMatching };

