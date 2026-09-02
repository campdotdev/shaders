/**
 * Build-time props extraction for the API Reference table. Parses a registry
 * component's wrapper file with the TypeScript compiler API and returns one
 * row per prop: the name, the type as written in the `*Props` interface, the
 * JSDoc description, and the default from the wrapper's destructuring. The
 * docs site is a static export, so this only ever runs at build, the same
 * way content/catalog.ts reads registry.json.
 */
import { cache } from 'react';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { format } from 'prettier';
import ts from 'typescript';

export interface PropRow {
  name: string;
  /** Type text exactly as written in the interface, e.g. `AnimatableProp<number>`. */
  type: string;
  description: string;
  /**
   * The default as formatted source, absent when the prop has none. Named
   * constants such as `DEFAULT_STOPS` are resolved to their literal, so this
   * can span many lines for a stops array.
   */
  defaultValue?: string;
  /** The default when it fits a table cell on one line; absent otherwise. */
  defaultSummary?: string;
}

// Widest default that still reads inside the table's Default column;
// `'oklch(0.145 0.02 265)'` (23 characters) is the longest inline literal in
// the registry today. Anything longer, or multi-line, is only shown in the
// expanded row's code block.
const SUMMARY_MAX_LENGTH = 24;

// Narrower than the repo's 100 so a resolved stops array breaks one entry per
// line inside the expanded row's code block, while wave-lines' two-color
// tuples still fit on one line each.
const DEFAULT_PRINT_WIDTH = 80;

/** Reads `registry/<slug>/<slug>.tsx` and extracts its props table rows. */
export const getComponentProps = cache(async (slug: string): Promise<PropRow[]> => {
  const wrapperPath = resolve(process.cwd(), '..', '..', 'registry', slug, `${slug}.tsx`);
  const componentName = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return extractProps(await readFile(wrapperPath, 'utf8'), componentName);
});

export async function extractProps(source: string, componentName: string): Promise<PropRow[]> {
  const file = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true);

  const propsInterface = file.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === `${componentName}Props`,
  );

  if (!propsInterface) {
    throw new Error(`No ${componentName}Props interface found`);
  }

  const defaults = readDestructuringDefaults(file, componentName);

  // Each prop's default goes through Prettier independently, so the rows are
  // built together rather than one await at a time.
  return Promise.all(
    propsInterface.members.filter(ts.isPropertySignature).map(async (member): Promise<PropRow> => {
      const name = member.name.getText(file);
      const description = readJsDocText(member);

      // Fail the build rather than render an empty cell — AGENTS.md mandates
      // JSDoc on every user-facing prop, so a miss here is a registry bug.
      if (description === '') {
        throw new Error(`Prop "${name}" on ${componentName}Props has no JSDoc description`);
      }

      const initializer = defaults.get(name);
      const defaultValue = initializer ? await formatDefault(file, initializer) : undefined;

      return {
        name,
        type: member.type ? member.type.getText(file) : 'unknown',
        description,
        defaultValue,
        defaultSummary: summarizeDefault(defaultValue),
      };
    }),
  );
}

// The wrapper states defaults as destructuring initializers, e.g.
// `function Glow({ intensity = 0.3 }: GlowProps)`. Their source is the
// default exactly as a user would write it, so no prose parsing is needed.
function readDestructuringDefaults(
  file: ts.SourceFile,
  componentName: string,
): Map<string, ts.Expression> {
  const defaults = new Map<string, ts.Expression>();

  const wrapper = file.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === componentName,
  );
  const propsParam = wrapper?.parameters[0];

  if (!propsParam || !ts.isObjectBindingPattern(propsParam.name)) return defaults;

  // An aliased binding such as `{ intensity: localIntensity = 0.3 }` keys on
  // the interface's property name, `intensity`, which is what extractProps
  // looks up. `propertyName` is only set when the binding is aliased.
  for (const element of propsParam.name.elements) {
    if (element.initializer) {
      defaults.set((element.propertyName ?? element.name).getText(file), element.initializer);
    }
  }

  return defaults;
}

// Large defaults live in a same-file constant (`stops = DEFAULT_STOPS`), so
// an identifier initializer is followed to that constant's literal. The
// TypeScript printer drops the source's `// paletteOklch.magenta[9]` comments,
// then Prettier lays the literal out the way the repo would.
async function formatDefault(file: ts.SourceFile, initializer: ts.Expression): Promise<string> {
  const literal = ts.isIdentifier(initializer)
    ? (findConstantInitializer(file, initializer.text) ?? initializer)
    : initializer;
  const printer = ts.createPrinter({ removeComments: true });
  const expression = printer.printNode(ts.EmitHint.Expression, literal, file);

  const statement = await format(`const value = ${expression};`, {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'all',
    printWidth: DEFAULT_PRINT_WIDTH,
  });

  return statement.replace(/^const value = /, '').replace(/;\n$/, '');
}

function findConstantInitializer(file: ts.SourceFile, name: string): ts.Expression | undefined {
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        return declaration.initializer;
      }
    }
  }

  return undefined;
}

function summarizeDefault(defaultValue: string | undefined): string | undefined {
  if (defaultValue === undefined) return undefined;
  if (defaultValue.includes('\n') || defaultValue.length > SUMMARY_MAX_LENGTH) return undefined;

  return defaultValue;
}

function readJsDocText(member: ts.PropertySignature): string {
  for (const jsDoc of ts.getJSDocCommentsAndTags(member)) {
    if (ts.isJSDoc(jsDoc) && jsDoc.comment !== undefined) {
      return cleanDescription(ts.getTextOfJSDocComment(jsDoc.comment) ?? '');
    }
  }

  return '';
}

// The table shows the default in its own column and flags animatability via
// the type chip, so the JSDoc sentences carrying those (mandated by
// AGENTS.md) are redundant here. The "Defaults to ..." sentence can contain
// periods inside numbers and tuples, so it ends at the first period followed
// by a new sentence or the end of the text, not at the first period.
function cleanDescription(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\s*Accepts a static value or an animation signal\./, '')
    .replace(/\s*Defaults to .*?\.(?=\s+[A-Z`]|\s*$)/, '')
    .trim();
}
