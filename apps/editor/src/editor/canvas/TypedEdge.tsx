'use client';

// Typed wire: the stroke color encodes the port type (set by the editor when
// the edge is created — see typedEdge in flow-preset.ts), and the `typed`
// type name is what selecting a wire keys its glow styling on (Editor.tsx).
// Removal is keyboard-only by design: select and hit Backspace/Delete/x. A
// midpoint x button was tried and cut — the keyboard already covers it, and
// the button read as clutter on every selected wire.
import { BaseEdge, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

export function TypedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return <BaseEdge id={id} path={path} style={style} />;
}
