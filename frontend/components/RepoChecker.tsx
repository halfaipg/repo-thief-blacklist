'use client';

import { useState } from 'react';

interface RepoCheckerProps {
  onResults: (results: any) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function RepoChecker({ onResults, loading, setLoading }: RepoCheckerProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');

  const extractRepoInfo = (url: string) => {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL');
    }
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  };

  const handleCheck = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { owner, repo } = extractRepoInfo(repoUrl);
      
      // Import API function
      const { scanRepository } = await import('@/lib/api');
      const data = await scanRepository(owner, repo);
      
      onResults({
        type: 'repo',
        repository: data.repository,
        matches: data.matches || [],
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      onResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-800/50 p-8">
      <h3 className="text-2xl font-bold text-white mb-4">Check a Repository</h3>
      <p className="text-purple-200 mb-6">
        Enter a GitHub repository URL to check if it's legitimate or stolen
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="repo-url" className="block text-sm font-medium text-purple-200 mb-2">
            Repository URL
          </label>
          <input
            id="repo-url"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full px-4 py-3 bg-slate-900/50 border border-purple-800/50 rounded-lg text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
          />
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-800/50 rounded-lg p-4 text-red-200">
            {error}
          </div>
        )}

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Scanning...
            </span>
          ) : (
            'Check Repository'
          )}
        </button>
      </div>
    </div>
  );
}

