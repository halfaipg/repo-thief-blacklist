import express from 'express';
import cors from 'cors';
import { ReportsService } from './reports';
import { MatchesRepository } from '../db/matches-repo';
import { RepositoriesRepository } from '../db/repos-repo';
import { BlacklistRepository } from '../db/blacklist-repo';
import { ScanQueue } from '../queue/scan-queue';
import { ProfileScanner } from '../discovery/profile-scanner';
import { CommitIndexer } from '../scanner/commit-indexer';
import { CommitMatcher } from '../scanner/commit-matcher';
import { GitHubWideMatcher } from '../scanner/github-wide-matcher';
import { pool } from '../db/schema';

const app = express();
app.use(cors());
app.use(express.json());

const reportsService = new ReportsService();
const matchesRepo = new MatchesRepository();
const reposRepo = new RepositoriesRepository();
const blacklistRepo = new BlacklistRepository();
const scanQueue = new ScanQueue();
const profileScanner = new ProfileScanner();
const commitIndexer = new CommitIndexer();
const commitMatcher = new CommitMatcher();
const githubWideMatcher = new GitHubWideMatcher();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Submit a report
app.post('/api/reports', async (req, res) => {
  try {
    const { originalRepoUrl, suspectedFakeRepoUrl, reporterEmail, reporterName, evidence } = req.body;

    if (!originalRepoUrl || !suspectedFakeRepoUrl) {
      return res.status(400).json({ error: 'originalRepoUrl and suspectedFakeRepoUrl are required' });
    }

    const reportId = await reportsService.createReport({
      originalRepoUrl,
      suspectedFakeRepoUrl,
      reporterEmail,
      reporterName,
      evidence,
    });

    res.json({ success: true, reportId });
  } catch (error: any) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a report
app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await reportsService.getReport(parseInt(req.params.id, 10));
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
  } catch (error: any) {
    console.error('Error getting report:', error);
    res.status(500).json({ error: error.message });
  }
});

