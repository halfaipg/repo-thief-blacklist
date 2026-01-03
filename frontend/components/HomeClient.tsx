'use client';

import { useState } from 'react';
import UnifiedScanner from '@/components/UnifiedScanner';
import Results from '@/components/Results';
import Stats from '@/components/Stats';

export default function HomeClient() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  return (
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
  );
}

