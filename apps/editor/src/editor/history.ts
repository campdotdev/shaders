// Undo/redo for the editor canvas. Snapshots are opaque serialized presets --
// this module never parses or inspects them, it only stores and moves
// strings between two stacks. Deciding WHEN to call record() (e.g.
// coalescing a slider drag into a single entry, recording immediately on a
// structural edit) is entirely the caller's job, wired up in Task 12; this
// class only enforces identity-skip, the entry cap, and redo-clearing.

/**
 * A two-stack undo history over opaque string snapshots.
 *
 * `past` holds older snapshots (oldest first), `future` holds snapshots
 * undone away from `present` (nearest-to-present last, so both stacks pop
 * from their tail). `present` isn't itself part of the cap -- `limit` counts
 * UNDOABLE states, so `past.length` never exceeds `limit`; a `record()` that
 * would push past that cap evicts from the oldest end of `past` first.
 */
export class History {
  private readonly limit: number;
  private readonly past: string[] = [];
  private readonly future: string[] = [];
  private currentSnapshot: string;

  constructor(initial: string, limit = 100) {
    // Clamp to at least 1 so the eviction loop in record() always has room
    // to push before it trims, instead of spinning on an ever-empty past.
    this.limit = Math.max(1, limit);
    this.currentSnapshot = initial;
  }

  /** The current snapshot. */
  get present(): string {
    return this.currentSnapshot;
  }

  /**
   * Adds a new snapshot as present, pushing the old present onto `past`.
   * A no-op when `next` is identical to `present` -- callers that fire on
   * every keystroke or drag frame don't need to pre-filter. Deliberately
   * leaves `future` untouched on that no-op path: an unchanged present
   * hasn't branched history, so anything still ahead should stay redoable.
   * A real record always clears `future`: once history branches from a
   * point in the past, the old "ahead" path is gone.
   */
  record(next: string): void {
    if (next === this.currentSnapshot) {
      return;
    }
    this.past.push(this.currentSnapshot);
    this.future.length = 0;
    this.currentSnapshot = next;

    // Evict the oldest snapshot once past would exceed the cap. Only ever
    // one over per call, since record() adds exactly one entry to `past`.
    while (this.past.length > this.limit) {
      this.past.shift();
    }
  }

  /** Moves one step back. Returns the new present, or null at the bottom. */
  undo(): string | null {
    const previous = this.past.pop();

    if (previous === undefined) {
      return null;
    }
    this.future.push(this.currentSnapshot);
    this.currentSnapshot = previous;

    return this.currentSnapshot;
  }

  /** Moves one step forward. Returns the new present, or null at the top. */
  redo(): string | null {
    const next = this.future.pop();

    if (next === undefined) {
      return null;
    }
    this.past.push(this.currentSnapshot);
    this.currentSnapshot = next;

    return this.currentSnapshot;
  }
}
