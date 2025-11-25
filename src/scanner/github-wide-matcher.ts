import { GitHubClient, GitHubRepository, GitHubCommit } from '../api/github-client';
import { CommitIndexer } from './commit-indexer';
import { CommitMatcher } from './commit-matcher';
import { RepositoriesRepository } from '../db/repos-repo';
import { MatchesRepository } from '../db/matches-repo';
import { calculateMatchStatistics } from './scoring';

/**
 * Matches repos against ALL of GitHub, not just our database
 */
export class GitHubWideMatcher {
  private githubClient: GitHubClient;
  private commitIndexer: CommitIndexer;
  private commitMatcher: CommitMatcher;
  private reposRepo: RepositoriesRepository;
  private matchesRepo: MatchesRepository;

  constructor() {
    this.githubClient = new GitHubClient();
    this.commitIndexer = new CommitIndexer();
    this.commitMatcher = new CommitMatcher();
    this.reposRepo = new RepositoriesRepository();
    this.matchesRepo = new MatchesRepository();
  }

  /**
   * Find matching repos across ALL of GitHub for a given repo
   */
  async findMatchesAcrossGitHub(owner: string, repo: string): Promise<Array<{
    repo: { fullName: string; stars: number; createdAt: Date };
    matches: number;
    confidenceScore: number;
    matchingCommits: number;
  }>> {
    console.log(`\n🔍 Searching ALL of GitHub for matches to ${owner}/${repo}...\n`);

    // Get commits from the repo
    const commits = await this.githubClient.getCommits(owner, repo, 1000);
    
    if (commits.length === 0) {
      console.log('  No commits found in repo');
      return [];
    }

    console.log(`  Found ${commits.length} commits, searching GitHub...`);

    // Strategy 1: Search for repos with similar names (most likely to be copies)
    const similarNameRepos: GitHubRepository[] = [];
    
    // Generate search terms from repo name
    const repoNameWords = repo
      .toLowerCase()
      .replace(/[-_]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);
    
    if (repoNameWords.length > 0) {
      // Search for repos with similar names
      const searchTerms = [
        repoNameWords.join(' '), // Full name
        repoNameWords.slice(0, 2).join(' '), // First 2 words
        repoNameWords[0], // First word
      ].filter(Boolean);

      for (const term of searchTerms.slice(0, 3)) {
        try {
          const repos = await this.githubClient.searchRepositories(term, 30);
          for (const r of repos) {
            if (r.owner !== owner && !similarNameRepos.find(x => x.fullName === r.fullName)) {
              similarNameRepos.push(r);
            }
          }
        } catch (error: any) {
          console.error(`  Error searching for "${term}":`, error.message);
        }
      }
    }

    // Strategy 2: Find repos with matching commits (using commit message search)
    const commitMatchRepos = await this.githubClient.findReposWithMatchingCommits(
      commits,
      owner,
      30
    );

    // Combine both strategies
    const candidateRepos = new Map<string, GitHubRepository>();
    
    // Add similar name repos first (higher priority)
    for (const repo of similarNameRepos) {
      candidateRepos.set(repo.fullName, repo);
    }
    
    // Add commit match repos
    for (const repo of commitMatchRepos) {
      if (!candidateRepos.has(repo.fullName)) {
        candidateRepos.set(repo.fullName, repo);
      }
    }

    // Limit to 20 candidate repos per repo to prevent hanging (can be increased later)
    // Limit to 10 candidate repos per repo to prevent hanging (reduced from 20)
    const candidateList = Array.from(candidateRepos.values()).slice(0, 10); // Check up to 10 repos
    console.log(`  Found ${candidateList.length} candidate repos to check (${similarNameRepos.length} by name, ${commitMatchRepos.length} by commits)`);
    console.log(`  ⏱️  Checking up to ${candidateList.length} repos (limited to prevent timeouts)`);

    const matches: Array<{
      repo: { fullName: string; stars: number; createdAt: Date };
      matches: number;
      confidenceScore: number;
      matchingCommits: number;
    }> = [];

    // Check each candidate repo (with timeout per repo)
    for (let i = 0; i < candidateList.length; i++) {
      const candidateRepo = candidateList[i];
      console.log(`  [${i + 1}/${candidateList.length}] Checking ${candidateRepo.fullName}...`);

      try {
        // Add timeout for each repo check (15 seconds max - reduced for faster scanning)
        const checkPromise = this.githubClient.checkRepoForMatchingCommits(
          candidateRepo.owner,
          candidateRepo.name,
          commits,
          3 // Minimum 3 matches to consider
        );
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Check timeout')), 15000) // 15 seconds
        );
        
        const result = await Promise.race([checkPromise, timeoutPromise]) as { matches: number; matchingCommits: GitHubCommit[] };

        if (result.matches >= 3) {
          console.log(`    ✓ Found ${result.matches} matching commits!`);

          // Index this repo to get full commit history (with timeout)
          try {
            const indexPromise = this.commitIndexer.indexRepository(candidateRepo.owner, candidateRepo.name);
            const indexTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Index timeout')), 60000)
            );
            await Promise.race([indexPromise, indexTimeout]);
            
            // Get the repo record
            const repoRecord = await this.reposRepo.findByFullName(candidateRepo.fullName);
            const originalRepoRecord = await this.reposRepo.findByFullName(`${owner}/${repo}`);

            if (repoRecord && originalRepoRecord) {
              // Compare repositories (with timeout)
              const matchPromise = this.commitMatcher.findMatchesForRepo(repoRecord.id);
              const matchTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Match timeout')), 30000)
              );
              await Promise.race([matchPromise, matchTimeout]);

              // Get the match
              const matchRecords = await this.matchesRepo.findByRepoId(repoRecord.id);
              const matchWithOriginal = matchRecords.find(
                m => m.repo1Id === originalRepoRecord.id || m.repo2Id === originalRepoRecord.id
              );

              if (matchWithOriginal && matchWithOriginal.confidenceScore >= 50) {
                matches.push({
                  repo: {
                    fullName: candidateRepo.fullName,
                    stars: candidateRepo.stars,
                    createdAt: candidateRepo.createdAt,
                  },
                  matches: result.matches,
                  confidenceScore: matchWithOriginal.confidenceScore,
                  matchingCommits: matchWithOriginal.matchingCommitsCount,
                });

                console.log(`    🚨 HIGH CONFIDENCE MATCH! Score: ${matchWithOriginal.confidenceScore}/100`);
              }
            }
          } catch (error: any) {
            console.error(`    ✗ Error processing ${candidateRepo.fullName}:`, error.message);
            // Continue to next candidate even if this one fails
          }
        } else {
          console.log(`    ✗ Only ${result.matches} matches (need 3+)`);
        }
      } catch (error: any) {
        console.error(`    ✗ Error checking ${candidateRepo.fullName}:`, error.message);
        // Continue to next candidate even if this one fails
      }
    }

    console.log(`\n  ✅ Found ${matches.length} high-confidence matches across GitHub\n`);

    return matches;
  }

  /**
   * Scan a profile and find matches across ALL of GitHub
   */
  async scanProfileAcrossGitHub(username: string): Promise<{
    totalRepos: number;
    scannedRepos: number;
    matchesFound: number;
    suspiciousRepos: Array<{
      repo: string;
      matches: Array<{
        matchedRepo: string;
        confidenceScore: number;
        matchingCommits: number;
      }>;
    }>;
  }> {
    console.log(`\n🌐 Scanning profile ${username} across ALL of GitHub...\n`);

    // Get user's repos
    const query = `user:${username} sort:created`;
    const userRepos = await this.githubClient.searchRepositories(query, 100);

    console.log(`Found ${userRepos.length} repos for ${username}\n`);

    const suspiciousRepos: Array<{
      repo: string;
      matches: Array<{
        matchedRepo: string;
        confidenceScore: number;
        matchingCommits: number;
      }>;
    }> = [];

    let scannedRepos = 0;
    let totalMatches = 0;

    for (let i = 0; i < userRepos.length; i++) {
      const repo = userRepos[i];
      console.log(`\n[${i + 1}/${userRepos.length}] Scanning ${repo.fullName}...`);

      try {
        // Update status to show we're scanning this repo
        const repoRecord = await this.reposRepo.findByFullName(repo.fullName);
        if (repoRecord) {
          await this.reposRepo.updateScanStatus(repo.fullName, 'processing');
        }
        
        // Add timeout to prevent hanging (2 minutes per repo max - reduced for faster completion)
        const scanPromise = this.findMatchesAcrossGitHub(repo.owner, repo.name);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Scan timeout after 2 minutes')), 2 * 60 * 1000)
        );
        
        let matches: Array<{
          repo: { fullName: string; stars: number; createdAt: Date };
          matches: number;
          confidenceScore: number;
          matchingCommits: number;
        }> = [];
        
        try {
          matches = await Promise.race([scanPromise, timeoutPromise]) as typeof matches;
          console.log(`  ✓ Completed scan for ${repo.fullName}`);
        } catch (timeoutError: any) {
          console.log(`  ⚠️  Scan timed out for ${repo.fullName} after 2 minutes (continuing to next repo)`);
          matches = []; // Empty matches on timeout
        }
        
        scannedRepos++;
        
        // ALWAYS mark as completed, even on timeout
        if (repoRecord) {
          await this.reposRepo.updateScanStatus(repo.fullName, 'completed');
          console.log(`  ✓ Marked ${repo.fullName} as completed`);
        } else {
          // If repo doesn't exist, create it and mark as completed
          try {
            await this.reposRepo.upsert(repo);
            await this.reposRepo.updateScanStatus(repo.fullName, 'completed');
          } catch (err: any) {
            console.error(`  ✗ Error creating repo record:`, err.message);
          }
        }
        
        if (matches.length > 0) {
          totalMatches += matches.length;
          console.log(`  🚨 Found ${matches.length} suspicious matches:`);
          matches.forEach(m => {
            console.log(`    - ${m.repo.fullName} (${m.matchingCommits} commits, ${m.confidenceScore}/100 confidence)`);
          });
          
          suspiciousRepos.push({
            repo: repo.fullName,
            matches: matches.map(m => ({
              matchedRepo: m.repo.fullName,
              confidenceScore: m.confidenceScore,
              matchingCommits: m.matchingCommits,
            })),
          });
        } else {
          console.log(`  ✓ No suspicious matches found`);
        }
      } catch (error: any) {
        console.error(`  ✗ Error scanning ${repo.fullName}:`, error.message);
        scannedRepos++; // Count as scanned even if error
        
        // ALWAYS mark as completed so scan can finish
        try {
          const repoRecord = await this.reposRepo.findByFullName(repo.fullName);
          if (repoRecord) {
            await this.reposRepo.updateScanStatus(repo.fullName, 'completed');
          } else {
            // Create repo if it doesn't exist
            await this.reposRepo.upsert(repo);
            await this.reposRepo.updateScanStatus(repo.fullName, 'completed');
          }
          console.log(`  ✓ Marked ${repo.fullName} as completed (after error)`);
        } catch (markError: any) {
          console.error(`  ✗ Error marking ${repo.fullName} as completed:`, markError.message);
        }
        
        // Continue to next repo even if this one failed
        continue;
      }
    }

    // Final cleanup - mark any remaining repos as completed
    console.log(`\n🔧 Final cleanup - marking remaining repos as completed...`);
    for (const repo of userRepos) {
      try {
        const repoRecord = await this.reposRepo.findByFullName(repo.fullName);
        if (repoRecord && (repoRecord.scanStatus === 'pending' || repoRecord.scanStatus === 'processing')) {
          await this.reposRepo.updateScanStatus(repo.fullName, 'completed');
          console.log(`  ✓ Marked ${repo.fullName} as completed`);
        }
      } catch (error: any) {
        console.error(`  ✗ Error marking ${repo.fullName}:`, error.message);
      }
    }

    console.log(`\n✅ Profile scan complete`);
    console.log(`   Scanned: ${scannedRepos}/${userRepos.length} repos`);
    console.log(`   Found: ${totalMatches} total matches`);
    console.log(`   Suspicious repos: ${suspiciousRepos.length}\n`);

    return {
      totalRepos: userRepos.length,
      scannedRepos,
      matchesFound: totalMatches,
      suspiciousRepos,
    };
  }
}

