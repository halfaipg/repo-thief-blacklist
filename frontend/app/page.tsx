'use client';

import { useState } from 'react';
import UnifiedScanner from '@/components/UnifiedScanner';
import Results from '@/components/Results';
import Stats from '@/components/Stats';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-base-100 text-base-content selection:bg-primary/30">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-purple-900/10 blur-[120px]" />
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-pink-900/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-base-300 bg-base-100/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 relative">
                <img src="/thief-icon.svg" alt="RepoThief Logo" className="w-full h-full object-contain dark:invert" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-base-content tracking-tight">RepoThief</h1>
              </div>
            </div>
            <nav className="flex items-center space-x-6">
              <a
                href="/blacklist"
                className="text-sm font-medium text-base-content/60 hover:text-base-content transition-colors"
              >
                Blacklist
              </a>
              <ThemeToggle />
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-base-content/60 hover:text-base-content transition-colors"
              >
                GitHub
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <div className="container mx-auto px-6 py-16 lg:py-20">
          <div className="max-w-4xl mx-auto text-center mb-10">
            <h2 className="text-4xl md:text-6xl font-bold text-base-content mb-6 tracking-tight leading-tight">
              Expose Code Theft <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                Protect Open Source
              </span>
            </h2>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto mb-8 leading-relaxed">
              Advanced detection of stolen repositories using deep commit history analysis and pattern matching. Detect repository theft instantly.
            </p>
            
            <UnifiedScanner
              onResults={setResults}
              loading={loading}
              setLoading={setLoading}
            />
          </div>

          {/* Results Section */}
          <div className="max-w-4xl mx-auto">
            {results && <Results results={results} />}
          </div>

          {/* Stats Section */}
          <div className="mt-20 border-t border-base-300 pt-12">
            <Stats />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-base-300 bg-base-100">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-base-content/60 text-sm">
                © 2025 RepoThief. Built for the community.
              </p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-base-content/60 hover:text-base-content text-sm transition-colors">Privacy</a>
              <a href="#" className="text-base-content/60 hover:text-base-content text-sm transition-colors">Terms</a>
              <a href="#" className="text-base-content/60 hover:text-base-content text-sm transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
