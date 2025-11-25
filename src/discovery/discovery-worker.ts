import { PopularReposDiscovery } from './popular-repos';
import { CommitMatcherDiscovery } from './commit-matcher-discovery';
import { ProfileScanner } from './profile-scanner';
import { CommitMatcher } from '../scanner/commit-matcher';

export class DiscoveryWorker {
  private popularReposDiscovery: PopularReposDiscovery;
  private commitMatcherDiscovery: CommitMatcherDiscovery;
  private profileScanner: ProfileScanner;
  private matcher: CommitMatcher;
  private useQueue: boolean;

  constructor(useQueue: boolean = false) {
    this.useQueue = useQueue;
    this.popularReposDiscovery = new PopularReposDiscovery(useQueue);
    this.commitMatcherDiscovery = new CommitMatcherDiscovery();
    this.profileScanner = new ProfileScanner(useQueue);
    this.matcher = new CommitMatcher();
  }

  /**
   * Run all discovery methods
   */
  async runDiscovery(options: {
    discoverPopular?: boolean;
    discoverTrending?: boolean;
    runMatching?: boolean;
    scanSuspiciousProfiles?: string[];
  } = {}): Promise<void> {
    const {
      discoverPopular = true,
      discoverTrending = true,
      runMatching = true,
      scanSuspiciousProfiles = [],
    } = options;

    console.log('\n' + '='.repeat(60));
    console.log('🔍 REPOSITORY DISCOVERY WORKER');
    console.log('='.repeat(60) + '\n');

    // 1. Discover popular repos
    if (discoverPopular) {
      await this.popularReposDiscovery.discoverPopularRepos({
        minStars: 100,
        languages: ['javascript', 'typescript', 'python', 'go', 'rust'],
        limit: 50,
      });
    }

    // 2. Discover trending repos
    if (discoverTrending) {
      await this.popularReposDiscovery.discoverTrendingRepos(30);
    }

    // 3. Run matching on all indexed repos
    if (runMatching) {
      console.log('\n=== Running Matching Algorithm ===\n');
      await this.matcher.findMatchesForAllRepos();
    }

    // 4. Scan suspicious profiles
    for (const username of scanSuspiciousProfiles) {
      await this.profileScanner.scanSuspiciousProfile(username);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DISCOVERY COMPLETE');
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Continuous discovery - runs periodically
   */
  async startContinuousDiscovery(intervalMinutes: number = 60): Promise<void> {
    console.log(`\n🚀 Starting continuous discovery (every ${intervalMinutes} minutes)\n`);

    // Run immediately
    await this.runDiscovery();

    // Then run on interval
    setInterval(async () => {
      await this.runDiscovery({
        discoverPopular: true,
        discoverTrending: true,
        runMatching: true,
      });
    }, intervalMinutes * 60 * 1000);
  }
}

