import { GitHubWideMatcher } from '../scanner/github-wide-matcher';

async function testGitHubWideScan() {
  console.log('\n' + '='.repeat(60));
  console.log('🌐 TESTING GITHUB-WIDE SCAN');
  console.log('='.repeat(60) + '\n');

  const matcher = new GitHubWideMatcher();

  // Test scanning Apollocolaris profile across ALL of GitHub
  const username = 'Apollocolaris';
  
  console.log(`Scanning profile: ${username}`);
  console.log('This will search ALL of GitHub for matching repos...\n');

  try {
    await matcher.scanProfileAcrossGitHub(username);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SCAN COMPLETE');
    console.log('='.repeat(60) + '\n');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testGitHubWideScan().catch(console.error);

