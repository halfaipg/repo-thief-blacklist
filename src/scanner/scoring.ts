import { MatchStatistics } from '../db/matches-repo';

export type ConfidenceLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

export function calculateSuspicionScore(stats: MatchStatistics): number {
  let score = 0;

  // 1. Commit Message Match Score (0-40 points)
  if (stats.exactMatches >= 50) {
    score += 40;
  } else if (stats.exactMatches >= 30) {
    score += 35;
  } else if (stats.exactMatches >= 20) {
    score += 30;
  } else if (stats.exactMatches >= 10) {
    score += 25;
  } else if (stats.exactMatches >= 5) {
    score += 20;
  } else if (stats.exactMatches >= 3) {
    score += 15;
  } else if (stats.exactMatches >= 1) {
    score += 10;
  }

  // 2. Match Percentage Score (0-25 points)
  if (stats.matchPercentage > 90) {
    score += 25;
  } else if (stats.matchPercentage >= 80) {
    score += 20;
  } else if (stats.matchPercentage >= 70) {
    score += 15;
  } else if (stats.matchPercentage >= 50) {
    score += 10;
  } else if (stats.matchPercentage >= 30) {
    score += 5;
  }

  // 3. Temporal Anomaly Score (0-20 points)
  if (stats.commitsPredateRepo2) {
    score += 20;
  } else if (
    stats.repo2CreatedAt > stats.repo1CreatedAt &&
    stats.exactMatches > 0
  ) {
    score += 15;
  }
  
  const timeGapDays = Math.abs(
    (stats.repo2CreatedAt.getTime() - stats.repo1CreatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (timeGapDays > 30) {
    score += 10;
  }
  
  if (
    stats.repo1FirstCommit &&
    stats.repo2FirstCommit &&
    stats.repo1FirstCommit.getTime() === stats.repo2FirstCommit.getTime()
  ) {
    score += 5;
  }

  // 4. Author Pattern Score (0-10 points)
  if (
    stats.differentAuthorMatches === stats.exactMatches &&
    stats.exactMatches > 0
  ) {
    score += 10;
  } else if (stats.differentAuthorMatches > stats.exactMatches * 0.8) {
    score += 8;
  } else if (stats.differentAuthorMatches > 0) {
    score += 5;
  }

  // Cap at 100
  return Math.min(100, score);
}

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 85) return 'VERY_HIGH';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  if (score >= 30) return 'LOW';
  return 'VERY_LOW';
}

