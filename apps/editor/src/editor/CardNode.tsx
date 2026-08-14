// The custom React Flow node: a compact chip — name, stage tag, typed ports —
// that expands in place to show its params while selected. Per-node previews
// were tried and cut (macro nodes with everyday names are legible without
// them). The Output card is the exception: its face is a live ShaderScene
// showing the compiled result, because seeing the result is Output's entire
// job. Every non-Output card also wears a subtle wash of its stage's color
// (generate/effect/color/adjust) so the canvas reads left-to-right as a
// pipeline at a glance, the way the concept mock does.
import type { CSSProperties } from 'react';

import { Handle, Position, useConnection, useReactFlow } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';

import { rampStopsOf } from './graph';
import { useEditorGraph } from './graph-context';
import { OutputPreview } from './OutputPreview';
import { RampParam } from './RampParam';
import { NODE_SPECS, PORT_COLORS, portsCompatible, STAGE_COLORS } from './registry';
import type { ParamValue, PortType, SpecId, Stage } from './registry';

export type CardNodeType = Node<
  {
    spec: SpecId;
    params: Record<string, ParamValue>;
    /** Whether the params panel is expanded. Lives in node data (not local
        state) so the editor's drag and selection handlers can close it. */
    open?: boolean;
  },
  'card'
>;

const CARD_WIDTH = 150;
const OUTPUT_WIDTH = 190;
const OUTPUT_PREVIEW_HEIGHT = 200;
const EXPANDED_WIDTH = 200;
const RAMP_WIDTH = 240;

// Ports live in a reserved band BELOW the name row (chips) or below the live
// preview, on the Output card's own name row — never overlaying the name text
// or the shader. The name row is ~28px tall; ports start under it and stack.
const NAME_ROW_HEIGHT = 28;
const CHIP_PORT_TOP = NAME_ROW_HEIGHT + 10;
const CHIP_PORT_GAP = 16;
const OUTPUT_PORT_TOP = OUTPUT_PREVIEW_HEIGHT + NAME_ROW_HEIGHT / 2;

const LABEL_FONT = '500 9px/1 ui-monospace, SF Mono, Menlo, monospace';

// ---------------------------------------------------------------------------
// Style helpers — pulled out of the component so its own branch count (the
// thing `complexity` measures) stays readable; each of these is a small,
// independently testable mapping from graph data to CSS.
// ---------------------------------------------------------------------------

/** Stage tint for a card: null for Output (untinted — it isn't a stage of
    transformation itself), otherwise the stage's hue. */
function stageHueOf(stage: Stage): string | null {
  return stage === 'output' ? null : STAGE_COLORS[stage];
}

/** Card-root background/border: a subtle top-to-bottom wash of the stage hue
    when tinted, the plain panel color for Output. Selection always wins the
    border regardless of tint, so the violet ring reads the same everywhere. */
function cardChromeStyle(
  hue: string | null,
  selected: boolean,
): Pick<CSSProperties, 'background' | 'border'> {
  const untintedBorder = hue !== null ? `${hue}30` : '#2c2a38';

  return {
    background: hue !== null ? `linear-gradient(180deg, ${hue}14, ${hue}05), #1e1d27` : '#1e1d27',
    border: `1px solid ${selected ? PORT_COLORS.color : untintedBorder}`,
  };
}

/** Stage-tag color: tinted and slightly translucent when the card carries a
    stage hue, the plain muted gray for Output. */
function stageTagStyle(hue: string | null): Pick<CSSProperties, 'color' | 'opacity'> {
  return hue !== null ? { color: hue, opacity: 0.85 } : { color: '#8b88a0', opacity: 1 };
}

/** The card's width: Output is fixed (it hosts the live preview); chips
    widen a touch while their params panel is open so sliders have room, and
    widen further still when that panel holds a ramp editor — a stop row
    (swatch + slider + remove button) needs more than a plain slider row. */
function cardWidthOf(isOutput: boolean, expanded: boolean, hasRampParam: boolean): number {
  if (isOutput) return OUTPUT_WIDTH;
  if (!expanded) return CARD_WIDTH;

  return hasRampParam ? RAMP_WIDTH : EXPANDED_WIDTH;
}

/** Narrows a param's stored value to a string for the <select> it backs,
    falling back to the spec default. The stored value's declared type is the
    shared ParamValue union (numbers and ramps included), even though a
    select param only ever actually holds a string. */
