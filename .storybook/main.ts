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
    // Don't dedupe react here — Storybook's @storybook/react-vite handles
    // it, and overriding breaks its CJS-default-export interop.
    config.resolve.dedupe = [...(config.resolve.dedupe ?? []), 'three']
    return config
  },
}

export default config
