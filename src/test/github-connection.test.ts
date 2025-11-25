import { GitHubClient } from '../api/github-client';
import { createGitHubClient, getRateLimit } from '../config/github';

async function testGitHubConnection() {
  console.log('=== Testing GitHub API Connection ===\n');

  try {
    const client = new GitHubClient();

    // Test 1: Rate limit check
    console.log('1. Checking rate limit...');
    const octokit = createGitHubClient();
    const rateLimit = await getRateLimit(octokit);
    console.log(`   ✓ Rate limit: ${rateLimit.remaining}/${rateLimit.limit}`);
    console.log(`   ✓ Reset at: ${new Date(rateLimit.reset * 1000).toISOString()}\n`);

    if (rateLimit.remaining === 0) {
      console.log('   ⚠️  Rate limit exhausted! Waiting...');
      return;
    }

    // Test 2: Fetch repository metadata
    console.log('2. Fetching repository metadata...');
    const repo = await client.getRepository('fumiya-kume', 'ai-in-japan');
    console.log(`   ✓ Repository: ${repo.fullName}`);
    console.log(`   ✓ Created: ${repo.createdAt.toISOString()}`);
    console.log(`   ✓ Stars: ${repo.stars}, Forks: ${repo.forks}`);
    console.log(`   ✓ Description: ${repo.description || 'N/A'}\n`);

    // Test 3: Fetch commits
    console.log('3. Fetching commits (first 10)...');
    const commits = await client.getCommits('fumiya-kume', 'ai-in-japan', 10);
    console.log(`   ✓ Fetched ${commits.length} commits\n`);
    
    if (commits.length > 0) {
      console.log('   Sample commits:');
      commits.slice(0, 3).forEach((commit, idx) => {
        console.log(`   ${idx + 1}. ${commit.message.substring(0, 60)}...`);
        console.log(`      Author: ${commit.authorName} <${commit.authorEmail}>`);
        console.log(`      Date: ${commit.timestamp.toISOString()}`);
      });
      console.log();
    }

    // Test 4: Get first commit
    console.log('4. Fetching first commit...');
    const firstCommit = await client.getFirstCommit('fumiya-kume', 'ai-in-japan');
    if (firstCommit) {
      console.log(`   ✓ First commit: ${firstCommit.message.substring(0, 60)}...`);
      console.log(`   ✓ Date: ${firstCommit.timestamp.toISOString()}`);
      console.log(`   ✓ Author: ${firstCommit.authorName}\n`);
    }

    console.log('✅ All GitHub API tests passed!\n');
    return true;
  } catch (error: any) {
    console.error('❌ GitHub API test failed:', error.message);
    if (error.status === 401) {
      console.error('   → Check your GITHUB_TOKEN environment variable');
    } else if (error.status === 403) {
      console.error('   → Rate limit exceeded or token lacks permissions');
    }
    return false;
  }
}

if (require.main === module) {
  testGitHubConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

export { testGitHubConnection };

