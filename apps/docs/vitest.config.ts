import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mirrors packages/matter/vitest.config.ts: Vite 8 OXC cannot resolve
  // ${configDir} in our shared tsconfig, so the essential option is inline.
  // @ts-expect-error -- oxc is not in UserConfig types yet; this is the documented workaround
  oxc: { tsconfig: { compilerOptions: { verbatimModuleSyntax: true } } },
  test: {
    name: '@matter/docs',
    // @lovo/matter is one bundled entry point: importing any export (even a
    // pure color-math function) runs the whole module, which pulls in
    // three/webgpu. That hits the AGENTS.md gotcha on three/webgpu
    // referencing `self` at module load, so plain Node fails here the same
    // way packages/matter and packages/matter-react would without happy-dom.
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
