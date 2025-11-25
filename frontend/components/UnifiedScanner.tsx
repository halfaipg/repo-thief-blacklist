'use client';

import { useState, useEffect, useRef } from 'react';
import { getRepository } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface UnifiedScannerProps {
  onResults: (results: any) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function UnifiedScanner({ onResults, loading, setLoading }: UnifiedScannerProps) {
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState('');
  const [scanType, setScanType] = useState<'repo' | 'profile' | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const detectType = (url: string): 'repo' | 'profile' | 'invalid' => {
    const trimmed = url.trim();
    // Matches: github.com/owner/repo
    const repoMatch = trimmed.match(/github\.com\/([^\/]+)\/([^\/\?]+)/);
    // Matches: github.com/owner
    const profileMatch = trimmed.match(/github\.com\/([^\/\?]+)\/?$/);

    if (repoMatch) return 'repo';
    if (profileMatch) return 'profile';
    return 'invalid';
  };

  const extractRepoDetails = (url: string) => {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\?]+)/);
    if (!match) throw new Error('Invalid repository URL');
    return { owner: match[1], repo: match[2] };
  };

  const extractUsername = (url: string) => {
    const match = url.match(/github\.com\/([^\/\?]+)/);
    if (!match) throw new Error('Invalid profile URL');
    return match[1].trim();
  };

  const pollProfileStatus = async (username: string) => {
    try {
      const cleanUsername = encodeURIComponent(username.trim());
      const response = await fetch(`/api/profile/${cleanUsername}/status`);
      
      if (!response.ok) {
        // If status check fails (maybe waiting for scan to start), just return
        return; 
      }
      
      const status = await response.json();
      
      onResults({
        type: 'profile',
        username,
        status: status.status,
        progress: status.progress,
        results: status.results,
        message: status.message || (status.status === 'completed' 
          ? 'Profile scan completed!' 
          : `Scanning... ${status.progress?.scannedRepos || 0}/${status.progress?.totalRepos || 0} repos`),
      });

      if (status.status === 'completed') {
        setLoading(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('Error polling status:', err);
    }
  };

  const handleScan = async () => {
    if (!inputUrl.trim()) {
      setError('Please enter a GitHub URL');
      return;
    }

    const type = detectType(inputUrl);
    if (type === 'invalid') {
      setError('Invalid GitHub URL. Please enter a repository or profile link.');
      return;
    }

    setError('');
    setLoading(true);
    setScanType(type);
    onResults(null); // Clear previous results

    try {
      if (type === 'repo') {
        const { owner, repo } = extractRepoDetails(inputUrl);
        
        // Queue scan
        await fetch(`${API_BASE}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, repo }),
        });
        
        // Check immediately
        let repoData = await getRepository(owner, repo);
        
        if (repoData && repoData.repository?.scanStatus === 'completed') {
           onResults({ type: 'repo', ...repoData });
           setLoading(false);
        } else {
           // Simulate polling or wait message
           onResults({
             type: 'repo',
             repo: { owner, name: repo, fullName: `${owner}/${repo}` },
             message: 'Repository scan queued. Checking for results...',
             status: 'queued',
           });
           
           // Poll a few times for single repo
           let attempts = 0;
           const interval = setInterval(async () => {
             attempts++;
             try {
               repoData = await getRepository(owner, repo);
               if (repoData && repoData.repository?.scanStatus === 'completed') {
                 onResults({ type: 'repo', ...repoData });
                 setLoading(false);
                 clearInterval(interval);
               } else if (attempts > 20) { // Timeout after ~40s
                 clearInterval(interval);
                 setLoading(false);
                 onResults({
                    type: 'repo',
                    repo: { owner, name: repo, fullName: `${owner}/${repo}` },
                    message: 'Scan taking longer than expected. Please check back later.',
                    status: 'timeout'
                 });
               }
             } catch (e) {
               // ignore errors during poll
             }
           }, 2000);
        }

      } else if (type === 'profile') {
        const username = extractUsername(inputUrl);
        const cleanUsername = encodeURIComponent(username);
        
        // Start profile scan
        const response = await fetch(`/api/profile/${cleanUsername}/scan`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to start profile scan');
        }

        // Start polling
        pollProfileStatus(username);
        pollIntervalRef.current = setInterval(() => pollProfileStatus(username), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/50 to-pink-600/50 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex items-center bg-base-200 rounded-xl border border-base-300 p-2 shadow-2xl">
          <div className="pl-4 text-base-content/50">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="Paste a GitHub repository or profile URL..."
            className="flex-1 bg-transparent border-none text-base-content text-lg placeholder-base-content/50 focus:ring-0 focus:outline-none px-4 py-3 font-light"
            disabled={loading}
          />
          <button
            onClick={handleScan}
            disabled={loading}
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-medium px-8 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center shadow-lg shadow-primary/20"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Scanning
              </>
            ) : (
              'Scan'
            )}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-lg flex items-center text-error animate-fade-in">
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="mt-6 text-center text-sm text-base-content/60">
        Examples: 
        <span className="mx-2 px-2 py-1 bg-base-200 rounded-md text-base-content/70">github.com/owner/repo</span>
        <span className="text-base-content/50">or</span>
        <span className="mx-2 px-2 py-1 bg-base-200 rounded-md text-base-content/70">github.com/username</span>
      </div>
    </div>
  );
}

