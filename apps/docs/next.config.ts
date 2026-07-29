import type { NextConfig } from 'next';

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

const threeMain = require.resolve('three');
const threeDir = resolve(threeMain, '..', '..');

interface WebpackConfig {
  resolve?: {
    alias?: Record<string, string>;
  };
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  // `pnpm lint` runs ESLint over the whole repo and CI enforces it, so letting
  // `next build` lint too just runs the same rules a second time. Turning it off
  // here is not a way of skipping the check — it is saying where the check lives.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@lovo/matter', '@lovo/matter-react', '@matter/registry'],
  webpack(config: WebpackConfig): WebpackConfig {
    config.resolve = config.resolve ?? {};
    const webgpuBundle = resolve(threeDir, 'build/three.webgpu.js');

    config.resolve.alias = {
      ...config.resolve.alias,
      three$: webgpuBundle,
      'three/webgpu$': webgpuBundle,
      'three/tsl$': webgpuBundle,
    };

    return config;
  },
};

export default nextConfig;
