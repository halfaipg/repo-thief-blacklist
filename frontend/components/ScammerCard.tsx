'use client';

import Image from 'next/image';
import Link from 'next/link';

interface ScammerCardProps {
  scammer: {
    id: number;
    githubUsername: string;
    totalStolenRepos: number;
    totalMatches: number;
    highestConfidenceScore: number;
    firstDetectedAt: string;
    accountStatus?: 'active' | 'eliminated' | 'unknown';
  };
}

export default function ScammerCard({ scammer }: ScammerCardProps) {
  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'text-error';
    if (score >= 70) return 'text-warning';
    return 'text-warning/70';
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 85) return 'VERY HIGH';
    if (score >= 70) return 'HIGH';
    return 'MEDIUM';
  };

  return (
    <Link href={`/scammer/${scammer.githubUsername}`} className="block">
      <div className="bg-base-200 backdrop-blur-sm rounded-xl border border-error/50 p-6 hover:border-error transition-all relative overflow-hidden cursor-pointer">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
          <Image src="/criminal-custody-icon.svg" alt="Criminal" width={256} height={256} className="brightness-0 dark:invert" />
        </div>
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-base-content">
                  @{scammer.githubUsername}
                </h3>
                {scammer.accountStatus === 'eliminated' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-success/20 border border-success/50 text-xs font-bold text-success">
                    🎯 ELIMINATED
                  </span>
                )}
                <a
                  href={`https://github.com/${scammer.githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 transition-colors z-20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
              <p className="text-sm text-base-content/60">
                Detected: {new Date(scammer.firstDetectedAt).toLocaleDateString()}
              </p>
            </div>
            <div className={`text-right ${getConfidenceColor(scammer.highestConfidenceScore)}`}>
              <div className="text-3xl font-bold">{scammer.highestConfidenceScore}</div>
              <div className="text-xs font-semibold">{getConfidenceBadge(scammer.highestConfidenceScore)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-base-300 rounded-lg p-3">
              <div className="text-sm text-base-content/60 mb-1">Stolen Repos</div>
              <div className="text-2xl font-bold text-error">{scammer.totalStolenRepos}</div>
            </div>
            <div className="bg-base-300 rounded-lg p-3">
              <div className="text-sm text-base-content/60 mb-1">Total Matches</div>
              <div className="text-2xl font-bold text-base-content">{scammer.totalMatches}</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-error/30">
            <span className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              View Details →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

