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

// Dev-only probe routes are named `page.dev.tsx` rather than `page.tsx`,
// which makes them invisible to the router unless `dev.tsx` is a recognised
// page extension. That is the whole mechanism: this is a static export with
// no route filtering, so anything the router can see gets written into out/
// and indexed by pagefind, and unlinked debugging pages were turning up in
// site search on the deployed docs site.
//
// They are NOT dead weight — probes back visual regression specs. Gating
// them on NODE_ENV would not work, because Playwright's webServer builds and
// previews the production bundle rather than running the dev server, so a
// production build with the probes stripped is also a test run with the specs
// broken. Hence an explicit opt-in flag instead: `pnpm dev` sets it, the
// Playwright webServer sets it, and a plain `next build` does not.
const devRouteExtensions = process.env.INCLUDE_DEV_ROUTES === '1' ? ['dev.tsx', 'dev.ts'] : [];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  pageExtensions: [...devRouteExtensions, 'tsx', 'ts', 'jsx', 'js'],
  // `pnpm lint` runs ESLint over the whole repo and CI enforces it, so letting
  // `next build` lint too just runs the same rules a second time. Turning it off
  // here is not a way of skipping the check — it is saying where the check lives.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@camp-dev/shaders', '@camp-dev/shaders-react'],
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
