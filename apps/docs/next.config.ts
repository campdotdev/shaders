import type { NextConfig } from 'next';

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

const threeMain = require.resolve('three');
const threeDir = resolve(threeMain, '..', '..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  transpilePackages: ['@lovo/matter', '@lovo/matter-react', '@matter/registry'],
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
};

export default nextConfig;
