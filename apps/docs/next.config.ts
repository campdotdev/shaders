import type { NextConfig } from 'next'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
// Resolve `three` to its canonical install path. With pnpm + workspaces,
// each package's node_modules has its own symlink to the same physical
// three install, but webpack treats those symlinks as distinct modules.
// Forcing a single resolved path prevents "Multiple instances of Three.js"
// (which manifests as `Cannot read properties of undefined (reading 'usedTimes')`
// when LinearGradient's material is disposed during a remount).
// three's package.json doesn't expose `./package.json` via exports, so we
// resolve a known entry and walk up to the package root.
const threeMain = require.resolve('three')
const threeDir = resolve(threeMain, '..', '..')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages so Next can compile our raw source / tsx
  // (Next would otherwise refuse to load .tsx from node_modules).
  transpilePackages: ['@lovo/matter', '@lovo/matter-react', '@matter/registry'],
  webpack(config) {
    config.resolve = config.resolve ?? {}
    // three ships TWO standalone bundles: `three.module.js` (core only)
    // and `three.webgpu.js` (core + WebGPU + TSL). Both contain a copy
    // of three core, so importing both via different subpaths loads two
    // instances and triggers `Cannot read properties of undefined
    // (reading 'usedTimes')` on dispose. Force every three import to the
    // unified webgpu bundle.
    const webgpuBundle = resolve(threeDir, 'build/three.webgpu.js')
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      three$: webgpuBundle,
      'three/webgpu$': webgpuBundle,
      'three/tsl$': webgpuBundle,
    }
    return config
  },
}

export default nextConfig
