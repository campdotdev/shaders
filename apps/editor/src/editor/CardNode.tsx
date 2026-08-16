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

// Card widths, in px. A card's width depends only on WHAT IT IS, never on
// whether it's open: a card that resized on expand appeared to jump on the
// canvas. Number fields are what make one width workable — a slider needed
// travel room that a self-reading field doesn't. Color Ramp shares
// CARD_WIDTH too: once the swatch stopped setting its own height and the
// position slider became a field, a stop row (swatch + field + remove) fits
// with the position field still wider than a plain param row's.
const CARD_WIDTH = 160;
const OUTPUT_WIDTH = 190;

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

/** The card's width. A pure function of the card's spec — only Output
    differs (it hosts the live preview) — so opening a card never resizes or
    appears to move it. */
function cardWidthOf(isOutput: boolean): number {
  return isOutput ? OUTPUT_WIDTH : CARD_WIDTH;
}

export function CardNode({ id, data, selected }: NodeProps<CardNodeType>) {
  const spec = NODE_SPECS[data.spec];
  const { paramStore } = useEditorGraph();
  const { setNodes, updateNodeData } = useReactFlow();
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

  // The chip expands in place: params render inside the card body, not a
  // floating toolbar — React Flow portals toolbars outside the node's DOM,
  // where drags read as canvas panning. Expanded chips widen a touch so
  // sliders have room to travel.
  //
  // Disclosure is ONE bit, `open`, driven by ONE control (the settings row).
  // It deliberately does not depend on selection: gating on both meant the
  // first click on a card set `open` while the card was still unselected, so
  // nothing appeared and the click read as dead.
  const open = data.open ?? false;
  const hasParams = spec.params.length > 0;

  // Toggling settings also selects the card, and both writes go out in ONE
  // setNodes call. That matters: React Flow's own click-select rewrites the
  // node array during this same click, and whichever write lands second wins
  // — the old name-row button lost that race, which is why clicking the top
  // of a card never selected it. Writing `selected` ourselves makes both
  // paths agree on the outcome no matter which one lands last.
  const toggleSettings = () => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== id) {
          return node.selected === true ? { ...node, selected: false } : node;
        }

        return { ...node, selected: true, data: { ...node.data, open: !open } };
      }),
    );
  };

  const expanded = open && hasParams;

  const width = cardWidthOf(isOutput);

  // Deletion is keyboard-only: Backspace/Delete/x on the selection (see
  // deleteKeyCode in Editor.tsx). A per-card x button was tried and cut as
  // clutter — the selection ring already says what a delete would hit.
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
      {/* The name row is plain text, deliberately not a button. It used to be
          the params toggle, which made it an interactive element sitting on
          top of the card's drag surface — clicks there toggled `open` but
          never selected the card. Disclosure lives in the settings row below
          instead, leaving this row as drag surface like the rest of the card. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 7,
          // No `width: 100%` here on purpose. A block-level flex box already
          // fills its parent, and stating the width would make this row 100%
          // PLUS its padding — divs are content-box, unlike the button this
          // row used to be — which pushed the name past the card's edge.
          minWidth: 0,
          // The Output card's "in" port + label live on this row (left edge),
          // so its name indents past them; chips keep ports below the row.
          padding: isOutput ? '7px 10px 7px 34px' : '7px 10px',
          font: '600 12px/1 ui-monospace, SF Mono, Menlo, monospace',
          color: '#e8e6f2',
          textAlign: 'left',
        }}
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
      </div>
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
      {/* The disclosure control: always visible on a card that has params, so
          a collapsed chip says "there is more here" instead of hiding it
          behind a click on the name. `nodrag` keeps the press from starting a
          card drag; `aria-expanded` carries the state for screen readers. */}
      {hasParams && (
        <button
          aria-expanded={open}
          className="nodrag"
          onClick={toggleSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            width: '100%',
            padding: '6px 10px',
            borderTop: '1px solid #2c2a38',
            borderLeft: 0,
            borderRight: 0,
            borderBottom: 0,
            background: 'none',
            color: '#8b88a0',
            font: '500 10px/1 ui-monospace, SF Mono, Menlo, monospace',
            letterSpacing: '0.06em',
            textAlign: 'left',
            cursor: 'pointer',
          }}
          type="button"
        >
          settings
          <span aria-hidden style={{ marginLeft: 'auto', fontSize: 9 }}>
            {open ? '▲' : '▼'}
          </span>
        </button>
      )}
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
