// The expanded params panel for a card: a row per param — a ramp editor for
// colorRamp's stops, otherwise a label/slider-or-select/value grid row.
// CardNode renders this only while a card is selected, undragged, and its
// `open` node-data flag is true; CardNode still owns `setParam` (it's the
// one place that writes node data) and passes it down here. Split out of
// CardNode.tsx (MAT-94 Task 11.5) so the card shell stays under the
// 300-line bar.
import { parseColorString } from '@lovo/matter/color';

import { ColorInput } from '@/controls/ColorInput';
import { colorParamOf, rampStopsOf } from '@/editor/graph/graph';
import type { ParamSpec, ParamValue, SpecId } from '@/editor/graph/registry';
import { xyKeysOf } from '@/editor/graph/registry';
import { NumberField } from '@/editor/params/NumberField';
import { RampParam } from '@/editor/params/RampParam';
import { useEditorGraph } from '@/editor/state/graph-context';

/** Narrows a param's stored value to a string for the <select> it backs,
    falling back to the spec default. The stored value's declared type is the
    shared ParamValue union (numbers and ramps included), even though a
    select param only ever actually holds a string. */
function selectValueOf(value: ParamValue | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function CardParams({
  nodeId,
  params,
  paramSpecs,
  setParam,
  specId,
}: {
  nodeId: string;
  params: Record<string, ParamValue>;
  paramSpecs: ParamSpec[];
  setParam: (paramId: string, value: ParamValue) => void;
  specId: SpecId;
}) {
  const { commitEdit, paramStore } = useEditorGraph();

  return (
    // Clicks inside the panel are adjustments, not toggles — stop them
    // from bubbling to the card's open/close handler.
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        borderTop: '1px solid #2c2a38',
        padding: '9px 10px 11px',
        display: 'grid',
        gap: 9,
      }}
    >
      {paramSpecs.map((param) => {
        // Ramp params (Color Ramp's stops) get their own row-per-stop
        // editor instead of the label/slider/value grid below — a ramp
        // doesn't fit that three-column shape.
        if (param.kind === 'ramp') {
          return (
            <RampParam
              key={param.id}
              nodeId={nodeId}
              onCommit={(stops) => setParam(param.id, stops)}
              stops={rampStopsOf({ id: nodeId, params, spec: specId }, param.id)}
            />
          );
        }

        // A color param follows RampParam's preview/commit split: every pick
        // mid-drag writes the vec3 uniform (free on the GPU, no rebuild —
        // color params stay out of the structural key), and only the released
        // gesture mirrors the string into node data and records an undo step.
        if (param.kind === 'color') {
          return (
            <label
              key={param.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '46px 1fr',
                gap: 8,
                alignItems: 'center',
                font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
                color: '#8b88a0',
              }}
            >
              {param.label}
              <ColorInput
                label={param.label}
                onChange={(value) => paramStore.setColor(nodeId, param.id, parseColorString(value))}
                onCommit={(value) => {
                  paramStore.setColor(nodeId, param.id, parseColorString(value));
                  setParam(param.id, value);
                  commitEdit();
                }}
                value={colorParamOf({ id: nodeId, params, spec: specId }, param.id)}
              />
            </label>
          );
        }

        // An xy param renders as one labeled row with an x and a y field.
        // Each axis is an ordinary number param under its storage key
        // (`center.x`), so setParam's number fast path writes the scalar
        // uniform exactly like a slider's.
        if (param.kind === 'xy') {
          return (
            <label
              key={param.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '46px 1fr 1fr',
                gap: 8,
                alignItems: 'center',
                font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
                color: '#8b88a0',
              }}
            >
              {param.label}
              {xyKeysOf(param.id).map((key, axis) => (
                <NumberField
                  key={key}
                  label={`${param.label} ${axis === 0 ? 'x' : 'y'}`}
                  onChange={(next) => setParam(key, next)}
                  onCommit={commitEdit}
                  range={param}
                  value={Number(params[key] ?? param.defaultValue[axis])}
                />
              ))}
            </label>
          );
        }

        return (
          <label
            key={param.id}
            style={{
              display: 'grid',
              // Two columns, not three: NumberField shows its own value, so
              // the separate readout the slider needed is gone.
              gridTemplateColumns: '46px 1fr',
              gap: 8,
              alignItems: 'center',
              font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
              color: '#8b88a0',
            }}
          >
            {param.label}
            {param.kind === 'slider' ? (
              // Every scrub tick writes the uniform (free on the GPU); only
              // the finished gesture records an undo step, so a whole drag
              // collapses to one entry.
              <NumberField
                label={param.label}
                onChange={(next) => setParam(param.id, next)}
                onCommit={commitEdit}
                range={param}
                value={Number(params[param.id] ?? param.defaultValue)}
              />
            ) : (
              <select
                className="nodrag"
                onChange={(event) => setParam(param.id, event.target.value)}
                style={{
                  background: '#14131b',
                  border: '1px solid #2c2a38',
                  borderRadius: 5,
                  color: '#e8e6f2',
                  font: 'inherit',
                  padding: '3px 5px',
                }}
                value={selectValueOf(params[param.id], param.defaultValue)}
              >
                {param.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
          </label>
        );
      })}
    </div>
  );
}