// List reports
app.get('/api/reports', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const reports = await reportsService.listReports(limit);
    res.json(reports);
  } catch (error: any) {
    console.error('Error listing reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if a repository is flagged
app.get('/api/repos/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const fullName = `${owner}/${repo}`;

    const repoRecord = await reposRepo.findByFullName(fullName);
    if (!repoRecord) {
      return res.status(404).json({ error: 'Repository not found in database' });
    }

    const matches = await matchesRepo.findByRepoId(repoRecord.id);

    res.json({
      repository: repoRecord,
      matches: matches.map(m => ({
        id: m.id,
        otherRepo: m.repo1Id === repoRecord.id ? m.repo2Id : m.repo1Id,
        matchingCommits: m.matchingCommitsCount,
        matchPercentage: m.matchPercentage,
        confidenceScore: m.confidenceScore,
        confidenceLevel: m.confidenceLevel,
        status: m.status,
      })),
    });
  } catch (error: any) {
    console.error('Error getting repository:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get high-confidence matches
app.get('/api/matches', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const minScore = parseInt(req.query.minScore as string, 10) || 50;
    
    const matches = await matchesRepo.findHighConfidenceMatches(limit);
    const filtered = matches.filter(m => m.confidenceScore >= minScore);

    // Enrich with repository details
    const enriched = await Promise.all(
      filtered.map(async (match) => {
        const repo1 = await reposRepo.findById(match.repo1Id);
        const repo2 = await reposRepo.findById(match.repo2Id);
        return {
          ...match,
          repo1: repo1 ? {
            fullName: repo1.fullName,
            stars: repo1.stars,
            createdAt: repo1.githubCreatedAt,
          } : null,
          repo2: repo2 ? {
            fullName: repo2.fullName,
            stars: repo2.stars,
            createdAt: repo2.githubCreatedAt,
          } : null,
        };
      })
    );

    res.json(enriched);
  } catch (error: any) {
    console.error('Error getting matches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get match details
app.get('/api/matches/:id', async (req, res) => {
  try {
    const matches = await matchesRepo.findHighConfidenceMatches(10000);
    const match = matches.find(m => m.id === parseInt(req.params.id, 10));

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const repo1 = await reposRepo.findById(match.repo1Id);
    const repo2 = await reposRepo.findById(match.repo2Id);

    res.json({
      match,
      repo1,
      repo2,
    });
  } catch (error: any) {
    console.error('Error getting match:', error);
    res.status(500).json({ error: error.message });
  }
});

// Queue a repository for scanning
app.post('/api/scan', async (req, res) => {
  try {
    const { owner, repo, repoUrl } = req.body;

    if (repoUrl) {
      await scanQueue.addScanJobFromUrl(repoUrl, 0);
      res.json({ success: true, message: `Queued ${repoUrl} for scanning` });
    } else if (owner && repo) {
      await scanQueue.addScanJob(owner, repo, 0);
      res.json({ success: true, message: `Queued ${owner}/${repo} for scanning` });
    } else {
      res.status(400).json({ error: 'Either repoUrl or owner+repo required' });
    }
  } catch (error: any) {
    console.error('Error queueing scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get queue stats
app.get('/api/queue/stats', async (req, res) => {
  try {
    const stats = await scanQueue.getQueueStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Track active scans
const activeScans = new Map<string, { startTime: Date; status: 'indexing' | 'scanning' | 'matching' | 'completed' }>();

// Scan a profile
app.post('/api/profile/:username/scan', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Mark scan as active
    activeScans.set(username, { startTime: new Date(), status: 'indexing' });
    
    // Start scanning in background (don't await - return immediately)
    (async () => {
      try {
        console.log(`\n🚀 Starting FULL GitHub-wide profile scan for: ${username}\n`);
        
        // Step 1: Get user's repos
        const { GitHubClient } = await import('../api/github-client');
        const githubClient = new GitHubClient();
        const query = `user:${username} sort:created`;
        const repos = await githubClient.searchRepositories(query, 100);
        
        console.log(`Found ${repos.length} repos for ${username}`);
        
        // Step 2: Reset ALL repos to 'pending' to start fresh scan
        activeScans.set(username, { startTime: new Date(), status: 'indexing' });
        for (const repo of repos) {
          try {
            // Upsert repo first to ensure it exists
            await reposRepo.upsert(repo);
            await reposRepo.updateScanStatus(repo.fullName, 'pending');
          } catch (error: any) {
            console.error(`  ✗ Error resetting ${repo.fullName}:`, error.message);
          }
        }
        
        // Step 3: Index all repos first (for database matching)
        let indexed = 0;
        for (const repo of repos) {
          try {
            // Mark as processing before indexing
            await reposRepo.updateScanStatus(repo.fullName, 'processing');
            
            await commitIndexer.indexRepository(repo.owner, repo.name);
            indexed++;
            console.log(`  ✓ Indexed ${repo.fullName} (${indexed}/${repos.length})`);
            
            // Keep as processing - GitHub scan will mark as completed
          } catch (error: any) {
            console.error(`  ✗ Error indexing ${repo.fullName}:`, error.message);
            await reposRepo.updateScanStatus(repo.fullName, 'failed');
          }
        }
        
        // Step 4: Run GitHub-wide matching (THIS IS THE KEY PART)
        // GitHub scan will mark repos as processing then completed
        activeScans.set(username, { startTime: new Date(), status: 'scanning' });
        
        activeScans.set(username, { startTime: new Date(), status: 'scanning' });
        console.log(`\n🌐 Searching ALL of GitHub for matching repos...`);
        console.log(`This will check each repo against GitHub's entire repository database\n`);
        console.log(`⏱️  This will take several minutes - scanning ${repos.length} repos across GitHub...\n`);
        
        const scanResults = await githubWideMatcher.scanProfileAcrossGitHub(username);
        
        console.log(`\n📊 GitHub-Wide Scan Summary:`);
        console.log(`   Total repos: ${scanResults.totalRepos}`);
        console.log(`   Scanned: ${scanResults.scannedRepos}`);
        console.log(`   Matches found: ${scanResults.matchesFound}`);
        console.log(`   Suspicious repos: ${scanResults.suspiciousRepos.length}`);
        
        // Step 5: Final cleanup - ensure ALL repos are marked as completed
        console.log(`\n🔧 Final cleanup - ensuring all repos are marked as completed...`);
        for (const repo of repos) {
          try {
            const repoRecord = await reposRepo.findByFullName(repo.fullName);
            if (!repoRecord || repoRecord.scanStatus !== 'completed') {
              if (!repoRecord) {
                await reposRepo.upsert(repo);
              }
              await reposRepo.updateScanStatus(repo.fullName, 'completed');
              console.log(`  ✓ Marked ${repo.fullName} as completed`);
            }
          } catch (error: any) {
            console.error(`  ✗ Error marking ${repo.fullName} as completed:`, error.message);
          }
        }
        
        // Step 6: Also run matching against our database
        activeScans.set(username, { startTime: new Date(), status: 'matching' });
        console.log(`\nRunning matching algorithm against database...`);
        await commitMatcher.findMatchesForAllRepos();
        
        // Mark scan as completed
        activeScans.set(username, { startTime: new Date(), status: 'completed' });
        console.log(`\n✅ Profile scan complete for ${username}\n`);
      } catch (error: any) {
        console.error(`❌ Error scanning profile ${username}:`, error);
        activeScans.delete(username); // Remove on error
      }
    })();
    
    // Return immediately - scan runs in background
    res.json({ 
      success: true, 
      message: `GitHub-wide profile scan started for ${username}. This will search ALL of GitHub for matching repos.`,
      status: 'processing'
    });
  } catch (error: any) {
    console.error('Error starting profile scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get profile scan status
app.get('/api/profile/:username/status', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get all repos for this user FIRST
    const userRepos = await reposRepo.findByOwner(username);
    
    const totalRepos = userRepos.length;
    const scannedRepos = userRepos.filter(r => r.scanStatus === 'completed').length;
    const pendingRepos = userRepos.filter(r => r.scanStatus === 'pending').length;
    const processingRepos = userRepos.filter(r => r.scanStatus === 'processing').length;
    
    // Check if there's an active scan OR repos are being processed
    const activeScan = activeScans.get(username);
    const isScanning = (activeScan && activeScan.status !== 'completed') || processingRepos > 0 || (pendingRepos > 0 && scannedRepos < totalRepos);
    
    // Get matches for this user's repos
    // This finds matches against ALL repos in the database (including ones found via GitHub-wide scan)
    let totalMatches = 0;
    let suspiciousRepos: any[] = [];
    
    for (const repo of userRepos) {
      const matches = await matchesRepo.findByRepoId(repo.id);
      if (matches.length > 0) {
        totalMatches += matches.length;
        
        // Get the other repo in each match to show what it matched against
        const matchDetails = await Promise.all(
          matches.map(async (m) => {
            const otherRepoId = m.repo1Id === repo.id ? m.repo2Id : m.repo1Id;
            const otherRepo = await reposRepo.findById(otherRepoId);
            return {
              ...m,
              matchedAgainst: otherRepo?.fullName || 'Unknown',
            };
          })
        );
        
        const highestMatch = matches.reduce((max, m) => 
          m.confidenceScore > max.confidenceScore ? m : max
        );
        
        if (highestMatch.confidenceScore >= 50) {
          // Find what repo this matched against
          const highestMatchDetail = matchDetails.find(m => m.id === highestMatch.id);
          suspiciousRepos.push({
            fullName: repo.fullName,
            suspicionScore: repo.suspicionScore,
            matches: matches.length,
            highestConfidence: highestMatch.confidenceScore,
            matchedAgainst: highestMatchDetail?.matchedAgainst || 'Unknown',
            allMatches: matchDetails.map(m => ({
              matchedRepo: m.matchedAgainst,
              confidence: m.confidenceScore,
            })),
          });
        }
      }
    }
    
    // Sort by confidence score (highest first)
    suspiciousRepos.sort((a, b) => b.highestConfidence - a.highestConfidence);
    
    // Calculate profile suspicion score
    const profileScore = suspiciousRepos.length > 0
      ? Math.min(100, Math.round(suspiciousRepos.reduce((sum, r) => sum + r.highestConfidence, 0) / suspiciousRepos.length))
      : 0;
    
    // Check if scan is still in progress
    // If there's an active scan OR repos are processing, scan is still running
    // But if scan has been idle for more than 5 minutes, consider it stuck and mark as complete
    const scanAge = activeScan ? Date.now() - activeScan.startTime.getTime() : 0;
    const isStuck = activeScan && activeScan.status !== 'completed' && scanAge > 5 * 60 * 1000; // 5 minutes
    
    // Also check if repos have been processing for too long (10 minutes)
    const stuckRepos = userRepos.filter(r => {
      if (r.scanStatus === 'processing') {
        // Check if repo has been processing for more than 10 minutes
        const repoAge = Date.now() - r.updatedAt.getTime();
        return repoAge > 10 * 60 * 1000;
      }
      return false;
    });
    
    if (isStuck || stuckRepos.length > 0) {
      console.log(`⚠️  Scan for ${username} appears stuck, cleaning up...`);
      // Mark all processing/pending repos as completed
      for (const repo of userRepos.filter(r => r.scanStatus === 'processing' || r.scanStatus === 'pending')) {
        await reposRepo.updateScanStatus(repo.fullName, 'completed');
      }
      activeScans.set(username, { startTime: new Date(), status: 'completed' });
    }
    
    const isComplete = (!isScanning || isStuck) && pendingRepos === 0 && processingRepos === 0 && totalRepos > 0;
    
    // If scan just started, don't show old results
    const showResults = isComplete || (activeScan && activeScan.status === 'scanning' && scannedRepos > 0);
    
    res.json({
      username,
      status: isComplete ? 'completed' : 'processing',
      scanStatus: activeScan?.status || 'idle',
      progress: {
        totalRepos,
        scannedRepos,
        pendingRepos,
        processingRepos,
        percentage: totalRepos > 0 ? Math.round((scannedRepos / totalRepos) * 100) : 0,
      },
      results: showResults ? {
        totalMatches,
        suspiciousRepos: suspiciousRepos.length,
        profileScore,
        suspiciousReposList: suspiciousRepos, // Show all suspicious repos
      } : null,
      message: isScanning 
        ? (activeScan?.status === 'indexing' || (pendingRepos > 0 && scannedRepos === 0))
          ? `Indexing ${totalRepos} repos... (${scannedRepos}/${totalRepos} done)`
          : (activeScan?.status === 'scanning' || processingRepos > 0 || (pendingRepos > 0 && scannedRepos > 0))
            ? `Scanning ${processingRepos || pendingRepos} repos across ALL of GitHub... This will take several minutes. (${scannedRepos}/${totalRepos} done)`
            : `Matching repositories... (${scannedRepos}/${totalRepos} done)`
        : isComplete 
          ? 'Scan complete!'
          : 'No active scan. Click "Scan Profile" to start.',
    });
  } catch (error: any) {
    console.error('Error getting profile status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get system stats
app.get('/api/stats', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const reposResult = await client.query('SELECT COUNT(*) as total FROM repositories');
      const commitsResult = await client.query('SELECT COUNT(*) as total FROM commits');
      
      res.json({
        totalRepos: parseInt(reposResult.rows[0].total, 10),
        totalCommits: parseInt(commitsResult.rows[0].total, 10),
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error getting system stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get blacklist stats
app.get('/api/blacklist/stats', async (req, res) => {
  try {
    const stats = await blacklistRepo.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting blacklist stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get blacklist (scammers)
app.get('/api/blacklist', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const search = req.query.search as string;
    const status = req.query.status as string;

    const result = await blacklistRepo.findAll({ page, limit, search, status });
    res.json(result);
  } catch (error: any) {
    console.error('Error getting blacklist:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific scammer details
app.get('/api/blacklist/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const scammer = await blacklistRepo.getScammerWithRepos(username);
    
    if (!scammer) {
      return res.status(404).json({ error: 'Scammer not found' });
    }

    res.json(scammer);
  } catch (error: any) {
    console.error('Error getting scammer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh account status for a specific scammer
app.post('/api/blacklist/:username/check-status', async (req, res) => {
  try {
    const { username } = req.params;
    const status = await blacklistRepo.checkAndUpdateAccountStatus(username);
    res.json({ username, accountStatus: status });
  } catch (error: any) {
    console.error('Error checking account status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh all account statuses
app.post('/api/blacklist/refresh-statuses', async (req, res) => {
  try {
    const result = await blacklistRepo.refreshAllAccountStatuses();
    res.json(result);
  } catch (error: any) {
    console.error('Error refreshing account statuses:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = parseInt(process.env.PORT || '4000', 10);

export function startServer() {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

