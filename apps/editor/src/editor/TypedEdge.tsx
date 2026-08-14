'use client';

// Typed wire with a delete affordance: the stroke color encodes the port type
// (set by the editor when the edge is created); selecting the wire reveals a
// small x button at its midpoint for mouse-only removal — Backspace works too.
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react';
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
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      {selected === true && (
        <EdgeLabelRenderer>
          <button
            aria-label="delete wire"
            className="nodrag nopan"
            onClick={() => deleteElements({ edges: [{ id }] })}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: '1px solid #2c2a38',
              background: '#1e1d27',
              color: '#e8e6f2',
              font: '600 10px/1 ui-monospace, SF Mono, Menlo, monospace',
              cursor: 'pointer',
            }}
            type="button"
          >
            x
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
