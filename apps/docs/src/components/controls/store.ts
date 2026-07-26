/**
 * The state backing a demo page's control panel. Holds one params object and
 * hands out reads/writes addressed by path ('lines.3.colors.0'), so each
 * control can subscribe to just its own field instead of the whole object.
 * Writes rebuild only the objects along the path (see writeAtPath below) —
 * untouched siblings keep their identity, so React skips re-rendering the
 * controls bound to them.
 */

export type PathSegment = string | number;
export type ControlPath = readonly PathSegment[];
export type PathInput = string | ControlPath;

export interface ControlStore<TParams extends object> {
  getSnapshot: () => TParams;
  subscribe: (listener: () => void) => () => void;
  getAtPath: (path: ControlPath) => unknown;
  setAtPath: (path: ControlPath, value: unknown) => void;
  reset: () => void;
}

// -------------------------------------------------
// Paths
// -------------------------------------------------

/**
 * Accepts either the dotted string form used in JSX ('center.0') or an explicit
 * segment array. All-digit segments become numbers so they index arrays rather
 * than adding a '0' key to them.
 */
export function normalizePath(path: PathInput): ControlPath {
  if (typeof path !== 'string') return path;

  return path
    .split('.')
    .filter((segment) => segment.length > 0)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

const describePath = (path: ControlPath) => path.join('.');

// -------------------------------------------------
// Reading and writing by path
// -------------------------------------------------

function readAtPath(root: unknown, path: ControlPath): unknown {
  let cursor = root;

  for (const segment of path) {
    if (cursor === null || typeof cursor !== 'object') {
      throw new Error(
        `Control path "${describePath(path)}" hit a non-object at "${String(segment)}".`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- path segments are arbitrary keys into caller-shaped data; the object check above is all the narrowing TS can verify
    cursor = (cursor as Record<PathSegment, unknown>)[segment];
  }

  if (cursor === undefined) {
    throw new Error(`Control path "${describePath(path)}" resolved to undefined.`);
  }

  return cursor;
}

/**
 * Returns a copy of `target` with `value` written at `path`, sharing every
 * branch the path doesn't touch. Recursion bottoms out when the path is empty,
 * at which point the value replaces whatever was there.
 *
 * The recursion below shrinks to `rest` of the path on each call, but error
 * messages always read `path` — the full, original path captured by this
 * closure — so a bad segment three levels deep still names the whole path,
 * not just the tail the recursion had left to walk.
 */
function writeAtPath(target: unknown, path: ControlPath, value: unknown): unknown {
  function write(current: unknown, remaining: ControlPath): unknown {
    const [head, ...rest] = remaining;

    if (head === undefined) return value;

    if (Array.isArray(current)) {
      const index = Number(head);

      // Number('') and Number of a non-digit key both produce NaN, and
      // `next[NaN] = ...` silently sets a non-index property that array
      // spread and iteration never see again — the write would vanish with
      // no error instead of throwing like every other bad-path case here.
      if (!Number.isInteger(index)) {
        throw new Error(
          `Control path "${describePath(path)}" hit a non-index array key at "${String(head)}".`,
        );
      }

      const next = [...(current as unknown[])];

      next[index] = write(next[index], rest);

      return next;
    }

    if (current === null || typeof current !== 'object') {
      throw new Error(
        `Control path "${describePath(path)}" hit a non-object at "${String(head)}".`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- non-array objects are keyed by arbitrary strings here; the non-object check above is all the narrowing TS can verify
    const record = current as Record<string, unknown>;

    return { ...record, [String(head)]: write(record[String(head)], rest) };
  }

  return write(target, path);
}

// -------------------------------------------------
// Factory
// -------------------------------------------------

export function createControlStore<TParams extends object>(
  initial: TParams,
): ControlStore<TParams> {
  const pristine = structuredClone(initial);
  const listeners = new Set<() => void>();

  let snapshot: TParams = structuredClone(initial);

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,

    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getAtPath: (path) => readAtPath(snapshot, path),

    setAtPath: (path, value) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- writeAtPath preserves the input's shape; it returns unknown only because it also recurses into untyped branches
      snapshot = writeAtPath(snapshot, path, value) as TParams;
      emit();
    },

    reset: () => {
      snapshot = structuredClone(pristine);
      emit();
    },
  };
}
