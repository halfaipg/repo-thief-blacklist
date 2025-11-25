import { testGitHubConnection } from './github-connection.test';
import { testIndexing } from './indexing.test';
import { testMatching } from './matching.test';
import { pool } from '../db/schema';

async function runAllTests() {
  console.log('🚀 Running Full Pipeline Tests\n');
  console.log('='.repeat(60) + '\n');

  const results = {
    github: false,
    indexing: false,
    matching: false,
  };

  // Test 1: GitHub Connection
  console.log('📡 TEST 1: GitHub API Connection\n');
  results.github = await testGitHubConnection();
  console.log('\n' + '='.repeat(60) + '\n');

  if (!results.github) {
    console.error('❌ GitHub connection test failed. Cannot continue.');
    return results;
  }

  // Test 2: Indexing
  console.log('📦 TEST 2: Repository Indexing\n');
  results.indexing = await testIndexing();
  console.log('\n' + '='.repeat(60) + '\n');

  if (!results.indexing) {
    console.error('❌ Indexing test failed. Cannot continue to matching.');
    return results;
  }

  // Test 3: Matching
  console.log('🔍 TEST 3: Commit Matching\n');
  results.matching = await testMatching();
  console.log('\n' + '='.repeat(60) + '\n');

  // Summary
  console.log('📊 TEST SUMMARY\n');
  console.log(`GitHub Connection: ${results.github ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Indexing:          ${results.indexing ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Matching:          ${results.matching ? '✅ PASS' : '❌ FAIL'}`);
  console.log();

  const allPassed = Object.values(results).every(r => r);
  console.log(allPassed ? '🎉 All tests passed!' : '⚠️  Some tests failed');
  console.log();

  return results;
}

if (require.main === module) {
  runAllTests()
    .then((results) => {
      pool.end();
      process.exit(Object.values(results).every(r => r) ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      pool.end();
      process.exit(1);
    });
}

export { runAllTests };

