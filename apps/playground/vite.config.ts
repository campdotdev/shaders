import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'

// Mirror the three aliasing from apps/docs/next.config.ts (CLAUDE.md gotcha #13).
// The playground imports from both 'three' and 'three/webgpu'/'three/tsl'.
// Vite 8 no longer format-sniffs when resolving browser/module fields, so without
// explicit aliases these subpaths can resolve to different bundle copies of three
// core, triggering "Cannot read properties of undefined (reading 'usedTimes')"
// on material dispose. Force all three subpaths to the unified webgpu bundle.
const _require = createRequire(import.meta.url)
const threeMain = _require.resolve('three')
const threeDir = resolve(threeMain, '..', '..')
const webgpuBundle = resolve(threeDir, 'build/three.webgpu.js')

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite alias entries are PREFIX matches in order — unlike webpack's regex
    // exact-match `three$` form in apps/docs/next.config.ts. The bare `three`
    // entry below also catches `three/examples/*` etc., which is intentional:
    // every three-* subpath should route to the single webgpu bundle.
    alias: {
      'three/webgpu': webgpuBundle,
      'three/tsl': webgpuBundle,
      three: webgpuBundle,
    },
  },
  server: {
    port: 5173,
    open: '/',
  },
  build: {
    target: 'es2022',
  },
})
