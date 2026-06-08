import { access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export async function findProjectRoot(fromPath: string): Promise<string> {
  let dir = dirname(resolve(fromPath))

  // Guard against infinite loops on root (dirname('/') === '/').
  for (;;) {
    try {
      await access(`${dir}/package.json`)

      return dir
    } catch {
      const parent = dirname(dir)

      if (parent === dir) {
        throw new Error(
          `Could not find a package.json walking up from ${fromPath}. Poster needs a project root to resolve dependencies against.`,
        )
      }
      dir = parent
    }
  }
}
