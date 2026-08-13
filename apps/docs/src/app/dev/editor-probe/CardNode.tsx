// The custom React Flow node: a compact chip — name, kind tag, typed ports —
// that expands in place to show its params while selected. Per-node previews
// were tried and cut (macro nodes with everyday names are legible without
// them). The Output card is the exception: its face is a live ShaderScene
// showing the compiled result, because seeing the result is Output's entire
// job.
import { useEffect, useState } from 'react';

import { Handle, Position, useConnection, useReactFlow } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';

import { useEditorGraph } from './graph-context';
import { OutputPreview } from './OutputPreview';
import { NODE_SPECS, PORT_COLORS } from './registry';
import type { PortType, SpecId } from './registry';

export type CardNodeType = Node<{ spec: SpecId; params: Record<string, number | string> }, 'card'>;

const CARD_WIDTH = 150;
const OUTPUT_WIDTH = 190;
const OUTPUT_PREVIEW_HEIGHT = 200;

// Ports live in a reserved band BELOW the name row (chips) or below the live
// preview, on the Output card's own name row — never overlaying the name text
// or the shader. The name row is ~28px tall; ports start under it and stack.
const NAME_ROW_HEIGHT = 28;
const CHIP_PORT_TOP = NAME_ROW_HEIGHT + 10;
const CHIP_PORT_GAP = 16;
const OUTPUT_PORT_TOP = OUTPUT_PREVIEW_HEIGHT + NAME_ROW_HEIGHT / 2;

const LABEL_FONT = '500 9px/1 ui-monospace, SF Mono, Menlo, monospace';

export function CardNode({ id, data, selected, dragging }: NodeProps<CardNodeType>) {
  const spec = NODE_SPECS[data.spec];
  const { paramStore } = useEditorGraph();
  const { updateNodeData } = useReactFlow();
  const isOutput = data.spec === 'output';

  const portTop = (index: number) =>
    isOutput ? OUTPUT_PORT_TOP : CHIP_PORT_TOP + index * CHIP_PORT_GAP;

  // Chips reserve height for however many port rows they carry (at least one:
  // generators still have their output port down there).
  const portRows = Math.max(spec.inputs.length, 1);

  // Sliders write the uniform directly (the GPU fast path — no recompile) and
  // mirror into node data so the value survives; selects only touch node data,
  // which changes the structural key and rebuilds the material with new math.
  const setParam = (paramId: string, value: number | string) => {
    if (typeof value === 'number') paramStore.set(id, paramId, value);
    updateNodeData(id, { params: { ...data.params, [paramId]: value } });
  };

  // The chip expands in place when selected: params render inside the card
  // body (not a floating toolbar — React Flow portals toolbars outside the
  // node's DOM, where drags read as canvas panning). Selected chips widen a
  // touch so sliders have room to travel.
  // Params toggle on CLICK: click opens, click again closes. Drags never
  // toggle — React Flow's drag machinery (d3-drag) suppresses the browser's
  // post-drag click, so any click that reaches this handler is a genuine one;
  // mid-drag the panel also collapses via the `dragging` effect below.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (dragging) setOpen(false);
  }, [dragging]);

  useEffect(() => {
    if (!selected) setOpen(false);
  }, [selected]);

  const handleClick = () => {
    setOpen((current) => !current);
  };

  const expanded = selected && !dragging && open && spec.params.length > 0;

  // ---------------------------------------------------------------------
  // Wire-drag affordance: while a connection drag is live, valid drop
  // ports GLOW in their type color and everything else fades, so "where
  // can this attach?" is answered by looking, not by trial and error.
  // ---------------------------------------------------------------------
  const connection = useConnection<CardNodeType>();

  // Which port type the loose wire carries, and which KIND of handle it can
  // land on (dragging off an out port means inputs are the valid drops, and
  // dragging backward off an input means outs are).
  let liveDrag: { portType: PortType; dropKind: 'target' | 'source' } | null = null;

  if (connection.inProgress) {
    const { fromHandle, fromNode } = connection;
    const fromSpec = NODE_SPECS[fromNode.data.spec];

    if (fromHandle.type === 'source') {
      liveDrag =
        fromSpec.output !== null ? { portType: fromSpec.output, dropKind: 'target' } : null;
    } else {
      const originInput = fromSpec.inputs.find((input) => input.id === fromHandle.id);

      liveDrag = originInput ? { portType: originInput.type, dropKind: 'source' } : null;
    }
  }

  /** Extra style for a handle during a live wire drag; empty when idle. */
  const dragStyle = (
    handleKind: 'target' | 'source',
    portType: PortType,
    handleId: string,
  ): React.CSSProperties => {
    if (liveDrag === null) return {};

    // The handle the drag started from keeps its normal look.
    if (connection.fromNode?.id === id && connection.fromHandle?.id === handleId) return {};

    const isValidDrop = handleKind === liveDrag.dropKind && portType === liveDrag.portType;

    return isValidDrop
      ? {
          boxShadow: `0 0 0 3px ${PORT_COLORS[portType]}55, 0 0 10px ${PORT_COLORS[portType]}`,
        }
      : { opacity: 0.25 };
  };

  let width = expanded ? 200 : CARD_WIDTH;

  if (isOutput) width = OUTPUT_WIDTH;

  return (
    <div
      style={{
        width,
        background: '#1e1d27',
        border: `1px solid ${selected ? PORT_COLORS.color : '#2c2a38'}`,
        borderRadius: 10,
        boxShadow: selected ? '0 0 0 2px #a78bfa55, 0 6px 20px #00000040' : '0 6px 20px #00000040',
      }}
    >
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
            color: '#8b88a0',
          }}
        >
          {spec.kind}
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
          {spec.params.map((param) => (
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
                  value={String(data.params[param.id] ?? param.defaultValue)}
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
          ))}
        </div>
      )}
    </div>
  );
}
