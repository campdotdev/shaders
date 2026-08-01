// `matter-cli add`: the copy-paste flow the whole Tier 1 model is built on.
// Fetch the registry index, resolve each requested slug to a source file,
// download it, rewrite its import specifiers for the user's project (see
// transforms/rewriteImports), write it into componentsDir, and finish by
// listing the npm packages the component needs.
import { lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import { readMatterConfig, resolveRegistryUrl } from '../config/matterConfig.js';
import { writeFileNoFollow } from '../fs/writeFileNoFollow.js';
import {
  fetchComponentSource,
  fetchRegistry,
  type Registry,
  type RegistryEntry,
} from '../registry/fetchRegistry.js';
import { resolveRef } from '../registry/ref.js';
import { rewriteImports } from '../transforms/rewriteImports.js';

export interface AddOptions {
  registry?: string;
  ref?: string;
  force?: boolean;
  cliVersion: string;
}

export interface AddIO {
  cwd: string;
  log: (line: string) => void;
}

export async function runAdd(
  components: string[],
  opts: AddOptions,
  io: AddIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  if (components.length === 0) {
    throw new Error('add: at least one component name is required');
  }

  const matterConfig = await readMatterConfig(io.cwd);
  const ref = resolveRef(opts.ref, opts.cliVersion);
  const registryUrl = resolveRegistryUrl(matterConfig, { registry: opts.registry, ref });
  const registry = await fetchRegistry(registryUrl);

  const resolved = components.map((slug) => resolveComponent(slug, registry, registryUrl));

  // One component means several files, and two components can claim the same
  // shared helper — every component but grain imports utils/color.ts. Flatten
  // to distinct paths so a shared file is checked, fetched and written once no
  // matter how many components in this invocation want it.
  const sourceFiles = [...new Set(resolved.flatMap((component) => entryFiles(component.entry)))];

  // A registry is remote data, so a declared path is not trusted to stay put.
  // Resolve every target inside componentsDir before anything is fetched: a
  // `../` in an entry would otherwise read and write outside the project. The
  // separator on the prefix check matters — it keeps `matter` from matching a
  // sibling directory named `matter-elsewhere`.
  const componentsRoot = resolve(io.cwd, matterConfig.componentsDir);
  const targets = sourceFiles.map((file) => {
    const targetPath = resolve(componentsRoot, file);

    if (targetPath !== componentsRoot && !targetPath.startsWith(componentsRoot + sep)) {
      throw new Error(
        `Registry declares ${file}, which resolves outside ${componentsRoot}. Refusing to write it.`,
      );
    }

    return { file, targetPath };
  });

  // Fetch and rewrite everything up front. Nothing here touches disk, and the
  // collision check below needs the finished contents to compare against.
  const planned = await Promise.all(
    targets.map(async ({ file, targetPath }) => ({
      targetPath,
      contents: rewriteImports(await fetchComponentSource(registryUrl, file), matterConfig.aliases),
    })),
  );

  // Resolve EVERY target before writing ANY file, so a refused overwrite can't
  // leave a half-copied set on disk. A file already holding exactly what we
  // would write is not a conflict — that is the ordinary case for a shared
  // helper a previous add already installed, and skipping it keeps a second
  // `add` from failing on a file it wrote itself.
  const toWrite = [];

  for (const file of planned) {
    // A symlink where a source file should be is never something the CLI put
    // there, and writing follows it wherever it points. A dangling one is the
    // sharper case: the existence check below reads through it, finds nothing,
    // and would create the file at the far end without even asking for --force.
    if (await isSymbolicLink(file.targetPath)) {
      throw new Error(
        `${file.targetPath} is a symbolic link. Refusing to write through it — remove it first.`,
      );
    }

    const existing = await readFileIfExists(file.targetPath);

    // Compare on content, not bytes. A Windows checkout with core.autocrlf
    // turns the CLI's own LF into CRLF, and that is the same file, not an edit
    // the user needs to be warned about.
    if (existing !== null && sameText(existing, file.contents)) continue;
    if (existing !== null && opts.force !== true) {
      throw new Error(
        `${file.targetPath} already exists and differs from the registry copy. Pass --force to overwrite.`,
      );
    }

    toWrite.push(file);
  }

  // Create the directories, then check containment a second time against the
  // paths the filesystem actually resolves to. The check above is lexical, and
  // a symlink already sitting inside componentsDir points somewhere it can't
  // see — `<componentsDir>/utils` linked to /etc is textually well inside. Both
  // passes run before any write, so a refusal still leaves no partial copy.
  for (const { targetPath } of toWrite) {
    await mkdir(dirname(targetPath), { recursive: true });
  }
  if (toWrite.length > 0) {
    // componentsRoot may itself be a symlink the user set up deliberately, so
    // compare real paths against a real root rather than the lexical one.
    const realRoot = await realpath(componentsRoot);

    for (const { targetPath } of toWrite) {
      const realParent = await realpath(dirname(targetPath));

      if (realParent !== realRoot && !realParent.startsWith(realRoot + sep)) {
        throw new Error(
          `${targetPath} resolves through a link to ${realParent}, outside ${realRoot}. Refusing to write it.`,
        );
      }
    }
  }

  // writeFileNoFollow, not writeFile: the lstat above and the write below are
  // two separate operations, and the guarantee has to hold at the moment of
  // writing, not a moment before it.
  for (const { targetPath, contents } of toWrite) {
    await writeFileNoFollow(targetPath, contents);
    io.log(`Wrote ${targetPath}`);
  }

  const allDeps = new Set(resolved.flatMap((component) => component.entry.dependencies));

  const sortedDeps = [...allDeps].sort();

  io.log('');
  io.log(`This component requires: ${sortedDeps.join(', ')}`);
  io.log('Install with your package manager, e.g.:');
  io.log(`npm install ${sortedDeps.join(' ')}`);
}

/** Entry point first, then the rest of the component's sources. */
function entryFiles(entry: RegistryEntry): string[] {
  return [entry.file, ...(entry.files ?? [])];
}

function resolveComponent(
  slug: string,
  registry: Registry,
  registryUrl: string,
): { slug: string; entry: RegistryEntry } {
  const entry = registry.components[slug];

  if (!entry) {
    throw new Error(
      `Component "${slug}" not found in registry at ${registryUrl}. Run \`matter-cli list\` to see available components.`,
    );
  }

  return { slug, entry };
}

/** True when the path exists and is a symlink. lstat does not follow links. */
async function isSymbolicLink(filePath: string): Promise<boolean> {
  try {
    return (await lstat(filePath)).isSymbolicLink();
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT')
      return false;
    throw caughtError;
  }
}

/** Equal ignoring line-ending style. */
function sameText(left: string, right: string): boolean {
  return left.replaceAll('\r\n', '\n') === right.replaceAll('\r\n', '\n');
}

/** Current contents of a file, or null when it isn't there yet. */
async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT')
      return null;
    throw caughtError;
  }
}
