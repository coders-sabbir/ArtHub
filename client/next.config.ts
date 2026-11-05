import type { NextConfig } from 'next';
import { createRequire } from 'node:module';
import path from 'node:path';
const requireFromClient = createRequire(import.meta.url);
// Works both with hoisted workspace dependencies and a standalone client install.
const workspaceRoot = path.dirname(path.dirname(path.dirname(requireFromClient.resolve('next/package.json'))));
const config: NextConfig = {
  turbopack: { root: workspaceRoot },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_URL || 'http://127.0.0.1:4000'}/api/:path*` }];
  },
  poweredByHeader: false,
};
export default config;
