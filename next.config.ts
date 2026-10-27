import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'xlsx'],
  },
};

export default nextConfig;
