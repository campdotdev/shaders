'use client';

// Copy, paste, and duplicate for the canvas: Cmd/Ctrl+C, V, and D. The pure
// halves live in clipboard.ts (narrow a selection to a preset, give a payload
// a fresh identity); this hook owns the keyboard, the system clipboard, and
// putting the pasted subgraph on screen and in the uniform store.
//
// The clipboard carries plain serialized-preset text, not an app-internal
// format — which is what makes paste work across browser tabs for free, and
// means a paste can't trust its input any more than a file import could.
// Anything unparseable is swallowed silently: pasting prose onto the canvas
// should do nothing, not toast an error about JSON.
//
// Duplicate composes the same two pure functions WITHOUT the round trip
// through the system clipboard, so it never clobbers whatever the user
// actually has copied.
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
  // Same pattern as use-editor-history: the keydown listener is registered
  // once, so it reads the current graph through a ref refreshed each render
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

    const paste = async () => {
      // Both the read (permission denied, nothing there) and the parse (any
      // non-preset text) fail to a silent no-op.
      let text: string;

      try {
        text = await navigator.clipboard.readText();
      } catch {
        return;
      }

      try {
        appendPayload(parsePreset(text));
      } catch (error) {
        if (!(error instanceof PresetError)) throw error;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      const key = event.key.toLowerCase();

      if (key !== 'c' && key !== 'v' && key !== 'd') return;
      if (isTextEntry(event.target)) return;

      if (key === 'c') {
        const payload = selectionPayload();

        if (payload === null) return;

        event.preventDefault();
        // Fire-and-forget: a denied clipboard write shouldn't surface here.
        navigator.clipboard.writeText(serializePreset(payload)).catch(() => undefined);

        return;
      }

      if (key === 'v') {
        event.preventDefault();
        void paste();

        return;
      }

      // Cmd/Ctrl+D. Claimed unconditionally (its browser default is
      // "bookmark this page") even when the selection duplicates to nothing.
      event.preventDefault();

      const payload = selectionPayload();

      if (payload !== null) appendPayload(payload);
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [paramStore, setNodes, setEdges]);
}
