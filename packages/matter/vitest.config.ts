import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite 8 OXC cannot resolve ${configDir} in our shared tsconfig/library.json.
  // Provide the essential compiler options inline so OXC skips file-based discovery.
  // @ts-expect-error -- oxc is not in UserConfig types yet; this is the documented workaround
  oxc: { tsconfig: { compilerOptions: { verbatimModuleSyntax: true } } },
  test: {
    name: '@mattermix/shaders',
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
