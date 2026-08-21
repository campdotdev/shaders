import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.turbo/**',
    '**/.next/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/*.snap',
    '.worktrees/**',
    '.fallow/**',
    'apps/docs/out/**',
    'apps/docs/.next/**',
    'apps/docs/next-env.d.ts',
    'apps/editor/out/**',
    'apps/editor/.next/**',
    'apps/editor/next-env.d.ts',
    'packages/shaders-cli/src/test-fixtures/**',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat['recommended-latest']],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['packages/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}', 'registry/**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
      'jsx-a11y': jsxA11y,
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'packages/shaders/*.config.{ts,mts,cts}',
            'packages/shaders-react/*.config.{ts,mts,cts}',
            'apps/docs/vitest.config.ts',
            'apps/editor/vitest.config.ts',
            'packages/*/posters/*.{ts,tsx}',
          ],
          defaultProject: 'tsconfig.eslint.json',
        },
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['packages/*/tsconfig.json', 'apps/*/tsconfig.json', 'registry/tsconfig.json'],
        },
        node: true,
      },
      react: {
        version: 'detect',
      },
    },
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    rules: {
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
          arrayLiteralTypeAssertions: 'never',
        },
      ],
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/strict-boolean-expressions': ['error', { allowString: false }],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'directive', next: '*' },
        { blankLine: 'always', prev: '*', next: 'function' },
        { blankLine: 'always', prev: 'function', next: '*' },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
      ],
      complexity: ['error', 20],
      eqeqeq: ['error', 'smart'],
      'import/order': 'off',
      'no-empty': 'error',
      'no-nested-ternary': 'error',
      'no-plusplus': 'error',
      'no-shadow': 'off',
      'no-useless-computed-key': 'error',
      radix: 'error',
      'react/self-closing-comp': 'error',
      'react/jsx-sort-props': 'warn',
      'react/jsx-newline': ['error', { prevent: true }],
      'react/style-prop-object': 'error',
      'sort-imports': ['error', { ignoreCase: true, ignoreDeclarationSort: true }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: [
      'packages/*/src/**/*.test.{ts,tsx}',
      'packages/*/src/**/*.spec.{ts,tsx}',
      'apps/*/src/**/*.test.{ts,tsx}',
      'apps/docs-tests/**/*.{ts,tsx}',
      'packages/*/src/test-setup.ts',
    ],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-plusplus': 'off',
    },
  },
  {
    // The docs site server-renders, and both packages have a root entry that
    // reaches three/webgpu — the engine's through the renderer, the binding's
    // through ShaderScene. three/webgpu reads `self` at module load, so the
    // wrong import crashes at render time, which is far too late to notice.
    // Each has a three-free subpath carrying the same code: @camp-dev/shaders/color
    // and @camp-dev/shaders-react/gamut.
    //
    // Banning the names rather than the specifiers is deliberate: it lets /dev
    // playgrounds keep importing colorRamp, ShaderScene and friends from the
    // roots, which is correct, while still catching the pieces that have a
    // three-free door.
    files: ['apps/docs/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@camp-dev/shaders',
              importNames: [
                'linearChannelToSrgb',
                'linearSrgbToLinearDisplayP3',
                'linearSrgbToOklch',
                'oklabToLinearSrgb',
                'oklchInGamut',
                'oklchToGamut',
                'oklchToLinearSrgb',
                'parseColorString',
                'srgbChannelToLinear',
              ],
              allowTypeImports: true,
              message:
                "Import CPU color math from '@camp-dev/shaders/color'. The root entry pulls in three/webgpu, which reads `self` at module load and crashes any server render.",
            },
            {
              name: '@camp-dev/shaders-react',
              importNames: ['useDisplayGamut'],
              allowTypeImports: true,
              message:
                "Import useDisplayGamut from '@camp-dev/shaders-react/gamut'. The root entry re-exports ShaderScene and so pulls in three/webgpu, which reads `self` at module load and crashes any server render.",
            },
          ],
        },
      ],
    },
  },
]);
