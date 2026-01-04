/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // In Docker/Coolify, the backend service is named 'api'
        // For local dev, use localhost:4000
        destination: process.env.BACKEND_URL 
          ? `${process.env.BACKEND_URL}/api/:path*` 
          : process.env.NODE_ENV === 'production'
          ? 'http://api:4000/api/:path*'
          : 'http://localhost:3000/api/:path*', 
      },
    ];
  },
};

module.exports = nextConfig;

