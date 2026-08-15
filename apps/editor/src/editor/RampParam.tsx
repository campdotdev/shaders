'use client';

// The Color Ramp card's params-panel editor: one row per stop (a color
// swatch, a position field, a remove button), plus an "+ stop" button.
// MAT-86 gave colorRamp node-driven stops, so a stop's position and color
// ride uniforms (ParamStore.setStopPosition/setStopColor) — dragging either
// glides on the GPU with zero recompiles. Stop COUNT still bakes into the
// compiled mix chain's arity (structuralKeyOf, graph.ts), so adding or
// removing a stop is expected to rebuild; that only happens on the add/remove
// buttons, never mid-drag.
import { parseColorString } from '@lovo/matter/color';

import { ColorInput } from '@/controls/ColorInput';

import { useEditorGraph } from './graph-context';
import type { NumericRange } from './number-field';
import { NumberField } from './NumberField';
import type { ColorStop } from './registry';

const MIN_STOPS = 2;
const MAX_STOPS = 8;

/** A stop's position is a normalized 0-1 dial, two decimals of resolution. */
const POSITION_RANGE: NumericRange = { min: 0, max: 1, step: 0.01 };

export function RampParam({
  nodeId,
  stops,
  onCommit,
}: {
  nodeId: string;
  stops: ColorStop[];
  /** Mirrors the new stops array into node data — CardNode wires this to `setParam('stops', stops)`. */
  onCommit: (stops: ColorStop[]) => void;
}) {
  const { paramStore, commitEdit } = useEditorGraph();

  // This component only ever sees COMMITTED values: NumberField holds its own
  // value mid-scrub, which is what used to require a draft position per stop
  // here (an unrelated re-render would otherwise snap a slider back mid-drag).
  //
  // Every commit — position release, color release, add, or remove — writes
  // ALL current stops' values through the store before touching node data,
  // not just the one that changed. Ramp-stop uniforms are keyed
  // `${nodeId}/stops/${index}` and are never evicted (ParamStore), so
  // removing a stop and then adding one back at the same index would
  // otherwise hand back a STALE uniform still holding the old value (found in
  // the Task 8 review). Rewriting every index on every commit makes that
  // self-heal: whatever index a uniform lives at always gets the value that
  // belongs there.
  const commit = (nextStops: ColorStop[]) => {
    nextStops.forEach((stop, index) => {
      paramStore.setStopPosition(nodeId, index, stop.position);
      paramStore.setStopColor(nodeId, index, parseColorString(stop.color));
    });
    onCommit(nextStops);
    // One undo step per released gesture, not per frame of the drag. Adding
    // or removing a stop moves the structural key and so records itself too;
    // that lands as one entry, not two, because the second snapshot through
    // is identical (see use-editor-history.ts).
    commitEdit();
  };

  const handlePositionPreview = (index: number, value: number) => {
    paramStore.setStopPosition(nodeId, index, value);
  };

  const handlePositionCommit = (index: number, value: number) => {
    commit(stops.map((stop, i) => (i === index ? { ...stop, position: value } : stop)));
  };

  const handleColorChange = (index: number, colorString: string) => {
    paramStore.setStopColor(nodeId, index, parseColorString(colorString));
  };

  const handleColorCommit = (index: number, colorString: string) => {
    commit(stops.map((stop, i) => (i === index ? { ...stop, color: colorString } : stop)));
  };

  const addStop = () => {
    if (stops.length >= MAX_STOPS) return;

    const lastColor = stops[stops.length - 1]?.color ?? '#ffffff';

    commit([...stops, { color: lastColor, position: 1 }]);
  };

  const removeStop = (index: number) => {
    if (stops.length <= MIN_STOPS) return;

    commit(stops.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {stops.map((stop, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ColorInput
            label={`stop ${index + 1}`}
            onChange={(value) => handleColorChange(index, value)}
            onCommit={(value) => handleColorCommit(index, value)}
            value={stop.color}
          />
          <div style={{ flex: 1 }}>
            <NumberField
              label={`stop ${index + 1} position`}
              onChange={(next) => handlePositionPreview(index, next)}
              onCommit={(next) => handlePositionCommit(index, next)}
              range={POSITION_RANGE}
              value={stop.position}
            />
          </div>
          <button
            aria-label={`remove stop ${index + 1}`}
            className="nodrag"
            disabled={stops.length <= MIN_STOPS}
            onClick={() => removeStop(index)}
            style={{
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              borderRadius: '50%',
              border: '1px solid #2c2a38',
              background: '#14131b',
              color: '#e8e6f2',
              font: '600 10px/1 ui-monospace, SF Mono, Menlo, monospace',
              cursor: stops.length <= MIN_STOPS ? 'default' : 'pointer',
              opacity: stops.length <= MIN_STOPS ? 0.4 : 1,
            }}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="nodrag"
        disabled={stops.length >= MAX_STOPS}
        onClick={addStop}
        style={{
          padding: '3px 5px',
          background: '#14131b',
          border: '1px solid #2c2a38',
          borderRadius: 5,
          color: '#e8e6f2',
          font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
          cursor: stops.length >= MAX_STOPS ? 'default' : 'pointer',
          opacity: stops.length >= MAX_STOPS ? 0.4 : 1,
        }}
        type="button"
      >
        + stop
      </button>
    </div>
  );
}
