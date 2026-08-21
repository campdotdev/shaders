import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mirrors packages/shaders/vitest.config.ts: Vite 8 OXC cannot resolve
  // ${configDir} in our shared tsconfig, so the essential option is inline.
  // @ts-expect-error -- oxc is not in UserConfig types yet; this is the documented workaround
  oxc: { tsconfig: { compilerOptions: { verbatimModuleSyntax: true } } },
  test: {
    // No DOM environment on purpose. These tests are pure color math, and
    // running them in plain Node means a future test that imports root
    // @camp-dev/shaders fails here — three/webgpu reads `self` at module load — the
    // same way it would fail in a server render. Import from
    // @camp-dev/shaders/color instead.
    name: '@shaders/docs',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
