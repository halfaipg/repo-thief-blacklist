import { startServer } from './api/server';
import { ScanQueue } from './queue/scan-queue';

// Start the web server
startServer();

// Initialize scan queue worker
const scanQueue = new ScanQueue();
console.log('Scan queue worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await scanQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await scanQueue.close();
  process.exit(0);
});

