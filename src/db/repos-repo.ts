import { pool } from './schema';
import { GitHubRepository } from '../api/github-client';

export interface RepositoryRecord {
  id: number;
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  githubCreatedAt: Date;
  firstCommitDate: Date | null;
  updatedAt: Date;
  pushedAt: Date | null;
  stars: number;
  forks: number;
  description: string | null;
  topics: string[];
  scanStatus: string;
  suspicionScore: number;
  createdAt: Date;
}

export class RepositoriesRepository {
  async upsert(repo: GitHubRepository, firstCommitDate?: Date): Promise<RepositoryRecord> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO repositories (
          github_id, owner, name, full_name, github_created_at, first_commit_date,
          updated_at, pushed_at, stars, forks, description, topics
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (full_name) 
        DO UPDATE SET
          stars = EXCLUDED.stars,
          forks = EXCLUDED.forks,
          updated_at = EXCLUDED.updated_at,
          pushed_at = EXCLUDED.pushed_at,
          description = EXCLUDED.description,
          topics = EXCLUDED.topics,
          updated_at_db = NOW()
        RETURNING *
      `, [
        repo.id,
        repo.owner,
        repo.name,
        repo.fullName,
        repo.createdAt,
        firstCommitDate || null,
        repo.updatedAt,
        repo.pushedAt,
        repo.stars,
        repo.forks,
        repo.description,
        repo.topics,
      ]);

      return this.mapRowToRecord(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByOwner(owner: string): Promise<RepositoryRecord[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM repositories WHERE owner = $1 ORDER BY created_at DESC',
        [owner]
      );

      return result.rows.map(row => this.mapRowToRecord(row));
    } finally {
      client.release();
    }
  }

  async findByFullName(fullName: string): Promise<RepositoryRecord | null> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM repositories WHERE full_name = $1',
        [fullName]
      );

      return result.rows.length > 0 ? this.mapRowToRecord(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async findById(id: number): Promise<RepositoryRecord | null> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM repositories WHERE id = $1',
        [id]
      );

      return result.rows.length > 0 ? this.mapRowToRecord(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async updateScanStatus(fullName: string, status: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query(
        'UPDATE repositories SET scan_status = $1, updated_at_db = NOW() WHERE full_name = $2',
        [status, fullName]
      );
    } finally {
      client.release();
    }
  }

  async updateSuspicionScore(fullName: string, score: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query(
        'UPDATE repositories SET suspicion_score = $1, updated_at_db = NOW() WHERE full_name = $2',
        [score, fullName]
      );
    } finally {
      client.release();
    }
  }

  async updateFirstCommitDate(fullName: string, firstCommitDate: Date): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query(
        'UPDATE repositories SET first_commit_date = $1, updated_at_db = NOW() WHERE full_name = $2',
        [firstCommitDate, fullName]
      );
    } finally {
      client.release();
    }
  }

  private mapRowToRecord(row: any): RepositoryRecord {
    return {
      id: row.id,
      githubId: row.github_id,
      owner: row.owner,
      name: row.name,
      fullName: row.full_name,
      githubCreatedAt: new Date(row.github_created_at),
      firstCommitDate: row.first_commit_date ? new Date(row.first_commit_date) : null,
      updatedAt: new Date(row.updated_at),
      pushedAt: row.pushed_at ? new Date(row.pushed_at) : null,
      stars: row.stars,
      forks: row.forks,
      description: row.description,
      topics: row.topics || [],
      scanStatus: row.scan_status,
      suspicionScore: row.suspicion_score,
      createdAt: new Date(row.created_at),
    };
  }
}

