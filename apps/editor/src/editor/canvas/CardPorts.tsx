// A card's input/output Handle rendering, including the live wire-drag glow:
// while a connection drag is in progress, valid drop ports light up in their
// type color (liveDragOf reads the drag's origin, dragStyle consults
// portsCompatible per handle). Split out of CardNode.tsx (MAT-94 Task 11.5)
// so the card shell stays under the 300-line bar — CardNode still owns node
// data and passes down only the port-relevant slice of it.
import type { CSSProperties } from 'react';

import { Handle, Position, useConnection } from '@xyflow/react';

import { NODE_SPECS, PORT_COLORS, portsCompatible } from '@/editor/graph/registry';
import type { InputSpec, PortType, SpecId } from '@/editor/graph/registry';

import type { CardNodeType } from './CardNode';

// Ports live in a reserved band BELOW the name row (chips) or below the live
// preview, on the Output card's own name row — never overlaying the name text
// or the shader. The name row is ~28px tall; ports start under it and stack.
const NAME_ROW_HEIGHT = 28;
const CHIP_PORT_TOP = NAME_ROW_HEIGHT + 10;

/** Vertical gap between stacked port rows on a chip card. Exported because
    CardNode's port-band spacer reserves the same height, in normal flow,
    for these absolutely-positioned handles. */
export const CHIP_PORT_GAP = 16;
/** Height of the Output card's live preview box. Exported because CardNode
    sizes the preview element itself; here it anchors the Output card's
    single port row below that box. */
export const OUTPUT_PREVIEW_HEIGHT = 200;
const OUTPUT_PORT_TOP = OUTPUT_PREVIEW_HEIGHT + NAME_ROW_HEIGHT / 2;

const LABEL_FONT = '500 9px/1 ui-monospace, SF Mono, Menlo, monospace';

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

export function CardPorts({
  id,
  specId,
  inputs,
  output,
  isOutput,
}: {
  id: string;
  specId: SpecId;
  inputs: InputSpec[];
  output: PortType | null;
  isOutput: boolean;
}) {
  const portTop = (index: number) =>
    isOutput ? OUTPUT_PORT_TOP : CHIP_PORT_TOP + index * CHIP_PORT_GAP;

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
          portsCompatible(liveDrag.originType, specId, portType)
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

  return (
    <>
      {inputs.map((input, index) => (
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
      {output !== null && (
        <Handle
          id="out"
          position={Position.Right}
          style={{
            top: portTop(0),
            width: 9,
            height: 9,
            background: PORT_COLORS[output],
            border: '1.5px solid #16151d',
            ...dragStyle('source', output, 'out'),
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
    </>
  );
}
