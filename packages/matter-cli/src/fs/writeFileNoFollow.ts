// Writing a component source into a user's project must never follow a
// symbolic link: the link could point anywhere, and `add` would happily create
// or overwrite a file outside the project.
//
// `add` already lstats every target and refuses links up front. That check is
// necessary but not sufficient on its own — a check followed by a write is two
// operations, and nothing stops the path being swapped for a link in between.
// O_NOFOLLOW moves the refusal into the open() itself, so there is no window
// between deciding and doing.
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

// O_NOFOLLOW is POSIX. Windows has no equivalent and leaves it undefined at
// runtime, so there the flag contributes nothing and the caller's lstat check
// stands alone. @types/node declares it as always present, which is why the
// cast is needed to narrow it back to what actually ships.
const NO_FOLLOW = (constants.O_NOFOLLOW as number | undefined) ?? 0;
const WRITE_FLAGS = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | NO_FOLLOW;

/**
 * Write `contents` to `filePath`, truncating an existing regular file, and
 * refuse outright if the path is a symbolic link.
 */
export async function writeFileNoFollow(filePath: string, contents: string): Promise<void> {
  let handle;

  try {
    handle = await open(filePath, WRITE_FLAGS);
  } catch (caughtError) {
    // ELOOP is what O_NOFOLLOW reports for a link. Restate it in the same terms
    // as the up-front check rather than surfacing the raw errno.
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ELOOP') {
      throw new Error(`${filePath} is a symbolic link. Refusing to write through it.`);
    }
    throw caughtError;
  }

  try {
    await handle.writeFile(contents, 'utf-8');
  } finally {
    await handle.close();
  }
}
