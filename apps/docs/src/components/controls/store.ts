/**
 * The state backing a demo page's control panel. Holds one params object and
 * hands out reads addressed by path ('lines.3.colors.0'), so each control can
 * subscribe to just its own field instead of the whole object.
 *
 * Writes rebuild only the objects along the path — see writeAtPath below. That
 * structural sharing is what makes the subscription granularity real: untouched
 * siblings keep their identity, so React skips re-rendering the controls bound
 * to them. Without it, every control re-renders on every keystroke and the
 * whole reason for not using Context disappears.
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
 */
function writeAtPath(target: unknown, path: ControlPath, value: unknown): unknown {
  const [head, ...rest] = path;

  if (head === undefined) return value;

  if (Array.isArray(target)) {
    const index = Number(head);
    const next = [...(target as unknown[])];

    next[index] = writeAtPath(next[index], rest, value);

    return next;
  }

  if (target === null || typeof target !== 'object') {
    throw new Error(`Control path "${describePath(path)}" hit a non-object at "${String(head)}".`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- non-array objects are keyed by arbitrary strings here; the non-object check above is all the narrowing TS can verify
  const record = target as Record<string, unknown>;

  return { ...record, [String(head)]: writeAtPath(record[String(head)], rest, value) };
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
