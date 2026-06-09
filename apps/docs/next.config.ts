import type { NextConfig } from 'next';

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

const threeMain = require.resolve('three');
const threeDir = resolve(threeMain, '..', '..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  // `output: 'export'` disables the `/_next/image` proxy; `unoptimized` lets
  // next/image render plain <img> tags pointing at our pre-encoded assets.
  images: { unoptimized: true },
  transpilePackages: ['@lovo/matter', '@lovo/matter-react', '@matter/registry'],
  // Next's webpack types expose `config.resolve.alias` as loosely-typed
  // (effectively any). The aliases here force a single three.js bundle so
  // we don't end up with two copies of three core (gotcha #13). Disabling
  // the unsafe-access rules scoped to this block.
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  webpack(config) {
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
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
};

export default nextConfig;
