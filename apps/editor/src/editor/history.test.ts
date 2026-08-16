import { describe, expect, it } from 'vitest';

import { History } from './history';

describe('History', () => {
  it('starts with the initial snapshot as present', () => {
    const history = new History('a');

    expect(history.present).toBe('a');
  });

  it('records a sequence and undoes/redoes back through it', () => {
    const history = new History('a');

    history.record('b');
    history.record('c');
    expect(history.present).toBe('c');

    expect(history.undo()).toBe('b');
    expect(history.present).toBe('b');
    expect(history.undo()).toBe('a');
    expect(history.present).toBe('a');

    expect(history.redo()).toBe('b');
    expect(history.present).toBe('b');
    expect(history.redo()).toBe('c');
    expect(history.present).toBe('c');
  });

  it('adds no entry when recording a snapshot identical to present', () => {
    const history = new History('a');

    history.record('b');
    history.record('b');
    history.record('b');
    expect(history.present).toBe('b');

    // Only one real entry ('a') should sit below 'b' -- undo skips straight
    // past the duplicate no-ops to the last distinct snapshot.
    expect(history.undo()).toBe('a');
    expect(history.undo()).toBeNull();
  });

  it('preserves redoable future when recording a snapshot identical to present', () => {
    const history = new History('a');

    history.record('b');
    history.undo();
    expect(history.present).toBe('a');

    // The no-op record path must leave `future` alone: an unchanged present
    // hasn't branched history, so 'b' should stay reachable through redo.
    history.record('a');
    expect(history.redo()).toBe('b');
  });

  it('clears redo when a new record follows an undo', () => {
    const history = new History('a');

    history.record('b');
    history.record('c');
    history.undo();
    expect(history.present).toBe('b');

    history.record('d');
    expect(history.present).toBe('d');
    expect(history.redo()).toBeNull();

    expect(history.undo()).toBe('b');
    expect(history.present).toBe('b');
  });

  it('caps at the newest 100 undoable states after 120 records', () => {
    const history = new History('seed');

    for (let index = 1; index <= 120; index += 1) {
      history.record(`entry-${index}`);
    }
    expect(history.present).toBe('entry-120');

    let undoCount = 0;

    while (history.undo() !== null) {
      undoCount += 1;
    }
    // `limit` counts undoable states, not present -- 100 records survive
    // in `past`, so exactly 100 undo steps land below the final present
    // value before the 101st returns null.
    expect(undoCount).toBe(100);
    expect(history.present).toBe('entry-20');
  });

  it('returns null and leaves present unchanged when undoing at the bottom', () => {
    const history = new History('a');

    expect(history.undo()).toBeNull();
    expect(history.present).toBe('a');
  });

  it('returns null and leaves present unchanged when redoing at the top', () => {
    const history = new History('a');

    history.record('b');
    expect(history.redo()).toBeNull();
    expect(history.present).toBe('b');
  });

  it('respects a custom limit', () => {
    const history = new History('seed', 3);

    history.record('a');
    history.record('b');
    history.record('c');
    expect(history.present).toBe('c');

    let undoCount = 0;

    while (history.undo() !== null) {
      undoCount += 1;
    }
    // limit of 3 undoable states: exactly 3 records fit without eviction,
    // so all 3 undo steps succeed, bottoming out at the initial snapshot.
    expect(undoCount).toBe(3);
    expect(history.present).toBe('seed');
  });

  it('clamps a non-positive limit to at least 1 instead of hanging', () => {
    const history = new History('a', 0);

    history.record('b');
    expect(history.present).toBe('b');
    expect(history.undo()).toBe('a');
    expect(history.undo()).toBeNull();
  });
});
