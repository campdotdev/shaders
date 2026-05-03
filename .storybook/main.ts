import type { StorybookConfig } from '@storybook/react-vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: ['../registry/**/*.stories.@(ts|tsx)', '../packages/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  viteFinal: async (config) => {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@matter/registry': resolve(__dirname, '../registry'),
    }
    // Force a single copy of three across the workspace.
    // Without this, pnpm's per-package node_modules layout can cause Vite
    // to bundle two `three` instances — material.dispose() then explodes
    // touching the wrong Nodes bookkeeping (`usedTimes` undefined).
    config.resolve.dedupe = [...(config.resolve.dedupe ?? []), 'three']

    // Pre-bundle react so CJS-default-style `import React from 'react'`
    // works via Vite's interop. Without this, some chunked deps resolve
    // react to the raw ESM index.js which has no default export.
    config.optimizeDeps = config.optimizeDeps ?? {}
    config.optimizeDeps.include = [
      ...(config.optimizeDeps.include ?? []),
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
    ]
    return config
  },
}

export default config
