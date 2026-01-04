'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Stats() {
  const [stats, setStats] = useState({
    totalRepos: 0,
    totalCommits: 0,
    totalScammers: 0,
    totalStolenRepos: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [blacklistRes] = await Promise.all([
        fetch('/api/blacklist/stats'),
      ]);

      if (blacklistRes.ok) {
        const blacklistData = await blacklistRes.json();
        setStats(prev => ({
          ...prev,
          totalScammers: blacklistData.totalScammers || 0,
          totalStolenRepos: blacklistData.totalStolenRepos || 0,
        }));
      }

      // Get repo stats from database
      try {
        const reposRes = await fetch('/api/stats');
        if (reposRes.ok) {
          const reposData = await reposRes.json();
          setStats(prev => ({
            ...prev,
            totalRepos: reposData.totalRepos || 0,
            totalCommits: reposData.totalCommits || 0,
          }));
        } else {
          // Fallback to placeholder values
          setStats(prev => ({
            ...prev,
            totalRepos: 33,
            totalCommits: 100000,
          }));
        }
      } catch (error) {
        // Fallback to placeholder values
        setStats(prev => ({
          ...prev,
          totalRepos: 33,
          totalCommits: 100000,
        }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
      <div className="bg-base-200 rounded-xl border border-base-300 p-6 shadow-lg">
        <div className="text-3xl font-bold text-primary mb-2">{stats.totalRepos}+</div>
        <div className="text-base-content/70">Repositories Indexed</div>
      </div>
      <div className="bg-base-200 rounded-xl border border-base-300 p-6 shadow-lg">
        <div className="text-3xl font-bold text-primary mb-2">{Math.floor(stats.totalCommits / 1000)}K+</div>
        <div className="text-base-content/70">Commits Analyzed</div>
      </div>
      <Link href="/blacklist" className="block">
        <div className="bg-base-200 rounded-xl border border-base-300 p-6 hover:border-error transition-all cursor-pointer transform hover:scale-105 shadow-lg">
          <div className="text-3xl font-bold text-error mb-2">{stats.totalScammers || 0}</div>
          <div className="text-base-content/70">Thieves Caught</div>
          <div className="text-xs text-primary mt-2">View blacklist →</div>
        </div>
      </Link>
      <div className="bg-base-200 rounded-xl border border-error/30 p-6 shadow-lg">
        <div className="text-3xl font-bold text-error mb-2">{stats.totalStolenRepos || 0}</div>
        <div className="text-base-content/70">Stolen Repos Found</div>
      </div>
    </div>
  );
}

