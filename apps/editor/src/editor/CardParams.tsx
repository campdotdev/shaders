// The expanded params panel for a card: a row per param — a ramp editor for
// colorRamp's stops, otherwise a label/slider-or-select/value grid row.
// CardNode renders this only while a card is selected, undragged, and its
// `open` node-data flag is true; CardNode still owns `setParam` (it's the
// one place that writes node data) and passes it down here. Split out of
// CardNode.tsx (MAT-94 Task 11.5) so the card shell stays under the
// 300-line bar.
import { rampStopsOf } from './graph';
import { RampParam } from './RampParam';
import type { ParamSpec, ParamValue, SpecId } from './registry';

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

        return (
          <label
            key={param.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '46px 1fr 32px',
              gap: 8,
              alignItems: 'center',
              font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
              color: '#8b88a0',
            }}
          >
            {param.label}
            {param.kind === 'slider' ? (
              // "nodrag" tells React Flow a drag here moves the slider,
              // not the card.
              <input
                className="nodrag"
                max={param.max}
                min={param.min}
                onChange={(event) => setParam(param.id, Number(event.target.value))}
                step={param.step}
                style={{ width: '100%', accentColor: '#a78bfa' }}
                type="range"
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
            <span style={{ textAlign: 'right', color: '#e8e6f2' }}>
              {param.kind === 'slider'
                ? Number(params[param.id] ?? param.defaultValue).toFixed(param.step < 1 ? 2 : 0)
                : ''}
            </span>
          </label>
        );
      })}
    </div>
  );
}
