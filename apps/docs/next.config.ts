import type { NextConfig } from 'next';

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

const threeMain = require.resolve('three');
const threeDir = resolve(threeMain, '..', '..');

// The package is consumed as source, not as its built dist, so a shader edit
// hot-reloads here without a tsup rebuild. Each public entry maps to its
// source file; tsconfig.json carries the same four mappings under `paths` so
// the typechecker sees what the bundler bundles.
const shadersSrc = resolve(import.meta.dirname, '..', '..', 'packages', 'shaders', 'src');

interface WebpackConfig {
  resolve?: {
    alias?: Record<string, string>;
  };
  module?: {
    rules?: Array<{
      include?: string;
      resolve?: { extensionAlias?: Record<string, string[]> };
    }>;
  };
}

// The probes under src/app/dev are named `page.dev.tsx` rather than
// `page.tsx`, which makes them invisible to the router unless `dev.tsx` is a
// recognised page extension. That is the whole mechanism: this is a static
// export with no route filtering, so anything the router can see gets written
// into out/ and indexed by pagefind, and unlinked debugging pages were turning
// up in site search on the deployed site.
//
// They are NOT dead weight — each one backs a visual regression spec. Gating
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
  transpilePackages: ['@camp-dev/shaders'],
  webpack(config: WebpackConfig): WebpackConfig {
    config.resolve = config.resolve ?? {};
    const webgpuBundle = resolve(threeDir, 'build/three.webgpu.js');

    config.resolve.alias = {
      ...config.resolve.alias,
      three$: webgpuBundle,
      'three/webgpu$': webgpuBundle,
      'three/tsl$': webgpuBundle,
      '@camp-dev/shaders$': resolve(shadersSrc, 'index.ts'),
      '@camp-dev/shaders/color$': resolve(shadersSrc, 'color.ts'),
      '@camp-dev/shaders/gamut$': resolve(shadersSrc, 'gamut.ts'),
      '@camp-dev/shaders/poster$': resolve(shadersSrc, 'poster.ts'),
    };

    // The package's own relative imports spell their specifiers with a
    // `.js` extension (e.g. `export * from './engine.js'`), the TypeScript-ESM
    // convention for a file that is actually `.ts` on disk. tsc resolves that
    // through `moduleResolution: "bundler"`, but webpack does not remap
    // extensions unless told to, so it looked for a literal `engine.js` next
    // to `index.ts` and failed. This alias is the same fix Next.js ships
    // behind `experimental.extensionAlias`, applied directly here instead.
    // It is scoped to the package source through a module rule, so a
    // third-party package that ships a `foo.ts` beside `foo.js` is never
    // resolved to its TypeScript file.
    config.module = config.module ?? {};
    config.module.rules = config.module.rules ?? [];
    config.module.rules.push({
      include: shadersSrc,
      resolve: { extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },
    });

    return config;
  },
};

export default nextConfig;
