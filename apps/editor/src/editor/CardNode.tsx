// The custom React Flow node: a compact chip — name, stage tag, typed ports —
// that expands in place to show its params while selected. Per-node previews
// were tried and cut (macro nodes with everyday names are legible without
// them). The Output card is the exception: its face is a live ShaderScene
// showing the compiled result, because seeing the result is Output's entire
// job. Every non-Output card also wears a subtle wash of its stage's color
// (generate/effect/color/adjust) so the canvas reads left-to-right as a
// pipeline at a glance, the way the concept mock does.
import type { CSSProperties } from 'react';

import { useReactFlow } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';

import { CardParams } from './CardParams';
import { CardPorts, CHIP_PORT_GAP, OUTPUT_PREVIEW_HEIGHT } from './CardPorts';
import { useEditorGraph } from './graph-context';
import { OutputPreview } from './OutputPreview';
import { NODE_SPECS, PORT_COLORS, STAGE_COLORS } from './registry';
import type { ParamValue, SpecId, Stage } from './registry';

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
const EXPANDED_WIDTH = 200;
const RAMP_WIDTH = 240;

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

export function CardNode({ id, data, selected, dragging }: NodeProps<CardNodeType>) {
  const spec = NODE_SPECS[data.spec];
  const { paramStore } = useEditorGraph();
  const { deleteElements, updateNodeData } = useReactFlow();
  const isOutput = data.spec === 'output';
  const isSelected = selected;
  const hue = stageHueOf(spec.stage);

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
      <CardPorts
        id={id}
        inputs={spec.inputs}
        isOutput={isOutput}
        output={spec.output}
        specId={data.spec}
      />
      {/* Port band spacer: the handles are absolutely positioned, so this
          reserves the vertical room they occupy in normal flow. */}
      {!isOutput && <div style={{ height: portRows * CHIP_PORT_GAP + 4 }} />}
      {expanded && (
        <CardParams
          nodeId={id}
          paramSpecs={spec.params}
          params={data.params}
          setParam={setParam}
          specId={data.spec}
        />
      )}
    </div>
  );
}
