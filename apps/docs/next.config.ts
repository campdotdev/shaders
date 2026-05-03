import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages so Next can compile our raw source / tsx
  // (Next would otherwise refuse to load .tsx from node_modules).
  transpilePackages: ['@lovo/matter', '@lovo/matter-react', '@matter/registry'],
}

export default nextConfig
