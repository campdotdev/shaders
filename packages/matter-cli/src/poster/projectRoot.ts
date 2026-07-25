import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * Nearest package.json above the user's source file = their project root.
 * The poster pipeline resolves everything against it: esbuild pulls the
 * component's dependencies from the USER's node_modules (their react, their
 * @lovo/matter), and playwright is looked up there too.
 */
export async function findProjectRoot(fromPath: string): Promise<string> {
  let dir = dirname(resolve(fromPath));

  // Guard against infinite loops on root (dirname('/') === '/').
  for (;;) {
    try {
      await access(`${dir}/package.json`);

      return dir;
    } catch {
      const parent = dirname(dir);

      if (parent === dir) {
        throw new Error(
          `Could not find a package.json walking up from ${fromPath}. Poster needs a project root to resolve dependencies against.`,
        );
      }
      dir = parent;
    }
  }
}
