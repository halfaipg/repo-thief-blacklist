'use client';

import { useState, useEffect, useRef } from 'react';

interface ProfileScannerProps {
  onResults: (results: any) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function ProfileScanner({ onResults, loading, setLoading }: ProfileScannerProps) {
  const [profileUrl, setProfileUrl] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup polling on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const extractUsername = (url: string) => {
    const match = url.match(/github\.com\/([^\/\?]+)/);
    if (!match) {
      throw new Error('Invalid GitHub profile URL');
    }
    return match[1].trim(); // Trim whitespace
  };

  const pollProfileStatus = async (username: string) => {
    try {
      const cleanUsername = encodeURIComponent(username.trim()); // Clean and encode username
      const response = await fetch(`/api/profile/${cleanUsername}/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch profile status');
      }
      
      const status = await response.json();
      
      onResults({
        type: 'profile',
        username,
        status: status.status,
        progress: status.progress,
        results: status.results,
        message: status.status === 'completed' 
          ? 'Profile scan completed!' 
          : `Scanning... ${status.progress.scannedRepos}/${status.progress.totalRepos} repos (${status.progress.percentage}%)`,
      });

      // Stop polling if complete
      if (status.status === 'completed') {
        setScanning(false);
        setCurrentUsername(null);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err: any) {
      console.error('Error polling profile status:', err);
    }
  };

  const handleScan = async () => {
    if (!profileUrl.trim()) {
      setError('Please enter a GitHub profile URL');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const username = extractUsername(profileUrl);
      setCurrentUsername(username);
      
      // Start the scan
      const cleanUsername = encodeURIComponent(username.trim()); // Clean and encode username
      const response = await fetch(`/api/profile/${cleanUsername}/scan`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start profile scan');
      }

      const data = await response.json();
      
      // Show initial status
      onResults({
        type: 'profile',
        username,
        status: 'processing',
        message: 'Profile scan started. Fetching repositories...',
        progress: { totalRepos: 0, scannedRepos: 0, pendingRepos: 0, percentage: 0 },
        results: { totalMatches: 0, suspiciousRepos: 0, profileScore: 0 },
      });

      setScanning(true);
      setLoading(false);

      // Start polling for status updates
      pollProfileStatus(username); // Initial poll
      pollIntervalRef.current = setInterval(() => {
        pollProfileStatus(username);
      }, 3000); // Poll every 3 seconds

    } catch (err: any) {
      setError(err.message || 'An error occurred');
      onResults(null);
      setLoading(false);
      setScanning(false);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-800/50 p-8">
      <h3 className="text-2xl font-bold text-white mb-4">Scan a Profile</h3>
      <p className="text-purple-200 mb-6">
        Enter a GitHub profile URL to scan all their repositories for suspicious activity
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="profile-url" className="block text-sm font-medium text-purple-200 mb-2">
            Profile URL
          </label>
          <input
            id="profile-url"
            type="text"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            placeholder="https://github.com/username"
            className="w-full px-4 py-3 bg-slate-900/50 border border-purple-800/50 rounded-lg text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            onKeyPress={(e) => e.key === 'Enter' && handleScan()}
          />
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-800/50 rounded-lg p-4 text-red-200">
            {error}
          </div>
        )}

        <button
          onClick={handleScan}
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
            'Scan Profile'
          )}
        </button>
      </div>
    </div>
  );
}

