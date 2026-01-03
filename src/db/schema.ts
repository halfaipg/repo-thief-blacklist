import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export { pool };

export async function createSchema(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Repositories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS repositories (
        id SERIAL PRIMARY KEY,
        github_id BIGINT UNIQUE,
        owner VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) UNIQUE NOT NULL,
        github_created_at TIMESTAMP NOT NULL,
        first_commit_date TIMESTAMP,
        updated_at TIMESTAMP NOT NULL,
        pushed_at TIMESTAMP,
        stars INTEGER DEFAULT 0,
        forks INTEGER DEFAULT 0,
        description TEXT,
        topics TEXT[],
        scan_status VARCHAR(50) DEFAULT 'pending',
        suspicion_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at_db TIMESTAMP DEFAULT NOW()
      )
    `);

    // Commits table
    await client.query(`
      CREATE TABLE IF NOT EXISTS commits (
        id SERIAL PRIMARY KEY,
        repo_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
        commit_sha VARCHAR(40) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        author_email VARCHAR(255) NOT NULL,
        commit_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(repo_id, commit_sha)
      )
    `);

    // Create indexes for commit matching
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commit_match ON commits(message, timestamp)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commit_repo ON commits(repo_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commit_timestamp ON commits(timestamp)
    `);

    // Matches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        repo1_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
        repo2_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
        matching_commits_count INTEGER DEFAULT 0,
        match_percentage DECIMAL(5,2) DEFAULT 0,
        confidence_score INTEGER DEFAULT 0,
        confidence_level VARCHAR(20) DEFAULT 'VERY_LOW',
        commits_predate_repo BOOLEAN DEFAULT FALSE,
        statistics JSONB,
        evidence JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(repo1_id, repo2_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_repo1 ON matches(repo1_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_repo2 ON matches(repo2_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_confidence ON matches(confidence_score DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)
    `);

    // Community reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        original_repo_url VARCHAR(500) NOT NULL,
        suspected_fake_repo_url VARCHAR(500) NOT NULL,
        reporter_email VARCHAR(255),
        reporter_name VARCHAR(255),
        evidence TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Blacklist table (scammers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS blacklist (
        id SERIAL PRIMARY KEY,
        github_username VARCHAR(255) UNIQUE NOT NULL,
        github_user_id BIGINT,
        status VARCHAR(50) DEFAULT 'confirmed',
        account_status VARCHAR(50) DEFAULT 'active',
        total_stolen_repos INTEGER DEFAULT 0,
        total_matches INTEGER DEFAULT 0,
        highest_confidence_score INTEGER DEFAULT 0,
        first_detected_at TIMESTAMP DEFAULT NOW(),
        last_updated_at TIMESTAMP DEFAULT NOW(),
        account_checked_at TIMESTAMP,
        evidence_summary JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add account_status column if it doesn't exist (for existing DBs)
    await client.query(`
      ALTER TABLE blacklist 
      ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active'
    `);

    await client.query(`
      ALTER TABLE blacklist 
      ADD COLUMN IF NOT EXISTS account_checked_at TIMESTAMP
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_blacklist_username ON blacklist(github_username)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_blacklist_status ON blacklist(status)
    `);

    // Link matches to blacklist
    await client.query(`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS blacklist_id INTEGER REFERENCES blacklist(id) ON DELETE SET NULL
    `);

    await client.query('COMMIT');
    console.log('Database schema created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function dropSchema(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('DROP TABLE IF EXISTS matches CASCADE');
    await client.query('DROP TABLE IF EXISTS commits CASCADE');
    await client.query('DROP TABLE IF EXISTS reports CASCADE');
    await client.query('DROP TABLE IF EXISTS repositories CASCADE');
    await client.query('COMMIT');
    console.log('Database schema dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error dropping schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

