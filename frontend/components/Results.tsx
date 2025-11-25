'use client';

interface ResultsProps {
  results: any;
}

export default function Results({ results }: ResultsProps) {
  if (!results) return null;

  if (results.type === 'repo') {
    const { repository, matches } = results;
    const hasMatches = matches && matches.length > 0;
    const highConfidenceMatch = matches?.find((m: any) => m.confidenceScore >= 70);

    return (
      <div className="mt-12 bg-base-200 rounded-xl border border-base-300 p-8 shadow-2xl animate-fade-in">
        <h3 className="text-2xl font-bold text-base-content mb-6 flex items-center">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Scan Results</span>
        </h3>

        <div className="mb-6 p-6 bg-base-100 rounded-lg border border-base-300">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xl font-bold text-base-content mb-1">{repository.fullName}</h4>
              <p className="text-base-content/70 text-sm font-medium">
                Created {new Date(repository.githubCreatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </p>
            </div>
            <div className="text-right bg-base-200 px-4 py-2 rounded-lg border border-base-300">
              <div className="text-2xl font-bold text-base-content">{repository.stars.toLocaleString()}</div>
              <div className="text-xs font-medium text-base-content/60 uppercase tracking-wider">stars</div>
            </div>
          </div>
        </div>

        {/* Status */}
        {hasMatches && highConfidenceMatch ? (
          <div className="mb-6 p-6 bg-error/10 border-2 border-error/50 rounded-lg">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-3xl">🚨</span>
              <div>
                <h4 className="text-xl font-bold text-error-content">SUSPICIOUS REPOSITORY DETECTED</h4>
                <p className="text-error-content/80">This repository matches stolen content</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-base-100 rounded">
                <span className="text-base-content/70">Confidence Score</span>
                <span className="text-2xl font-bold text-error">
                  {highConfidenceMatch.confidenceScore}/100
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-base-100 rounded">
                <span className="text-base-content/70">Confidence Level</span>
                <span className="text-lg font-semibold text-error">
                  {highConfidenceMatch.confidenceLevel}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-base-100 rounded">
                <span className="text-base-content/70">Matching Commits</span>
                <span className="text-lg font-semibold text-base-content">
                  {highConfidenceMatch.matchingCommits}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-base-100 rounded">
                <span className="text-base-content/70">Match Percentage</span>
                <span className="text-lg font-semibold text-base-content">
                  {highConfidenceMatch.matchPercentage.toFixed(2)}%
                </span>
              </div>
            </div>

            {matches.length > 0 && (
              <div className="mt-4">
                <h5 className="text-sm font-semibold text-base-content/70 mb-2">Matched Repositories:</h5>
                <div className="space-y-2">
                  {matches.map((match: any, idx: number) => (
                    <div key={idx} className="p-3 bg-base-100 rounded text-sm">
                      <div className="text-base-content font-medium">Match #{match.id}</div>
                      <div className="text-primary">
                        Score: {match.confidenceScore}/100 ({match.confidenceLevel})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 p-6 bg-success/10 border-2 border-success/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">✅</span>
              <div>
                <h4 className="text-xl font-bold text-success-content">REPOSITORY APPEARS LEGITIMATE</h4>
                <p className="text-success-content/80">
                  No suspicious matches found. This repository appears to be original.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Suspicion Score */}
        {repository.suspicionScore > 0 && (
          <div className="p-4 bg-warning/10 border border-warning/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-warning-content">Suspicion Score</span>
              <span className="text-xl font-bold text-warning">
                {repository.suspicionScore}/100
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (results.type === 'profile') {
    return (
      <div className="mt-8 bg-base-200 backdrop-blur-sm rounded-xl border border-base-300 p-8">
        <h3 className="text-2xl font-bold text-base-content mb-6">Profile Scan Results</h3>
        
        <div className="bg-base-100 rounded-lg p-4 border border-base-300 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-lg font-semibold text-base-content">Profile: @{results.username}</p>
            {results.status === 'processing' && (
              <div className="flex items-center gap-2 text-primary">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Scanning...</span>
              </div>
            )}
          </div>
          
          {results.progress && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-primary mb-2">
                <span>Progress: {results.progress.scannedRepos}/{results.progress.totalRepos} repos</span>
                <span>{results.progress.percentage}%</span>
              </div>
              <div className="w-full bg-base-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${results.progress.percentage}%` }}
                ></div>
              </div>
                {(results.progress.pendingRepos > 0 || results.progress.processingRepos > 0) && (
                  <p className="text-xs text-primary/70 mt-1">
                    {results.progress.processingRepos > 0 
                      ? `${results.progress.processingRepos} repos scanning GitHub...` 
                      : `${results.progress.pendingRepos} repos remaining`}
                  </p>
                )}
                {results.message && (
                  <p className="text-xs text-info mt-2 italic">{results.message}</p>
                )}
            </div>
          )}

          {results.results && results.status === 'completed' && (
            <>
              <p className="text-base-content/70 mt-2">
                Profile Score: <span className={`font-bold ${results.results.profileScore >= 50 ? 'text-error' : 'text-success'}`}>
                  {results.results.profileScore}/100
                </span>
              </p>
              <p className="text-base-content/60 text-sm mt-1">
                Total Matches: {results.results.totalMatches} | 
                Suspicious Repos: {results.results.suspiciousRepos}
              </p>
            </>
          )}
        </div>

        {results.status === 'processing' && (
          <div className="bg-info/10 border border-info/50 rounded-lg p-4 text-info-content mb-4">
            <p className="font-semibold mb-2">⏳ {results.message}</p>
            <p className="text-sm">This may take a few minutes depending on the number of repositories.</p>
          </div>
        )}

        {results.status === 'completed' && results.results && (
          <>
            {results.results.suspiciousRepos > 0 && results.results.suspiciousReposList && (
              <div className="bg-error/10 border border-error/30 rounded-lg p-6 text-error-content mb-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                  <img src="/criminal-custody-icon.svg" alt="Criminal" className="w-32 h-32 dark:invert" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-error/20 rounded-lg">
                      <img src="/criminal-custody-icon.svg" alt="Criminal" className="w-8 h-8 dark:invert" />
                    </div>
                    <p className="font-bold text-xl text-error">Suspicious Activity Detected!</p>
                  </div>
                  <p className="text-sm text-base-content/70 mb-3">
                    These repos match commits from other repositories across GitHub (not just within this profile)
                  </p>
                  <ul className="list-disc list-inside space-y-2">
                  {results.results.suspiciousReposList.map((repo: any, index: number) => (
                    <li key={index} className="text-base-content/80">
                      <a 
                        href={`https://github.com/${repo.fullName}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary hover:underline font-semibold"
                      >
                        {repo.fullName}
                      </a>
                      {' '}
                      <span className="text-sm">
                        (Confidence: {repo.highestConfidence}/100, {repo.matches} match{repo.matches !== 1 ? 'es' : ''})
                      </span>
                      {repo.matchedAgainst && repo.matchedAgainst !== 'Unknown' && (
                        <div className="ml-6 mt-1 text-xs text-base-content/60">
                          Matched against: <a 
                            href={`https://github.com/${repo.matchedAgainst}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {repo.matchedAgainst}
                          </a>
                        </div>
                      )}
                      {repo.allMatches && repo.allMatches.length > 1 && (
                        <div className="ml-6 mt-1 text-xs text-base-content/60">
                          Also matches: {repo.allMatches.slice(1).map((m: any, i: number) => (
                            <span key={i}>
                              <a 
                                href={`https://github.com/${m.matchedRepo}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {m.matchedRepo}
                              </a>
                              {i < repo.allMatches.length - 2 && ', '}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                  </ul>
                </div>
              </div>
            )}
            {results.results.suspiciousRepos === 0 && (
              <div className="bg-success/10 border border-success/50 rounded-lg p-4 text-success-content">
                <p className="font-bold text-xl mb-2">✅ Profile appears legitimate.</p>
                <p>No high-confidence suspicious activity found for this profile.</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}

