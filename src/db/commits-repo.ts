import { pool } from './schema';
import { GitHubCommit } from '../api/github-client';

export interface CommitRecord {
  id: number;
  repoId: number;
  commitSha: string;
  message: string;
  timestamp: Date;
  authorName: string;
  authorEmail: string;
  commitUrl: string | null;
  createdAt: Date;
}

export class CommitsRepository {
  async bulkInsert(repoId: number, commits: GitHubCommit[]): Promise<void> {
    if (commits.length === 0) return;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete existing commits for this repo
      await client.query('DELETE FROM commits WHERE repo_id = $1', [repoId]);

      // Insert new commits in batches
      const batchSize = 1000;
      for (let i = 0; i < commits.length; i += batchSize) {
        const batch = commits.slice(i, i + batchSize);
        const values: any[] = [];
        const placeholders: string[] = [];

        batch.forEach((commit, idx) => {
          const base = idx * 7;
          placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
          values.push(
            repoId,
            commit.sha,
            commit.message,
            commit.timestamp,
            commit.authorName,
            commit.authorEmail,
            commit.url
          );
        });

        await client.query(`
          INSERT INTO commits (repo_id, commit_sha, message, timestamp, author_name, author_email, commit_url)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (repo_id, commit_sha) DO NOTHING
        `, values);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findMatchingCommits(
    message: string,
    timestamp: Date,
    excludeRepoId?: number
  ): Promise<CommitRecord[]> {
    const client = await pool.connect();
    
    try {
      // Normalize timestamp to minute precision for matching
      const normalizedTimestamp = new Date(timestamp);
      normalizedTimestamp.setSeconds(0, 0);

      const result = await client.query(`
        SELECT c.* 
        FROM commits c
        WHERE c.message = $1 
          AND DATE_TRUNC('minute', c.timestamp) = DATE_TRUNC('minute', $2::timestamp)
          ${excludeRepoId ? 'AND c.repo_id != $3' : ''}
        ORDER BY c.timestamp DESC
      `, excludeRepoId ? [message, normalizedTimestamp, excludeRepoId] : [message, normalizedTimestamp]);

      return result.rows.map(row => this.mapRowToRecord(row));
    } finally {
      client.release();
    }
  }

  async findByRepoId(repoId: number): Promise<CommitRecord[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM commits WHERE repo_id = $1 ORDER BY timestamp ASC',
        [repoId]
      );

      return result.rows.map(row => this.mapRowToRecord(row));
    } finally {
      client.release();
    }
  }

  async countByRepoId(repoId: number): Promise<number> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM commits WHERE repo_id = $1',
        [repoId]
      );

      return parseInt(result.rows[0].count, 10);
    } finally {
      client.release();
    }
  }

  async findDuplicateMessageTimestampPairs(): Promise<Array<{ message: string; timestamp: Date; repoIds: number[] }>> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          message,
          DATE_TRUNC('minute', timestamp) as timestamp,
          ARRAY_AGG(DISTINCT repo_id) as repo_ids
        FROM commits
        GROUP BY message, DATE_TRUNC('minute', timestamp)
        HAVING COUNT(DISTINCT repo_id) > 1
        ORDER BY COUNT(DISTINCT repo_id) DESC
      `);

      return result.rows.map(row => ({
        message: row.message,
        timestamp: new Date(row.timestamp),
        repoIds: row.repo_ids,
      }));
    } finally {
      client.release();
    }
  }

  private mapRowToRecord(row: any): CommitRecord {
    return {
      id: row.id,
      repoId: row.repo_id,
      commitSha: row.commit_sha,
      message: row.message,
      timestamp: new Date(row.timestamp),
      authorName: row.author_name,
      authorEmail: row.author_email,
      commitUrl: row.commit_url,
      createdAt: new Date(row.created_at),
    };
  }
}