export function calculateMatchStatistics(
  repo1Commits: Array<{ message: string; timestamp: Date; authorName: string; authorEmail: string }>,
  repo2Commits: Array<{ message: string; timestamp: Date; authorName: string; authorEmail: string }>,
  repo1CreatedAt: Date,
  repo2CreatedAt: Date,
  repo1FirstCommit: Date | null,
  repo2FirstCommit: Date | null
): MatchStatistics {
  // Normalize timestamps to minute precision for matching
  const normalizeTimestamp = (ts: Date) => {
    const normalized = new Date(ts);
    normalized.setSeconds(0, 0);
    return normalized.getTime();
  };

  // Find exact matches (message + timestamp)
  const exactMatches: Array<{
    message: string;
    timestamp: Date;
    author1: string;
    author2: string;
  }> = [];

  const repo1Map = new Map<string, Array<{ timestamp: number; author: string; email: string }>>();
  const repo2Map = new Map<string, Array<{ timestamp: number; author: string; email: string }>>();

  // Index repo1 commits by message
  for (const commit of repo1Commits) {
    const normalizedTs = normalizeTimestamp(commit.timestamp);
    if (!repo1Map.has(commit.message)) {
      repo1Map.set(commit.message, []);
    }
    repo1Map.get(commit.message)!.push({
      timestamp: normalizedTs,
      author: commit.authorName,
      email: commit.authorEmail,
    });
  }

  // Index repo2 commits by message
  for (const commit of repo2Commits) {
    const normalizedTs = normalizeTimestamp(commit.timestamp);
    if (!repo2Map.has(commit.message)) {
      repo2Map.set(commit.message, []);
    }
    repo2Map.get(commit.message)!.push({
      timestamp: normalizedTs,
      author: commit.authorName,
      email: commit.authorEmail,
    });
  }

  // Find matches
  let differentAuthorMatches = 0;
  for (const [message, repo1CommitsForMsg] of repo1Map.entries()) {
    const repo2CommitsForMsg = repo2Map.get(message);
    if (!repo2CommitsForMsg) continue;

    for (const repo1Commit of repo1CommitsForMsg) {
      for (const repo2Commit of repo2CommitsForMsg) {
        if (repo1Commit.timestamp === repo2Commit.timestamp) {
          const author1 = `${repo1Commit.author}<${repo1Commit.email}>`;
          const author2 = `${repo2Commit.author}<${repo2Commit.email}>`;
          
          if (author1 !== author2) {
            differentAuthorMatches++;
            exactMatches.push({
              message,
              timestamp: new Date(repo1Commit.timestamp),
              author1: repo1Commit.author,
              author2: repo2Commit.author,
            });
          }
        }
      }
    }
  }

  // Calculate match percentage
  const totalCommits = Math.max(repo1Commits.length, repo2Commits.length);
  const matchPercentage = totalCommits > 0 ? (exactMatches.length / totalCommits) * 100 : 0;

  // Count unique authors
  const repo1Authors = new Set(repo1Commits.map(c => `${c.authorName}<${c.authorEmail}>`));
  const repo2Authors = new Set(repo2Commits.map(c => `${c.authorName}<${c.authorEmail}>`));
  
  const authorOverlap = [...repo1Authors].filter(a => repo2Authors.has(a)).length;

  // Check if commits predate repo2 creation
  const commitsPredateRepo2 = repo2FirstCommit
    ? repo2FirstCommit < repo2CreatedAt
    : false;

  // Calculate time gap
  const timeGapDays = Math.abs(
    (repo2CreatedAt.getTime() - repo1CreatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const confidenceScore = calculateSuspicionScore({
    totalCommitsRepo1: repo1Commits.length,
    totalCommitsRepo2: repo2Commits.length,
    matchingCommits: exactMatches.length,
    matchPercentage,
    exactMatches: exactMatches.length,
    messageOnlyMatches: 0, // Not calculated for now
    timestampMatches: 0, // Not calculated for now
    repo1CreatedAt,
    repo2CreatedAt,
    repo1FirstCommit,
    repo2FirstCommit,
    commitsPredateRepo2,
    timeGapDays,
    uniqueAuthorsRepo1: repo1Authors.size,
    uniqueAuthorsRepo2: repo2Authors.size,
    authorOverlap,
    differentAuthorMatches,
    confidenceScore: 0, // Will be calculated
    confidenceLevel: 'VERY_LOW', // Will be calculated
    sampleMatchingCommits: exactMatches.slice(0, 10),
  });

  return {
    totalCommitsRepo1: repo1Commits.length,
    totalCommitsRepo2: repo2Commits.length,
    matchingCommits: exactMatches.length,
    matchPercentage,
    exactMatches: exactMatches.length,
    messageOnlyMatches: 0,
    timestampMatches: 0,
    repo1CreatedAt,
    repo2CreatedAt,
    repo1FirstCommit,
    repo2FirstCommit,
    commitsPredateRepo2,
    timeGapDays,
    uniqueAuthorsRepo1: repo1Authors.size,
    uniqueAuthorsRepo2: repo2Authors.size,
    authorOverlap,
    differentAuthorMatches,
    confidenceScore,
    confidenceLevel: getConfidenceLevel(confidenceScore),
    sampleMatchingCommits: exactMatches.slice(0, 10),
  };
}

