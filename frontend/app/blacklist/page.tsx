'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ScammerCard from '@/components/ScammerCard';
import ThemeToggle from '@/components/ThemeToggle';

interface Scammer {
  id: number;
  githubUsername: string;
  totalStolenRepos: number;
  totalMatches: number;
  highestConfidenceScore: number;
  firstDetectedAt: string;
  accountStatus?: 'active' | 'eliminated' | 'unknown';
}

export default function BlacklistPage() {
  const [scammers, setScammers] = useState<Scammer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const limit = 20;

  useEffect(() => {
    fetchScammers();
  }, [page, search]);

  const fetchScammers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/blacklist?${params}`);
      const data = await response.json();
      setScammers(data.scammers || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching scammers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchScammers();
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
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-32 h-32 relative p-2 bg-error/10 rounded-xl border border-error/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <img src="/criminal-custody-icon.svg" alt="Blacklist" className="w-full h-full object-contain brightness-0 dark:invert" />
            </div>
          </div>
          <h2 className="text-5xl font-bold text-base-content mb-4 tracking-tight">
            Blacklist
          </h2>
          <p className="text-xl text-base-content/70 max-w-2xl mx-auto mb-8">
            Code thieves caught red-handed
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-md mx-auto mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by username..."
                className="flex-1 px-4 py-3 bg-base-200 border border-base-300 rounded-lg text-base-content placeholder-base-content/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-semibold rounded-lg transition-all"
              >
                Search
              </button>
            </div>
          </form>

          {/* Stats */}
          <div className="mb-8">
            <div className="inline-block bg-error/10 border-2 border-error/30 rounded-lg px-6 py-3">
              <span className="text-error">
                <span className="text-2xl font-bold">{total}</span> scammers identified
              </span>
            </div>
          </div>
        </div>

        {/* Scammers List */}
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-base-content/60 mt-4">Loading scammers...</p>
            </div>
          ) : scammers.length === 0 ? (
            <div className="text-center py-12 bg-base-200 rounded-xl border border-base-300">
              <p className="text-base-content/70 text-xl">No scammers found</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 mb-8">
                {scammers.map((scammer) => (
                  <ScammerCard key={scammer.id} scammer={scammer} />
                ))}
              </div>

              {/* Pagination */}
              {total > limit && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-base-200 border border-base-300 rounded-lg text-base-content/70 hover:bg-base-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-base-content/70">
                    Page {page} of {Math.ceil(total / limit)}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil(total / limit)}
                    className="px-4 py-2 bg-base-200 border border-base-300 rounded-lg text-base-content/70 hover:bg-base-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