function selectValueOf(value: ParamValue | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

interface LiveDrag {
  dropKind: 'target' | 'source';
  /** The type of the port the drag started FROM. */
  originType: PortType;
  /** The spec the drag started from. Only load-bearing for a backward drag
      (dropKind 'source'), where portsCompatible needs to know which card's
      input the candidate out ports would end up feeding. */
  originSpecId: SpecId;
}

/** What a live wire-drag will accept, derived from the connection in
    progress: dragging off an out port means inputs are the valid drops, and
    dragging backward off an input means outputs are. Null when no drag is
    live, or the drag's origin handle doesn't resolve to a real spec port. */
function liveDragOf(connection: ReturnType<typeof useConnection<CardNodeType>>): LiveDrag | null {
  if (!connection.inProgress) return null;

  const { fromHandle, fromNode } = connection;
  const fromSpec = NODE_SPECS[fromNode.data.spec];

  if (fromHandle.type === 'source') {
    return fromSpec.output !== null
      ? { dropKind: 'target', originType: fromSpec.output, originSpecId: fromNode.data.spec }
      : null;
  }

  const originInput = fromSpec.inputs.find((input) => input.id === fromHandle.id);

  return originInput
    ? { dropKind: 'source', originType: originInput.type, originSpecId: fromNode.data.spec }
    : null;
}

export function CardNode({ id, data, selected, dragging }: NodeProps<CardNodeType>) {
  const spec = NODE_SPECS[data.spec];
  const { paramStore } = useEditorGraph();
  const { deleteElements, updateNodeData } = useReactFlow();
  const isOutput = data.spec === 'output';
  const isSelected = selected;
  const hue = stageHueOf(spec.stage);

  const portTop = (index: number) =>
    isOutput ? OUTPUT_PORT_TOP : CHIP_PORT_TOP + index * CHIP_PORT_GAP;

  // Chips reserve height for however many port rows they carry (at least one:
  // generators still have their output port down there).
  const portRows = Math.max(spec.inputs.length, 1);

  // Sliders write the uniform directly (the GPU fast path — no recompile) and
  // mirror into node data so the value survives; selects and ramps only touch
  // node data, which changes the structural key and rebuilds the material
  // with new math (selects) or arity (ramps).
  const setParam = (paramId: string, value: ParamValue) => {
    if (typeof value === 'number') paramStore.set(id, paramId, value);
    updateNodeData(id, { params: { ...data.params, [paramId]: value } });
  };

  // The chip expands in place when selected: params render inside the card
  // body (not a floating toolbar — React Flow portals toolbars outside the
  // node's DOM, where drags read as canvas panning). Selected chips widen a
  // touch so sliders have room to travel.
  // Params toggle on CLICK: click opens, click again closes. Drags never
  // toggle — React Flow's drag machinery (d3-drag) suppresses the browser's
  // post-drag click, so any click that reaches this handler is a genuine one.
  // Closing is event-driven and lives in the editor: drag starts and
  // selection changes clear `open` in node data there, so this component
  // never syncs state to props after the fact.
  const open = data.open ?? false;

  const handleClick = () => {
    updateNodeData(id, { open: !open });
  };

  const expanded = isSelected && !dragging && open && spec.params.length > 0;

  // ---------------------------------------------------------------------
  // Wire-drag affordance: while a connection drag is live, valid drop
  // ports GLOW in their type color and everything else fades, so "where
  // can this attach?" is answered by looking, not by trial and error.
  // ---------------------------------------------------------------------
  const connection = useConnection<CardNodeType>();
  const liveDrag = liveDragOf(connection);

  /** Extra style for a handle during a live wire drag; empty when idle.
      Validity routes through portsCompatible so the Output exception (a
      field wire may land on Output's color `in`) glows there too, not just
      same-type matches. */
  const dragStyle = (
    handleKind: 'target' | 'source',
    portType: PortType,
    handleId: string,
  ): CSSProperties => {
    if (liveDrag === null) return {};

    // The handle the drag started from keeps its normal look.
    if (connection.fromNode?.id === id && connection.fromHandle?.id === handleId) return {};

    const isValidDrop =
      handleKind === liveDrag.dropKind &&
      (liveDrag.dropKind === 'target'
        ? // Forward drag: `handleId`'s card (this one) is the wire's target.
          portsCompatible(liveDrag.originType, data.spec, portType)
        : // Backward drag: the drag's origin card is the wire's target, and
          // this handle's own type is the candidate source.
          portsCompatible(portType, liveDrag.originSpecId, liveDrag.originType));

    if (!isValidDrop) return { opacity: 0.25 };

    // Forward drags glow in the WIRE's actual color (the drag's origin
    // type), so the one exception — a field landing on Output's violet `in`
    // — glows honest teal instead of claiming to be color. Backward drags
    // glow each candidate's own type, since every valid drop there already
    // is a genuine port of that type.
    const glowColor = liveDrag.dropKind === 'target' ? liveDrag.originType : portType;

    return {
      boxShadow: `0 0 0 3px ${PORT_COLORS[glowColor]}55, 0 0 10px ${PORT_COLORS[glowColor]}`,
    };
  };

  const hasRampParam = spec.params.some((param) => param.kind === 'ramp');
  const width = cardWidthOf(isOutput, expanded, hasRampParam);
  const showDelete = isSelected && !isOutput;

  return (
    <div
      style={{
        position: 'relative',
        width,
        ...cardChromeStyle(hue, isSelected),
        borderRadius: 10,
        boxShadow: isSelected
          ? '0 0 0 2px #a78bfa55, 0 6px 20px #00000040'
          : '0 6px 20px #00000040',
      }}
    >
      {showDelete && (
        <button
          aria-label={`delete ${spec.name}`}
          className="nodrag"
          onClick={() => deleteElements({ nodes: [{ id }] })}
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            borderRadius: '50%',
            border: '1px solid #2c2a38',
            background: '#1e1d27',
            color: '#e8e6f2',
            font: '600 10px/1 ui-monospace, SF Mono, Menlo, monospace',
            cursor: 'pointer',
          }}
          type="button"
        >
          ×
        </button>
      )}
      {isOutput && (
        <div
          style={{
            position: 'relative',
            height: OUTPUT_PREVIEW_HEIGHT,
            borderRadius: '9px 9px 0 0',
            overflow: 'hidden',
            background: '#000',
          }}
        >
          <OutputPreview nodeId={id} />
        </div>
      )}
      {/* The name row is the params toggle — a real button, so keyboard users
          can tab to it and hit Enter/Space. It stays OUTSIDE the params
          section so sliders/selects never sit inside an interactive ancestor.
          Cards without params render it inert. */}
      <button
        disabled={spec.params.length === 0}
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 7,
          width: '100%',
          // The Output card's "in" port + label live on this row (left edge),
          // so its name indents past them; chips keep ports below the row.
          padding: isOutput ? '7px 10px 7px 34px' : '7px 10px',
          font: '600 12px/1 ui-monospace, SF Mono, Menlo, monospace',
          color: '#e8e6f2',
          background: 'none',
          border: 0,
          textAlign: 'left',
          cursor: spec.params.length === 0 ? 'default' : 'pointer',
        }}
        type="button"
      >
        {spec.name}
        <span
          style={{
            marginLeft: 'auto',
            font: '500 9.5px/1 ui-monospace, SF Mono, Menlo, monospace',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            ...stageTagStyle(hue),
          }}
        >
          {spec.stage}
        </span>
      </button>
      {spec.inputs.map((input, index) => (
        <Handle
          id={input.id}
          key={input.id}
          position={Position.Left}
          style={{
            top: portTop(index),
            width: 9,
            height: 9,
            background: PORT_COLORS[input.type],
            border: '1.5px solid #16151d',
            ...dragStyle('target', input.type, input.id),
          }}
          type="target"
        >
          {/* Every port carries one small word: "in"/"out" for the main flow,
              prepositions ("by", "with") for modifiers. */}
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: -2,
              font: LABEL_FONT,
              letterSpacing: '0.06em',
              color: '#8b88a0',
              pointerEvents: 'none',
            }}
          >
            {input.label}
          </span>
        </Handle>
      ))}
      {spec.output !== null && (
        <Handle
          id="out"
          position={Position.Right}
          style={{
            top: portTop(0),
            width: 9,
            height: 9,
            background: PORT_COLORS[spec.output],
            border: '1.5px solid #16151d',
            ...dragStyle('source', spec.output, 'out'),
          }}
          type="source"
        >
          <span
            style={{
              position: 'absolute',
              right: 12,
              top: -2,
              font: LABEL_FONT,
              letterSpacing: '0.06em',
              color: '#8b88a0',
              pointerEvents: 'none',
            }}
          >
            out
          </span>
        </Handle>
      )}
      {/* Port band spacer: the handles are absolutely positioned, so this
          reserves the vertical room they occupy in normal flow. */}
      {!isOutput && <div style={{ height: portRows * CHIP_PORT_GAP + 4 }} />}
      {expanded && (
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
          {spec.params.map((param) => {
            // Ramp params (Color Ramp's stops) get their own row-per-stop
            // editor instead of the label/slider/value grid below — a ramp
            // doesn't fit that three-column shape.
            if (param.kind === 'ramp') {
              return (
                <RampParam
                  key={param.id}
                  nodeId={id}
                  onCommit={(stops) => setParam(param.id, stops)}
                  stops={rampStopsOf({ id, params: data.params, spec: data.spec }, param.id)}
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
                    value={Number(data.params[param.id] ?? param.defaultValue)}
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
                    value={selectValueOf(data.params[param.id], param.defaultValue)}
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
                    ? Number(data.params[param.id] ?? param.defaultValue).toFixed(
                        param.step < 1 ? 2 : 0,
                      )
                    : ''}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
