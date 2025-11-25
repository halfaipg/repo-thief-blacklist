import { pool } from '../db/schema';
import { ScanQueue } from '../queue/scan-queue';

export interface ReportData {
  originalRepoUrl: string;
  suspectedFakeRepoUrl: string;
  reporterEmail?: string;
  reporterName?: string;
  evidence?: string;
}

export class ReportsService {
  private scanQueue: ScanQueue;

  constructor() {
    this.scanQueue = new ScanQueue();
  }

  async createReport(data: ReportData): Promise<number> {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        INSERT INTO reports (
          original_repo_url, suspected_fake_repo_url,
          reporter_email, reporter_name, evidence, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        data.originalRepoUrl,
        data.suspectedFakeRepoUrl,
        data.reporterEmail || null,
        data.reporterName || null,
        data.evidence || null,
        'pending',
      ]);

      const reportId = result.rows[0].id;

      // Queue both repos for scanning with high priority
      await this.scanQueue.addScanJobFromUrl(data.originalRepoUrl, 100);
      await this.scanQueue.addScanJobFromUrl(data.suspectedFakeRepoUrl, 100);

      return reportId;
    } finally {
      client.release();
    }
  }

  async getReport(id: number): Promise<any> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT * FROM reports WHERE id = $1',
        [id]
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async listReports(limit: number = 100): Promise<any[]> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT * FROM reports ORDER BY created_at DESC LIMIT $1',
        [limit]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }
}

