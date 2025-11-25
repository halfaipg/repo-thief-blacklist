# Repo Thief Hunter

A community-driven service that identifies and exposes fake GitHub profiles that steal repositories by rewriting commit history.

## Features

- **Commit Message Matching**: Detects stolen repos by matching commit messages and timestamps with different authors
- **GitHub-Wide Scanning**: Searches all of GitHub for matching repositories, not just local database
- **Automated Discovery**: Finds suspicious repos in the wild through multiple discovery methods
- **Automated Scanning**: Scans repositories and indexes commits for matching
- **Confidence Scoring**: Calculates suspicion scores based on multiple factors
- **Web Frontend**: Beautiful, modern UI for scanning repos and profiles (Next.js + DaisyUI)
- **Blacklist/Wall of Shame**: Public list of confirmed scammers
- **Community Reports**: Web API for submitting reports of suspected stolen repos
- **Job Queue**: Background processing for scanning repositories
- **Profile Analysis**: Identifies suspicious GitHub profiles for scanning

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Create .env file in the root directory
cat > .env << EOF
GITHUB_TOKEN=your_github_token_here
DATABASE_URL=postgresql://user:password@localhost:5432/repo_thief_hunter
PORT=4000
EOF
# Edit .env and add your GitHub token and database URL
```

3. Set up the database:
```bash
# Make sure PostgreSQL is running
npm run db:migrate
```

4. Start the backend server:
```bash
npm run dev
```

5. Start the frontend (in a separate terminal):
```bash
cd frontend
npm install
npm run dev
# Frontend will be available at http://localhost:3000
```

## Usage

### Scan a repository:
```bash
npm run scanner scan <owner> <repo>
# Example: npm run scanner scan fumiya-kume ai-in-japan
```

### Scan from URL:
```bash
npm run scanner scan-url https://github.com/owner/repo
```

### Run matching algorithm:
```bash
npm run scanner match
```

## Discovery (Finding Repos in the Wild)

The system can automatically discover suspicious repositories through multiple methods:

### Run All Discovery Methods:
```bash
npm run discovery run
```

### Discover Popular Repos:
Scans popular repositories (100+ stars) across multiple languages:
```bash
npm run discovery popular
```

### Discover Trending Repos:
Finds recently created repos with high activity:
```bash
npm run discovery trending
```

### Run Matching on Indexed Repos:
Finds matches between already-indexed repositories:
```bash
npm run discovery match
```

### Scan a Suspicious Profile:
Analyzes a GitHub profile and scans all their repos if suspicious:
```bash
npm run discovery profile <username>
```

### Continuous Discovery:
Runs discovery automatically every N minutes:
```bash
npm run discovery continuous [minutes]
# Example: npm run discovery continuous 60  # Every hour
```

## Discovery Methods

1. **Popular Repos Discovery**: Searches for popular repos (100+ stars) in various languages and queues them for scanning
2. **Trending Repos Discovery**: Finds recently created repos with high activity
3. **Commit Matching Discovery**: Uses indexed commits to find repos with duplicate commit patterns
4. **Profile Pattern Detection**: Identifies suspicious profiles (many repos created quickly, high repo count with low account age) and scans all their repos
5. **Continuous Matching**: Periodically runs matching algorithm on all indexed repos to find new matches

## API Endpoints

### Submit a Report
```bash
POST /api/reports
{
  "originalRepoUrl": "https://github.com/original/repo",
  "suspectedFakeRepoUrl": "https://github.com/fake/repo",
  "reporterEmail": "email@example.com",
  "reporterName": "John Doe",
  "evidence": "Optional evidence text"
}
```

### Check Repository
```bash
GET /api/repos/:owner/:repo
```

### Get Matches
```bash
GET /api/matches?limit=100&minScore=50
```

### Queue Scan
```bash
POST /api/scan
{
  "owner": "owner",
  "repo": "repo"
}
# OR
{
  "repoUrl": "https://github.com/owner/repo"
}
```

## How It Works

1. **Indexing**: Fetches commits from GitHub API and stores them in the database
2. **Matching**: Finds commits with matching messages and timestamps but different authors
3. **Scoring**: Calculates confidence scores based on:
   - Number of matching commits
   - Match percentage
   - Temporal anomalies (commits predating repo creation)
   - Author patterns
4. **Verification**: Flags high-confidence matches for review

## Detection Method

The system detects stolen repos by matching commit messages and timestamps. When scammers use `git filter-branch`:
- Commit messages stay the same
- Timestamps stay the same
- Authors change (which changes commit hashes)
- We can detect by matching (message, timestamp) pairs with different authors

## License

MIT


