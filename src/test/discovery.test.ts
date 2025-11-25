import { PopularReposDiscovery } from '../discovery/popular-repos';
import { CommitMatcherDiscovery } from '../discovery/commit-matcher-discovery';
import { ProfileScanner } from '../discovery/profile-scanner';

async function testDiscovery() {
  console.log('=== Testing Discovery Mechanisms ===\n');

  try {
    // Test 1: Popular repos discovery
    console.log('1. Testing popular repos discovery...');
    const popularDiscovery = new PopularReposDiscovery();
    await popularDiscovery.discoverPopularRepos({
      minStars: 500,
      languages: ['javascript'],
      limit: 5,
    });
    console.log('   ✓ Popular repos discovery works\n');

    // Test 2: Commit matcher discovery
    console.log('2. Testing commit matcher discovery...');
    const commitDiscovery = new CommitMatcherDiscovery();
    await commitDiscovery.discoverFromCommitMatches();
    console.log('   ✓ Commit matcher discovery works\n');

    // Test 3: Profile scanner
    console.log('3. Testing profile scanner...');
    const profileScanner = new ProfileScanner();
    const stats = await profileScanner.analyzeProfile('fumiya-kume');
    if (stats) {
      console.log(`   ✓ Profile analysis works`);
      console.log(`     Username: ${stats.username}`);
      console.log(`     Repo count: ${stats.repoCount}`);
      console.log(`     Suspicious score: ${stats.suspiciousScore}\n`);
    }

    console.log('✅ All discovery tests passed!\n');
    return true;
  } catch (error: any) {
    console.error('❌ Discovery test failed:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

if (require.main === module) {
  testDiscovery()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

export { testDiscovery };

