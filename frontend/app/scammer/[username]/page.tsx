'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

interface StolenRepo {
  fullName: string;
  stars: number;
  createdAt: string;
  matchId: number;
  confidenceScore: number;
  matchingCommits: number;
}

interface ScammerDetails {
  id: number;
  githubUsername: string;
  githubUserId: number | null;
  status: string;
  totalStolenRepos: number;
  totalMatches: number;
  highestConfidenceScore: number;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  evidenceSummary: any;
  stolenRepos: StolenRepo[];
}

export default function ScammerDetailsPage({ params }: { params: { username: string } }) {
  const [scammer, setScammer] = useState<ScammerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchScammerDetails();
  }, [params.username]);

  const fetchScammerDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/blacklist/${params.username}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Scammer not found');
        } else {
          throw new Error('Failed to fetch scammer details');
        }
        return;
      }
      const data = await response.json();
      setScammer(data);
    } catch (err: any) {
      console.error('Error fetching scammer details:', err);
      setError(err.message || 'Failed to load scammer details');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'text-error';
    if (score >= 70) return 'text-warning';
    return 'text-info';
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 85) return 'VERY HIGH';
    if (score >= 70) return 'HIGH';
    return 'MEDIUM';
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      {/* Header */}
      <header className="relative z-10 border-b border-base-300 bg-base-100/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 relative">
                  <img src="/thief-icon.svg" alt="RepoThief Logo" className="w-full h-full object-contain brightness-0 dark:invert" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-base-content tracking-tight">RepoThief</h1>
                </div>
              </Link>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/blacklist" className="text-sm font-medium text-base-content/60 hover:text-base-content transition-colors">
                Blacklist
              </Link>
              <ThemeToggle />
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-base-content/60 hover:text-base-content transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            <p className="text-base-content/60 mt-6 text-lg">Loading scammer details...</p>
          </div>
        ) : error ? (
          <div className="max-w-2xl mx-auto text-center py-20">
            <div className="bg-error/10 border-2 border-error/30 rounded-xl p-8">
              <div className="text-error text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-error mb-2">{error}</h2>
              <Link href="/blacklist" className="btn btn-outline btn-primary mt-6">
                Back to Blacklist
              </Link>
            </div>
          </div>
        ) : scammer ? (
          <>
            {/* Scammer Header */}
            <div className="max-w-5xl mx-auto mb-8">
              <Link href="/blacklist" className="text-primary hover:text-primary-focus mb-4 inline-flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Blacklist
              </Link>

              <div className="bg-base-200 rounded-xl border-2 border-error/50 p-8 mt-4 relative overflow-hidden">
                {/* Large background mugshot */}
                <div className="absolute top-0 right-0 opacity-[0.07] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                  <div className="relative w-[250px] h-[250px]">
                    <img 
                      src={`https://github.com/${scammer.githubUsername}.png?size=400`}
                      alt=""
                      className="w-full h-full rounded-2xl object-cover"
                    />
                    {/* Prison bars overlay */}
                    <div className="absolute inset-0 flex justify-around">
                      <div className="w-3 bg-gray-900 rounded-full"></div>
                      <div className="w-3 bg-gray-900 rounded-full"></div>
                      <div className="w-3 bg-gray-900 rounded-full"></div>
                      <div className="w-3 bg-gray-900 rounded-full"></div>
                      <div className="w-3 bg-gray-900 rounded-full"></div>
                      <div className="w-3 bg-gray-900 rounded-full"></div>
                    </div>
                    <div className="absolute top-0 left-0 right-0 h-4 bg-gray-900 rounded-t-2xl"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-gray-900 rounded-b-2xl"></div>
                  </div>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      {/* Profile pic behind bars */}
                      <div className="relative w-20 h-20">
                        {/* GitHub Avatar */}
                        <img 
                          src={`https://github.com/${scammer.githubUsername}.png?size=200`}
                          alt={`${scammer.githubUsername}'s avatar`}
                          className="w-full h-full rounded-lg object-cover border-2 border-error/50"
                          onError={(e) => {
                            // Fallback to generic icon if avatar fails
                            (e.target as HTMLImageElement).src = '/criminal-custody-icon.svg';
                          }}
                        />
                        {/* Prison bars overlay */}
                        <div className="absolute inset-0 flex justify-around pointer-events-none">
                          <div className="w-1.5 bg-gray-800/80 rounded-full shadow-lg"></div>
                          <div className="w-1.5 bg-gray-800/80 rounded-full shadow-lg"></div>
                          <div className="w-1.5 bg-gray-800/80 rounded-full shadow-lg"></div>
                          <div className="w-1.5 bg-gray-800/80 rounded-full shadow-lg"></div>
                          <div className="w-1.5 bg-gray-800/80 rounded-full shadow-lg"></div>
                        </div>
                        {/* Horizontal bar at top */}
                        <div className="absolute top-0 left-0 right-0 h-2 bg-gray-800/80 rounded-t-lg shadow-lg"></div>
                        {/* Horizontal bar at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-800/80 rounded-b-lg shadow-lg"></div>
                      </div>
                      <div>
                        <h1 className="text-4xl font-bold text-base-content mb-2">@{scammer.githubUsername}</h1>
                        <a
                          href={`https://github.com/${scammer.githubUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary-focus text-sm font-medium flex items-center gap-2"
                        >
                          View GitHub Profile
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                    <div className={`text-right ${getConfidenceColor(scammer.highestConfidenceScore)}`}>
                      <div className="text-5xl font-bold">{scammer.highestConfidenceScore}</div>
                      <div className="text-xs font-semibold uppercase tracking-wider">{getConfidenceBadge(scammer.highestConfidenceScore)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-base-300 rounded-lg p-4">
                      <div className="text-sm text-base-content/60 mb-1">Stolen Repos</div>
                      <div className="text-3xl font-bold text-error">{scammer.totalStolenRepos}</div>
                    </div>
                    <div className="bg-base-300 rounded-lg p-4">
                      <div className="text-sm text-base-content/60 mb-1">Total Matches</div>
                      <div className="text-3xl font-bold text-base-content">{scammer.totalMatches}</div>
                    </div>
                    <div className="bg-base-300 rounded-lg p-4">
                      <div className="text-sm text-base-content/60 mb-1">First Detected</div>
                      <div className="text-lg font-semibold text-base-content">
                        {new Date(scammer.firstDetectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="bg-base-300 rounded-lg p-4">
                      <div className="text-sm text-base-content/60 mb-1">Status</div>
                      <div className="text-lg font-semibold text-error uppercase">{scammer.status}</div>
                    </div>
                  </div>

                  <div className="bg-error/10 border border-error/30 rounded-lg p-4">
                    <p className="text-sm text-error-content">
                      <span className="font-bold">⚠️ Warning:</span> This profile has been identified as engaging in repository theft through commit history rewriting.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stolen Repositories List */}
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl font-bold text-base-content mb-6 flex items-center gap-3">
                <span>Stolen Repositories</span>
                <span className="text-error">({scammer.stolenRepos.length})</span>
              </h2>

              {scammer.stolenRepos.length === 0 ? (
                <div className="bg-base-200 rounded-xl border border-base-300 p-12 text-center">
                  <p className="text-base-content/70 text-lg">No stolen repositories found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scammer.stolenRepos.map((repo, index) => (
                    <div
                      key={`${repo.matchId}-${index}`}
                      className="bg-base-200 rounded-xl border border-base-300 p-6 hover:border-primary transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <a
                              href={`https://github.com/${repo.fullName}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-2xl font-bold text-primary hover:text-primary-focus transition-colors"
                            >
                              {repo.fullName}
                            </a>
                            <div className="flex items-center gap-1 text-base-content/60">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="font-medium">{repo.stars.toLocaleString()}</span>
                            </div>
                          </div>
                          <p className="text-base-content/60 text-sm">
                            Repository created: {new Date(repo.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className={`text-right ${getConfidenceColor(repo.confidenceScore)}`}>
                          <div className="text-3xl font-bold">{repo.confidenceScore}</div>
                          <div className="text-xs font-semibold uppercase">{getConfidenceBadge(repo.confidenceScore)}</div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-base-300">
                        <div className="bg-base-300 rounded-lg p-4">
                          <div className="text-xs text-base-content/60 mb-1 uppercase tracking-wider">Matching Commits</div>
                          <div className="text-2xl font-bold text-base-content">{repo.matchingCommits}</div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-base-300">
                        <div className="flex items-center gap-2 text-error-content text-sm">
                          <svg className="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="font-medium">Evidence of commit history manipulation detected</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

