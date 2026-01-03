import { pool } from './schema';

export interface BlacklistRecord {
  id: number;
  githubUsername: string;
  githubUserId: number | null;
  status: string;
  accountStatus: 'active' | 'eliminated' | 'unknown';
  totalStolenRepos: number;
  totalMatches: number;
  highestConfidenceScore: number;
  firstDetectedAt: Date;
  lastUpdatedAt: Date;
  accountCheckedAt: Date | null;
  evidenceSummary: any;
  createdAt: Date;
}

export interface ScammerWithRepos extends BlacklistRecord {
  stolenRepos: Array<{
    fullName: string;
    stars: number;
    createdAt: Date;
    matchId: number;
    confidenceScore: number;
    matchingCommits: number;
  }>;
}

export class BlacklistRepository {
  async upsert(username: string, githubUserId?: number): Promise<BlacklistRecord> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO blacklist (github_username, github_user_id, last_updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (github_username)
        DO UPDATE SET
          last_updated_at = NOW(),
          github_user_id = COALESCE(EXCLUDED.github_user_id, blacklist.github_user_id)
        RETURNING *
      `, [username, githubUserId || null]);

      return this.mapRowToRecord(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByUsername(username: string): Promise<BlacklistRecord | null> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM blacklist WHERE github_username = $1',
        [username]
      );

      return result.rows.length > 0 ? this.mapRowToRecord(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {}): Promise<{ scammers: BlacklistRecord[]; total: number }> {
    const client = await pool.connect();
    const { page = 1, limit = 50, search, status } = options;
    const offset = (page - 1) * limit;

    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND github_username ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM blacklist ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results
      params.push(limit, offset);
      const result = await client.query(
        `SELECT * FROM blacklist ${whereClause} 
         ORDER BY highest_confidence_score DESC, total_stolen_repos DESC, first_detected_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        scammers: result.rows.map(row => this.mapRowToRecord(row)),
        total,
      };
    } finally {
      client.release();
    }
  }

  async getScammerWithRepos(username: string): Promise<ScammerWithRepos | null> {
    const client = await pool.connect();
    
    try {
      const scammer = await this.findByUsername(username);
      if (!scammer) {
        return null;
      }

      // Get all matches for this scammer's repos
      const result = await client.query(`
        SELECT 
          r.full_name,
          r.stars,
          r.github_created_at,
          m.id as match_id,
          m.confidence_score,
          m.matching_commits_count,
          m.repo1_id,
          m.repo2_id
        FROM matches m
        JOIN repositories r ON (r.id = m.repo1_id OR r.id = m.repo2_id)
        WHERE (r.owner = $1 OR EXISTS (
          SELECT 1 FROM repositories r2 
          WHERE (r2.id = m.repo1_id OR r2.id = m.repo2_id)
          AND r2.owner = $1
        ))
        AND m.confidence_score >= 50
        ORDER BY m.confidence_score DESC
      `, [username]);

      const stolenRepos = result.rows.map(row => ({
        fullName: row.full_name,
        stars: row.stars,
        createdAt: new Date(row.github_created_at),
        matchId: row.match_id,
        confidenceScore: row.confidence_score,
        matchingCommits: row.matching_commits_count,
      }));

      return {
        ...scammer,
        stolenRepos,
      };
    } finally {
      client.release();
    }
  }

  async updateStats(username: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Count stolen repos and get highest confidence score
      const statsResult = await client.query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN r.owner = $1 THEN r.id END) as stolen_repos,
          COUNT(DISTINCT m.id) as total_matches,
          MAX(m.confidence_score) as max_confidence
        FROM matches m
        JOIN repositories r ON (r.id = m.repo1_id OR r.id = m.repo2_id)
        WHERE (r.owner = $1 OR EXISTS (
          SELECT 1 FROM repositories r2 
          WHERE (r2.id = m.repo1_id OR r2.id = m.repo2_id)
          AND r2.owner = $1
        ))
        AND m.confidence_score >= 50
      `, [username]);

      const stats = statsResult.rows[0];

      await client.query(`
        UPDATE blacklist
        SET 
          total_stolen_repos = $1,
          total_matches = $2,
          highest_confidence_score = COALESCE($3, 0),
          last_updated_at = NOW()
        WHERE github_username = $4
      `, [
        parseInt(stats.stolen_repos || '0', 10),
        parseInt(stats.total_matches || '0', 10),
        parseInt(stats.max_confidence || '0', 10),
        username,
      ]);
    } finally {
      client.release();
    }
  }

  async getStats(): Promise<{
    totalScammers: number;
    totalStolenRepos: number;
    totalMatches: number;
  }> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_scammers,
          SUM(total_stolen_repos) as total_stolen_repos,
          SUM(total_matches) as total_matches
        FROM blacklist
        WHERE status = 'confirmed'
      `);

      const row = result.rows[0];
      return {
        totalScammers: parseInt(row.total_scammers || '0', 10),
        totalStolenRepos: parseInt(row.total_stolen_repos || '0', 10),
        totalMatches: parseInt(row.total_matches || '0', 10),
      };
    } finally {
      client.release();
    }
  }

  async updateAccountStatus(username: string, accountStatus: 'active' | 'eliminated' | 'unknown'): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query(`
        UPDATE blacklist
        SET 
          account_status = $1,
          account_checked_at = NOW()
        WHERE github_username = $2
      `, [accountStatus, username]);
    } finally {
      client.release();
    }
  }

  async checkAndUpdateAccountStatus(username: string): Promise<'active' | 'eliminated' | 'unknown'> {
    try {
      // Check if GitHub account exists by making a simple API call
      const response = await fetch(`https://api.github.com/users/${username}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RepoThief-Hunter',
          ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {}),
        },
      });

      let status: 'active' | 'eliminated' | 'unknown';
      
      if (response.status === 404) {
        status = 'eliminated';
      } else if (response.ok) {
        status = 'active';
      } else {
        status = 'unknown';
      }

      await this.updateAccountStatus(username, status);
      return status;
    } catch (error) {
      console.error(`Error checking account status for ${username}:`, error);
      return 'unknown';
    }
  }

  async refreshAllAccountStatuses(): Promise<{ checked: number; eliminated: number; active: number }> {
    const { scammers } = await this.findAll({ limit: 1000 });
    let eliminated = 0;
    let active = 0;

    for (const scammer of scammers) {
      const status = await this.checkAndUpdateAccountStatus(scammer.githubUsername);
      if (status === 'eliminated') eliminated++;
      else if (status === 'active') active++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { checked: scammers.length, eliminated, active };
  }

  private mapRowToRecord(row: any): BlacklistRecord {
    return {
      id: row.id,
      githubUsername: row.github_username,
      githubUserId: row.github_user_id,
      status: row.status,
      accountStatus: row.account_status || 'unknown',
      totalStolenRepos: row.total_stolen_repos,
      totalMatches: row.total_matches,
      highestConfidenceScore: row.highest_confidence_score,
      firstDetectedAt: new Date(row.first_detected_at),
      lastUpdatedAt: new Date(row.last_updated_at),
      accountCheckedAt: row.account_checked_at ? new Date(row.account_checked_at) : null,
      evidenceSummary: row.evidence_summary,
      createdAt: new Date(row.created_at),
    };
  }
}

