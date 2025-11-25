import { pool } from './schema';

export interface MatchStatistics {
  totalCommitsRepo1: number;
  totalCommitsRepo2: number;
  matchingCommits: number;
  matchPercentage: number;
  exactMatches: number;
  messageOnlyMatches: number;
  timestampMatches: number;
  repo1CreatedAt: Date;
  repo2CreatedAt: Date;
  repo1FirstCommit: Date | null;
  repo2FirstCommit: Date | null;
  commitsPredateRepo2: boolean;
  timeGapDays: number;
  uniqueAuthorsRepo1: number;
  uniqueAuthorsRepo2: number;
  authorOverlap: number;
  differentAuthorMatches: number;
  confidenceScore: number;
  confidenceLevel: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
  sampleMatchingCommits: Array<{
    message: string;
    timestamp: Date;
    author1: string;
    author2: string;
  }>;
}

export interface MatchRecord {
  id: number;
  repo1Id: number;
  repo2Id: number;
  matchingCommitsCount: number;
  matchPercentage: number;
  confidenceScore: number;
  confidenceLevel: string;
  commitsPredateRepo: boolean;
  statistics: MatchStatistics;
  evidence: any;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MatchesRepository {
  async upsert(
    repo1Id: number,
    repo2Id: number,
    statistics: MatchStatistics,
    evidence: any
  ): Promise<MatchRecord> {
    const client = await pool.connect();
    
    try {
      // Ensure repo1Id < repo2Id for consistency
      const [id1, id2] = repo1Id < repo2Id ? [repo1Id, repo2Id] : [repo2Id, repo1Id];

      const result = await client.query(`
        INSERT INTO matches (
          repo1_id, repo2_id, matching_commits_count, match_percentage,
          confidence_score, confidence_level, commits_predate_repo,
          statistics, evidence, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (repo1_id, repo2_id)
        DO UPDATE SET
          matching_commits_count = EXCLUDED.matching_commits_count,
          match_percentage = EXCLUDED.match_percentage,
          confidence_score = EXCLUDED.confidence_score,
          confidence_level = EXCLUDED.confidence_level,
          commits_predate_repo = EXCLUDED.commits_predate_repo,
          statistics = EXCLUDED.statistics,
          evidence = EXCLUDED.evidence,
          updated_at = NOW()
        RETURNING *
      `, [
        id1,
        id2,
        statistics.matchingCommits,
        statistics.matchPercentage,
        statistics.confidenceScore,
        statistics.confidenceLevel,
        statistics.commitsPredateRepo2,
        JSON.stringify(statistics),
        JSON.stringify(evidence),
        'pending',
      ]);

      return this.mapRowToRecord(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByRepoId(repoId: number): Promise<MatchRecord[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM matches 
        WHERE repo1_id = $1 OR repo2_id = $1
        ORDER BY confidence_score DESC
      `, [repoId]);

      return result.rows.map(row => this.mapRowToRecord(row));
    } finally {
      client.release();
    }
  }

  async findHighConfidenceMatches(limit: number = 100): Promise<MatchRecord[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM matches 
        WHERE confidence_score >= 50
        ORDER BY confidence_score DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => this.mapRowToRecord(row));
    } finally {
      client.release();
    }
  }

  async updateStatus(id: number, status: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query(
        'UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, id]
      );
    } finally {
      client.release();
    }
  }

  private mapRowToRecord(row: any): MatchRecord {
    return {
      id: row.id,
      repo1Id: row.repo1_id,
      repo2Id: row.repo2_id,
      matchingCommitsCount: row.matching_commits_count,
      matchPercentage: parseFloat(row.match_percentage),
      confidenceScore: row.confidence_score,
      confidenceLevel: row.confidence_level,
      commitsPredateRepo: row.commits_predate_repo,
      statistics: typeof row.statistics === 'string' ? JSON.parse(row.statistics) : row.statistics,
      evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

