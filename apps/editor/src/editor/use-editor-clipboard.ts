'use client';

// Copy, paste, and duplicate for the canvas. The pure halves live in
// clipboard.ts (narrow a selection to a preset, give a payload a fresh
// identity); this hook owns the events, and putting the pasted subgraph on
// screen and in the uniform store.
//
// Copy and paste ride the browser's native ClipboardEvents — the `copy` and
// `paste` events Cmd/Ctrl+C and V fire — NOT the async navigator.clipboard
// API. The distinction is load-bearing: the async API sits behind a
// permission prompt in real Chrome (and stricter still in Safari), so a
// first paste would silently no-op unless the user noticed and approved a
// popup. The event path needs no permission at all, because the browser
// knows it's user-initiated. Headless tests granted the async API its
// permission automatically, which is exactly how the broken version passed
// CI while failing on a desk.
//
// The payload is plain serialized-preset text, so paste works across browser
// tabs (and via a text file, chat message, ...) for free — and means a paste
// can't trust its input any more than a file import could. Anything
// unparseable is swallowed silently: pasting prose onto the canvas should do
// nothing, not toast an error about JSON.
//
// Duplicate (Cmd/Ctrl+D) composes the same two pure functions WITHOUT the
// clipboard, so it never clobbers what the user actually has copied.
//
// History needs no wiring here: appending cards moves the structural key,
// and the record effect in use-editor-history fires on that — a paste is one
// undo step because it lands in one setNodes.
import { useEffect, useRef } from 'react';

import type { Edge } from '@xyflow/react';

import type { CardNodeType } from './CardNode';
import { remapForPaste, selectionToPreset } from './clipboard';
import { flowFromPreset, presetFromFlow, pushPresetToStore } from './flow-preset';
import type { ParamStore } from './param-store';
import { parsePreset, PresetError, presetFrom, serializePreset } from './preset';
import type { Preset } from './preset';
import { isTextEntry } from './use-editor-history';

export function useEditorClipboard({
  nodes,
  edges,
  setNodes,
  setEdges,
  paramStore,
}: {
  nodes: CardNodeType[];
  edges: Edge[];
  setNodes: (nodes: CardNodeType[]) => void;
  setEdges: (edges: Edge[]) => void;
  paramStore: ParamStore;
}): void {
  // Same pattern as use-editor-history: the listeners are registered once,
  // so they read the current graph through a ref refreshed each render
  // instead of closing over state that would go stale.
  const latestGraph = useRef({ nodes, edges });

  useEffect(() => {
    latestGraph.current = { nodes, edges };
  });

  useEffect(() => {
    /** The selected subgraph as a paste-able payload, or null when the
        selection copies down to nothing (empty, or only the Output card —
        selectionToPreset drops Output, it being a singleton). */
    const selectionPayload = (): Preset | null => {
      const { nodes: liveNodes, edges: liveEdges } = latestGraph.current;
      const selectedIds = new Set(
        liveNodes.filter((node) => node.selected === true).map((node) => node.id),
      );

      if (selectedIds.size === 0) return null;

      const preset = presetFromFlow(liveNodes, liveEdges);
      const payload = selectionToPreset(preset.nodes, preset.edges, selectedIds);

      return payload.nodes.length === 0 ? null : payload;
    };

    /** Remaps a payload clear of every live id and appends it: on screen
        (selected, replacing the old selection — the pasted cards are what
        you're now holding), and in the uniform store (a fresh id has no
        uniforms yet; without the seed the new card would render defaults
        while its panel showed the copied values). */
    const appendPayload = (payload: Preset) => {
      const { nodes: liveNodes, edges: liveEdges } = latestGraph.current;
      const takenIds = new Set(liveNodes.map((node) => node.id));
      const remapped = remapForPaste(payload, takenIds);

      if (remapped.nodes.length === 0) return;

      const preset = presetFrom(remapped.nodes, remapped.edges);
      const added = flowFromPreset(preset);

      pushPresetToStore(preset, paramStore);
      setNodes([
        ...liveNodes.map((node) => (node.selected === true ? { ...node, selected: false } : node)),
        ...added.nodes.map((node) => ({ ...node, selected: true })),
      ]);
      setEdges([...liveEdges, ...added.edges]);
    };

    const onCopy = (event: ClipboardEvent) => {
      // In a text field, Cmd+C means "copy my text" — the browser's default.
      if (isTextEntry(event.target)) return;

      const payload = selectionPayload();

      if (payload === null || event.clipboardData === null) return;

      // preventDefault is what makes setData stick: without it the browser
      // follows through with its own (empty) copy and clobbers the payload.
      event.preventDefault();
      event.clipboardData.setData('text/plain', serializePreset(payload));
    };

    const onPaste = (event: ClipboardEvent) => {
      if (isTextEntry(event.target)) return;

      const text = event.clipboardData?.getData('text/plain');

      if (text === undefined || text === '') return;

      event.preventDefault();

      try {
        appendPayload(parsePreset(text));
      } catch (error) {
        if (!(error instanceof PresetError)) throw error;
      }
    };

    // Duplicate has no native event, so it stays on keydown.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== 'd') return;
      if (isTextEntry(event.target)) return;

      // Claimed unconditionally (the browser default is "bookmark this
      // page") even when the selection duplicates to nothing.
      event.preventDefault();

      const payload = selectionPayload();

      if (payload !== null) appendPayload(payload);
    };

    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [paramStore, setNodes, setEdges]);
}
