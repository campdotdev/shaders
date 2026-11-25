// Type-checks a code example on the React API page against the package's
// real types, so a reader who copies the example gets code that compiles.
// The example is pulled straight out of the MDX page and checked as a
// virtual file with the docs app's own tsconfig and its `@camp-dev/shaders`
// path mapping to the package source.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const docsRoot = fileURLToPath(new URL('../..', import.meta.url));
const apiPage = path.join(docsRoot, 'content/docs/react/api.mdx');

// ----
// Pull the first tsx code fence out of one `##` section of an MDX page.

function exampleUnderHeading(mdx: string, heading: string): string {
  const section = mdx.split(/^## /m).find((part) => part.startsWith(heading));
  const fence = section?.match(/```tsx\n([\s\S]*?)```/);

  if (!fence) throw new Error(`No tsx example under "## ${heading}"`);

  return fence[1];
}

// ----
// Stand in for react-three-fiber's JSX elements. r3f isn't installed in the
// workspace, so without this every `<mesh>` in an example is a type error
// that hides the errors this test is about. `any` keeps the check on the
// Shaders API alone.

const r3fElements = `
import 'react';
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      planeGeometry: any;
    }
  }
}
`;

// ----
// Compile the example as a file inside the docs app and return its errors.

function typeErrors(source: string): string[] {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(docsRoot, 'tsconfig.json'),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );

  if (!config) throw new Error('Could not read the docs tsconfig');

  const fileName = path.join(docsRoot, 'src/__example__.tsx');
  const virtualFiles = new Map([
    [fileName, source],
    [path.join(docsRoot, 'src/__r3f-elements__.d.ts'), r3fElements],
  ]);
  const host = ts.createCompilerHost(config.options);
  const readFile = host.readFile.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);

  host.fileExists = (name) => virtualFiles.has(name) || ts.sys.fileExists(name);
  host.readFile = (name) => virtualFiles.get(name) ?? readFile(name);
  host.getSourceFile = (name, languageVersion, ...rest) => {
    const text = virtualFiles.get(name);

    return text === undefined
      ? getSourceFile(name, languageVersion, ...rest)
      : ts.createSourceFile(name, text, languageVersion, true);
  };

  const program = ts.createProgram([...virtualFiles.keys()], config.options, host);

  return ts
    .getPreEmitDiagnostics(program, program.getSourceFile(fileName))
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
}

describe('React API page', () => {
  it('shows a useShaderMaterial example that type-checks', () => {
    const example = exampleUnderHeading(readFileSync(apiPage, 'utf8'), '`useShaderMaterial`');

    expect(typeErrors(example)).toEqual([]);
  }, 60_000);
});
