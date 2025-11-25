import { Queue, Worker, Job } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { RepoScanner } from '../scanner/repo-scanner';
import { RepositoriesRepository } from '../db/repos-repo';

export interface ScanJobData {
  owner: string;
  repo: string;
  priority?: number;
}

export interface ScanJobResult {
  success: boolean;
  message: string;
  matchesFound?: number;
}

const getRedisConnection = (): RedisOptions | string => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  };
};

const connection: RedisOptions | string = getRedisConnection();

export class ScanQueue {
  private queue: Queue<ScanJobData>;
  private worker: Worker<ScanJobData, ScanJobResult>;
  private scanner: RepoScanner;

  constructor() {
    this.queue = new Queue<ScanJobData>('repo-scan', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    this.scanner = new RepoScanner();

    this.worker = new Worker<ScanJobData, ScanJobResult>(
      'repo-scan',
      async (job: Job<ScanJobData>) => {
        const { owner, repo } = job.data;
        console.log(`Processing scan job: ${owner}/${repo}`);

        try {
          await this.scanner.scanRepository(owner, repo);
          return {
            success: true,
            message: `Successfully scanned ${owner}/${repo}`,
          };
        } catch (error: any) {
          console.error(`Error scanning ${owner}/${repo}:`, error.message);
          throw error;
        }
      },
      {
        connection,
        concurrency: 1, // Process one at a time to respect rate limits
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed: ${job.returnvalue.message}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err.message);
    });
  }

  async addScanJob(owner: string, repo: string, priority: number = 0): Promise<void> {
    await this.queue.add(
      'scan-repo',
      { owner, repo, priority },
      {
        priority,
        jobId: `${owner}/${repo}`,
      }
    );
  }

  async addScanJobFromUrl(repoUrl: string, priority: number = 0): Promise<void> {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub URL: ${repoUrl}`);
    }

    const [, owner, repo] = match;
    const repoName = repo.replace(/\.git$/, '');
    await this.addScanJob(owner, repoName, priority);
  }

  async getQueueStats() {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();
    const completed = await this.queue.getCompletedCount();
    const failed = await this.queue.getFailedCount();

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}

