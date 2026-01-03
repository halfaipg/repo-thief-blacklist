import Link from 'next/link';
import HomeClient from '@/components/HomeClient';

export default function Home() {
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
              <Link
                href="/blacklist"
                className="text-sm font-medium text-base-content/60 hover:text-base-content transition-colors"
              >
                Blacklist
              </Link>
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

      {/* Main Content - Client Component */}
      <HomeClient />

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
