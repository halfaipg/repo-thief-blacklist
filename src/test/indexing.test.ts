import { CommitIndexer } from '../scanner/commit-indexer';
import { RepositoriesRepository } from '../db/repos-repo';
import { CommitsRepository } from '../db/commits-repo';
import { pool } from '../db/schema';

async function testIndexing() {
  console.log('=== Testing Repository Indexing ===\n');

  try {
    // Test 1: Check database connection
    console.log('1. Checking database connection...');
    await pool.query('SELECT NOW()');
    console.log('   ✓ Database connected\n');

    // Test 2: Index a known repository
    console.log('2. Indexing repository: fumiya-kume/ai-in-japan...');
    const indexer = new CommitIndexer();
    await indexer.indexRepository('fumiya-kume', 'ai-in-japan');
    console.log('   ✓ Repository indexed\n');

    // Test 3: Verify repository was stored
    console.log('3. Verifying repository in database...');
    const reposRepo = new RepositoriesRepository();
    const repo = await reposRepo.findByFullName('fumiya-kume/ai-in-japan');
    
    if (!repo) {
      throw new Error('Repository not found in database');
    }
    
    console.log(`   ✓ Repository ID: ${repo.id}`);
    console.log(`   ✓ Full name: ${repo.fullName}`);
    console.log(`   ✓ Stars: ${repo.stars}`);
    console.log(`   ✓ First commit date: ${repo.firstCommitDate?.toISOString() || 'N/A'}`);
    console.log(`   ✓ Scan status: ${repo.scanStatus}\n`);

    // Test 4: Verify commits were stored
    console.log('4. Verifying commits in database...');
    const commitsRepo = new CommitsRepository();
    const commits = await commitsRepo.findByRepoId(repo.id);
    const commitCount = await commitsRepo.countByRepoId(repo.id);
    
    console.log(`   ✓ Total commits stored: ${commitCount}`);
    
    if (commits.length > 0) {
      console.log('\n   Sample commits:');
      commits.slice(0, 3).forEach((commit, idx) => {
        console.log(`   ${idx + 1}. ${commit.message.substring(0, 60)}...`);
        console.log(`      Author: ${commit.authorName}`);
        console.log(`      Date: ${commit.timestamp.toISOString()}`);
      });
      console.log();
    }

    // Test 5: Test commit matching query
    console.log('5. Testing commit matching query...');
    if (commits.length > 0) {
      const testCommit = commits[0];
      const matches = await commitsRepo.findMatchingCommits(
        testCommit.message,
        testCommit.timestamp,
        repo.id
      );
      console.log(`   ✓ Found ${matches.length} matching commits (excluding self)\n`);
    }

    console.log('✅ All indexing tests passed!\n');
    return true;
  } catch (error: any) {
    console.error('❌ Indexing test failed:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

if (require.main === module) {
  testIndexing()
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

export { testIndexing };

