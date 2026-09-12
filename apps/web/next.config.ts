import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cognitest/shared'],
  // Proxy the API through the web origin: the session cookie stays first-party,
  // middleware can read it, and OIDC callbacks land on the right origin.
  async rewrites() {
    const api = process.env.API_URL ?? 'http://localhost:3001';
    return [{ source: '/api/:path*', destination: `${api}/:path*` }];
  },
};

export default nextConfig;
