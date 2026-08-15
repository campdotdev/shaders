'use client';

// Undo/redo for the canvas. history.ts owns the two stacks and knows nothing
// about the editor; this hook owns the harder half — deciding WHEN a change
// is worth an undo step, and putting a restored snapshot back on screen AND
// on the GPU.
//
// Two record points cover every edit:
//
//   * a structural change (add, delete, rewire, a select param, a ramp's stop
//     count) records the moment it lands, because `structuralKey` changes;
//   * everything else — slider drags, ramp color and position drags, card
//     moves — records on RELEASE, via `commitEdit`.
//
// That split is what makes a 20-tick slider drag one undo step instead of
// twenty: the dragged value rides a uniform and never touches the structural
// key, so nothing records until the pointer comes up.
//
// `commitEdit` deliberately bumps a counter instead of recording inline. A
// caller like RampParam writes node data and commits in the same handler, and
// React hasn't flushed that write yet when the handler returns — recording
// there would snapshot the PREVIOUS state. Routing through state means the
// record effect runs after the flush, with the node data the user actually
// just committed.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Edge } from '@xyflow/react';

import type { CardNodeType } from './CardNode';
import { flowFromPreset, presetFromFlow, pushPresetToStore } from './flow-preset';
import { History } from './history';
import type { ParamStore } from './param-store';
import { parsePreset, serializePreset } from './preset';
import type { Preset } from './preset';

/** Input types where the browser's own undo stack should win — typing in a
    hex field and hitting Cmd+Z means "undo my typing", not "undo my graph".
    Selects are deliberately absent: they have no native undo, and one often
    holds focus right after the edit you want to undo. */
const TEXT_ENTRY_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']);

/**
 * Whether a keystroke landed somewhere the browser's own undo should handle.
 *
 * `readOnly` is the load-bearing check: NumberField is a `type="text"` input
 * that is read-only except while actually being typed into, and it keeps
 * focus after you commit a value with Enter. Without the readOnly test, every
 * Cmd+Z immediately after typing a dial value would be swallowed here — there
 * is no native undo stack on a field you can't type into.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;

  return !target.readOnly && TEXT_ENTRY_TYPES.has(target.type);
}

export function useEditorHistory({
  nodes,
  edges,
  setNodes,
  setEdges,
  paramStore,
  structuralKey,
}: {
  nodes: CardNodeType[];
  edges: Edge[];
  setNodes: (nodes: CardNodeType[]) => void;
  setEdges: (edges: Edge[]) => void;
  paramStore: ParamStore;
  /** Fingerprint of what's compiled in (graph.ts) — the structural trigger. */
  structuralKey: string;
}): { commitEdit: () => void; applyPreset: (preset: Preset) => void } {
  // The record effects fire on a structural or commit signal, never on every
  // render, so they can't close over `nodes`/`edges` directly without going
  // stale. This ref is the current graph, refreshed after each render by the
  // effect below — which is declared FIRST on purpose, since effects run in
  // declaration order and the record effects below must see fresh values.
  const latestGraph = useRef({ nodes, edges });

  useEffect(() => {
    latestGraph.current = { nodes, edges };
  });

  const snapshot = useCallback(
    () => serializePreset(presetFromFlow(latestGraph.current.nodes, latestGraph.current.edges)),
    [],
  );

  // Seeded from the first render's graph (the starter graph), so the very
  // first undo lands on a canvas the user has actually seen.
  const history = useMemo(() => new History(snapshot()), [snapshot]);

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  // A commit is pending until its change is actually visible in the graph —
  // see the effect below for why that isn't the same render it was requested on.
  const pendingCommit = useRef(false);
  // Only ever written: bumping it guarantees at least one render after a
  // commit, so the effect below gets a chance to run even when the committing
  // gesture changed nothing else.
  const [, setCommitTick] = useState(0);

  /** Records one undo step for the edit that just landed. Safe to call when
      nothing actually changed — an identical snapshot is dropped. */
  const commitEdit = useCallback(() => {
    pendingCommit.current = true;
    setCommitTick((tick) => tick + 1);
  }, []);

  // Structural edits record as soon as they land: by the time this effect
  // runs, the change that moved the key is on `nodes` by definition. The
  // mount run is dropped because the snapshot still equals the one History
  // was seeded with.
  useEffect(() => {
    history.record(snapshot());
  }, [structuralKey, history, snapshot]);

  // Committed gestures. NO dep array on purpose: `commitEdit` can fire in the
  // same event as the write it belongs to — typing a dial value changes the
  // param and commits in one keystroke — and the new node data is not
  // guaranteed to be readable on the render that keystroke triggers. Snapshot
  // equal to `present` therefore means "not visible yet, try again", not
  // "nothing changed", so the pending flag survives to the next render. A
  // scrub happens to be immune (its value writes land in earlier pointermove
  // events) which is exactly why this was invisible until typing existed.
  //
  // The early return keeps this cheap: no pending commit, no serialization,
  // even though the effect itself runs after every render.
  useEffect(() => {
    if (!pendingCommit.current) return;

    const committed = snapshot();

    if (committed === history.present) return;

    pendingCommit.current = false;
    history.record(committed);
  });

  // ---------------------------------------------------------------------------
  // Restoring
  // ---------------------------------------------------------------------------

  // Rebuilds the canvas from a snapshot: React state for what's on screen,
  // then the uniform store for what the GPU reads (see pushPresetToStore —
  // without it an undo would restore the panel and leave the render alone).
  //
  // Nothing here suppresses the record effects, and nothing needs to: the
  // restored canvas re-serializes to the snapshot History already holds as
  // `present`, so the record they fire is dropped as identical. That's why
  // flow-preset's round-trip fidelity is load-bearing — an adapter that lost
  // a field would turn every undo into a new history entry and break redo.
  const applyPreset = useCallback(
    (preset: Preset) => {
      const restored = flowFromPreset(preset);

      // Selection and the params panel's open flag are runtime-only, so a
      // preset can't carry them — but dropping them would shut the panel the
      // user is mid-adjustment in, hiding the very value they just undid.
      // Carry them across by id for cards that survived. Neither field is read
      // by presetFromFlow, so this can't disturb the round-trip identity the
      // record effects depend on.
      const liveById = new Map(latestGraph.current.nodes.map((node) => [node.id, node]));

      const nextNodes = restored.nodes.map((node) => {
        const live = liveById.get(node.id);

        if (live === undefined) return node;

        return { ...node, selected: live.selected, data: { ...node.data, open: live.data.open } };
      });

      pushPresetToStore(preset, paramStore);
      setNodes(nextNodes);
      setEdges(restored.edges);
    },
    [paramStore, setNodes, setEdges],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if (isTextEntry(event.target)) return;

      // Claimed even at the ends of the stack, so a no-op undo doesn't fall
      // through to the browser's own history handling.
      event.preventDefault();

      const restored = event.shiftKey ? history.redo() : history.undo();

      if (restored !== null) {
        applyPreset(parsePreset(restored));
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [applyPreset, history]);

  // applyPreset is exposed for the loads that arrive from OUTSIDE the
  // history — a share-link hash, a file import. Those callers follow it with
  // commitEdit(), which records the load as one undoable step even when the
  // structural key happens not to move (same wiring, different values).
  return { commitEdit, applyPreset };
}
