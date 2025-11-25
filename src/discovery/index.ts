import { DiscoveryWorker } from './discovery-worker';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const worker = new DiscoveryWorker();

  if (command === 'run') {
    await worker.runDiscovery();
  } else if (command === 'popular') {
    await worker.runDiscovery({ discoverPopular: true, discoverTrending: false, runMatching: false });
  } else if (command === 'trending') {
    await worker.runDiscovery({ discoverPopular: false, discoverTrending: true, runMatching: false });
  } else if (command === 'match') {
    await worker.runDiscovery({ discoverPopular: false, discoverTrending: false, runMatching: true });
  } else if (command === 'profile' && args[1]) {
    await worker.runDiscovery({
      discoverPopular: false,
      discoverTrending: false,
      runMatching: false,
      scanSuspiciousProfiles: [args[1]],
    });
  } else if (command === 'continuous') {
    const interval = parseInt(args[1] || '60', 10);
    await worker.startContinuousDiscovery(interval);
  } else {
    console.log(`
Usage:
  npm run discovery run                    - Run all discovery methods
  npm run discovery popular                - Discover popular repos only
  npm run discovery trending               - Discover trending repos only
  npm run discovery match                 - Run matching algorithm only
  npm run discovery profile <username>    - Scan a specific profile
  npm run discovery continuous [minutes]  - Run continuous discovery (default: 60 min)
    `);
    process.exit(1);
  }
}

main().catch(console.error);

