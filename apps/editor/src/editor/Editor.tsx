'use client';

// The editor canvas: React Flow with card nodes, typed wires, connection
// validation (a field port only accepts a field wire, color only color), a
// four-stage add-node toolbar, and the shared ParamStore that lets sliders
// write to the GPU without recompiling. Ships prewired with the starter
// graph — gradient warped by noise, blended with that same noise, colorized,
// into Output — so there's something to edit and a live example of fan-out
// (one field feeding two different downstream cards).
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  reconnectEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import type { Connection, Edge, IsValidConnection, OnSelectionChangeParams } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CardNode } from './CardNode';
import type { CardNodeType } from './CardNode';
import { structuralKeyOf } from './graph';
import { EditorGraphContext } from './graph-context';
import { ParamStore } from './param-store';
import { defaultParamsOf, NODE_SPECS, PORT_COLORS, STAGE_COLORS } from './registry';
import type { PortType, SpecId, Stage } from './registry';
import { STARTER_EDGES, STARTER_NODES } from './starter-graph';
import { TypedEdge } from './TypedEdge';

const nodeTypes = { card: CardNode };
const edgeTypes = { typed: TypedEdge };

/** The toolbar's four flyouts, grouped by stage in pipeline order (left to
    right on the canvas: generate -> effect -> color -> adjust). Output is a
    singleton seeded by the starter graph, never toolbar-addable. A flat row
    of all 13 specs was tried and rejected — stage grouping is what makes the
    pipeline legible before a single card is placed. `label` is the button
    text shown to the user; it differs from `stage` only for `effect`, whose
    button reads the plural "effects". A one-line subtitle under each open
    flyout spells out what the stage is for. */
const STAGE_MENU: Array<{
  stage: Exclude<Stage, 'output'>;
  label: string;
  subtitle: string;
  specs: SpecId[];
}> = [
  {
    stage: 'generate',
    label: 'generate',
    subtitle: 'make a pattern',
    specs: ['gradient', 'noise', 'fractalNoise', 'voronoi', 'blobs'],
  },
  {
    stage: 'effect',
    label: 'effects',
    subtitle: 'rework the pattern before it gets color',
    specs: ['warp', 'curve', 'blend'],
  },
  {
    stage: 'color',
    label: 'color',
    subtitle: 'turn the pattern into color',
    specs: ['colorRamp'],
  },
  {
    stage: 'adjust',
    label: 'adjust',
    subtitle: 'polish the finished image',
    specs: ['tone', 'levels', 'vignette', 'grain'],
  },
];

// ---------------------------------------------------------------------------
// Starter graph — mirrors the concept mock: Gradient --in--> Warp <--by--
// Noise, Warp and Noise both feed Blend, then Blend -> Color Ramp -> Output.
// ---------------------------------------------------------------------------

function makeNode(id: string, spec: SpecId, x: number, y: number): CardNodeType {
  return {
    id,
    type: 'card',
    position: { x, y },
    data: { spec, params: defaultParamsOf(spec) },
    // The Output card is a singleton the graph always needs a home for — it
    // can't be deleted, so Backspace and the card's own delete control (which
    // never renders for Output in the first place) both respect that for free.
    deletable: spec !== 'output',
  };
}

const initialNodes: CardNodeType[] = STARTER_NODES.map(({ id, spec, x, y }) =>
  makeNode(id, spec, x, y),
);

/**
 * Styles an edge with its port type's tint so wires read as typed at a
 * glance, and tags it with the `typed` edge type so selecting it reveals the
 * delete control. Generic so it takes both full edges (the starter set) and
 * id-less connections (live connects — addEdge generates the id).
 */
function typedEdge<EdgeLike extends Omit<Edge, 'id' | 'style' | 'type'>>(
  edge: EdgeLike,
  portType: PortType,
): EdgeLike & Pick<Edge, 'style' | 'type'> {
  return { ...edge, type: 'typed', style: { stroke: PORT_COLORS[portType], strokeWidth: 1.7 } };
}

// Wire tints derive from the source node's output type, same as live connects.
const initialEdges: Edge[] = STARTER_EDGES.map((edge, index) => {
  const sourceNode = STARTER_NODES.find((candidate) => candidate.id === edge.source);
  const tint = sourceNode ? (NODE_SPECS[sourceNode.spec].output ?? 'field') : 'field';

  return typedEdge({ id: `starter-${index}`, ...edge }, tint);
});

// ---------------------------------------------------------------------------
// Port typing helpers — look a handle's type up from the node's spec so wires
// can be validated and tinted from graph data alone.
// ---------------------------------------------------------------------------

function outputTypeOf(nodes: CardNodeType[], nodeId: string | null): PortType | null {
  const node = nodes.find((candidate) => candidate.id === nodeId);

  return node ? NODE_SPECS[node.data.spec].output : null;
}

function inputTypeOf(
  nodes: CardNodeType[],
  nodeId: string | null,
  handleId: string | null | undefined,
): PortType | null {
  const node = nodes.find((candidate) => candidate.id === nodeId);

  if (!node) return null;
  const input = NODE_SPECS[node.data.spec].inputs.find((candidate) => candidate.id === handleId);

  return input ? input.type : null;
}

export default function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Which stage's flyout is open, if any — one at a time. Closed by picking a
  // node, picking the same stage again, or clicking the canvas.
  const [openStage, setOpenStage] = useState<Exclude<Stage, 'output'> | null>(null);

  // One store for the whole canvas, surviving every material rebuild — the
  // uniforms inside it are what make slider drags free.
  const paramStore = useMemo(() => new ParamStore(), []);

  // Only same-type ports connect; the wire simply refuses to snap otherwise.
  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      const sourceType = outputTypeOf(nodes, connection.source);
      const targetType = inputTypeOf(nodes, connection.target, connection.targetHandle);

      return sourceType !== null && sourceType === targetType;
    },
    [nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceType = outputTypeOf(nodes, connection.source);

      // An input holds exactly ONE wire: connecting into an occupied socket
      // replaces the old wire instead of silently stacking a second one the
      // compiler would ignore. Combining fields is Blend's job, never implicit.
      setEdges((current) =>
        addEdge(
          typedEdge(connection, sourceType ?? 'field'),
          current.filter(
            (edge) =>
              !(edge.target === connection.target && edge.targetHandle === connection.targetHandle),
          ),
        ),
      );
    },
    [nodes, setEdges],
  );

  // Wires can be grabbed by either end and re-plugged or torn off. React Flow
  // reports a reconnect drag through three callbacks; the ref tracks whether
  // the drop landed on a port (onReconnect fired) or on empty canvas — the
  // latter deletes the wire, which is the "remove a connection" gesture.
  const reconnectLanded = useRef(true);

  const onReconnectStart = useCallback(() => {
    reconnectLanded.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      reconnectLanded.current = true;
      setEdges((current) => reconnectEdge(oldEdge, newConnection, current));
    },
    [setEdges],
  );

  const onReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge) => {
      if (!reconnectLanded.current) {
        setEdges((current) => current.filter((candidate) => candidate.id !== edge.id));
      }
      reconnectLanded.current = true;
    },
    [setEdges],
  );

  // New cards drop near the top-left in a slight stagger so they don't stack.
  const addedCount = useRef(0);
  const addNode = useCallback(
    (spec: SpecId) => {
      const count = addedCount.current;

      addedCount.current += 1;

      setNodes((current) => [
        ...current,
        makeNode(`${spec}-added-${count}`, spec, 60 + (count % 4) * 44, 40 + (count % 6) * 36),
      ]);
    },
    [setNodes],
  );

  // Params panels close here, in the events that end an "open" episode —
  // never in an effect watching props. A drag start collapses the dragged
  // card's panel for good; a selection change closes panels on cards no
  // longer selected, so a re-selected card starts with its panel shut.
  // The untouched-array early return matters: selection changes fire often,
  // and recreating node objects would churn the graph context for nothing.
  const closeParamPanels = useCallback(
    (keepIds?: ReadonlySet<string>) => {
      setNodes((current) => {
        const shouldClose = (node: CardNodeType) =>
          node.data.open === true && !(keepIds?.has(node.id) ?? false);

        if (!current.some(shouldClose)) return current;

        return current.map((node) =>
          shouldClose(node) ? { ...node, data: { ...node.data, open: false } } : node,
        );
      });
    },
    [setNodes],
  );

  const onNodeDragStart = useCallback(() => closeParamPanels(), [closeParamPanels]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams<CardNodeType>) => {
      closeParamPanels(new Set(selectedNodes.map((node) => node.id)));
    },
    [closeParamPanels],
  );

  // Clicking empty canvas closes whichever toolbar flyout is open — the same
  // "click away dismisses" gesture as the params panel.
  const onPaneClick = useCallback(() => setOpenStage(null), []);

  // Compiler-shaped mirrors of the React Flow state, plus the structural
  // fingerprint the Output card's material effect keys on. Positions and
  // slider values are excluded — only wiring, specs, and select/ramp params
  // rebuild the shader.
  const graphNodes = useMemo(
    () => nodes.map((node) => ({ id: node.id, spec: node.data.spec, params: node.data.params })),
    [nodes],
  );
  const graphEdges = useMemo(
    () => edges.map(({ source, target, targetHandle }) => ({ source, target, targetHandle })),
    [edges],
  );
  const graph = useMemo(
    () => ({
      nodes: graphNodes,
      edges: graphEdges,
      structuralKey: structuralKeyOf(graphNodes, graphEdges),
      paramStore,
    }),
    [graphNodes, graphEdges, paramStore],
  );

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#16151d' }}>
      {/* Wire state styling: hover thickens a wire so it reads as grabbable;
          selection thickens it more and adds a white glow. The edges' stroke
          COLOR stays inline (it encodes port type), so these rules only touch
          width and glow. */}
      <style>{`
        .react-flow__edge:hover .react-flow__edge-path {
          stroke-width: 2.6 !important;
        }
        .react-flow__edge.selected .react-flow__edge-path {
          stroke-width: 3 !important;
          filter: drop-shadow(0 0 3.5px #ffffffb0);
        }
      `}</style>
      <EditorGraphContext.Provider value={graph}>
        <ReactFlow
          colorMode="dark"
          edgeTypes={edgeTypes}
          edges={edges}
          fitView
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          nodes={nodes}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={onNodeDragStart}
          onNodesChange={onNodesChange}
          onPaneClick={onPaneClick}
          onReconnect={onReconnect}
          onReconnectEnd={onReconnectEnd}
          onReconnectStart={onReconnectStart}
          onSelectionChange={onSelectionChange}
        >
          <Background color="#2c2a38" gap={22} size={1.5} variant={BackgroundVariant.Dots} />
          <Controls />
          <Panel position="bottom-center">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '7px 14px',
                background: '#1e1d27',
                border: '1px solid #2c2a38',
                borderRadius: 7,
                font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
                color: '#8b88a0',
              }}
            >
              {(
                [
                  ['field', 'pattern (grayscale)'],
                  ['color', 'color'],
                ] as const
              ).map(([portType, description]) => (
                <span key={portType} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: PORT_COLORS[portType],
                    }}
                  />
                  {description}
                </span>
              ))}
              <span>same colors connect</span>
            </div>
          </Panel>
          <Panel position="top-left">
            <div style={{ display: 'flex', gap: 6 }}>
              {STAGE_MENU.map(({ stage, label, subtitle, specs }) => {
                const hue = STAGE_COLORS[stage];
                const isOpen = openStage === stage;

                return (
                  <div key={stage} style={{ position: 'relative' }}>
                    <button
                      aria-expanded={isOpen}
                      onClick={() => setOpenStage((current) => (current === stage ? null : stage))}
                      style={{
                        padding: '6px 10px',
                        background: '#1e1d27',
                        border: `1px solid ${hue}55`,
                        borderRadius: 7,
                        color: hue,
                        font: '500 11px/1 ui-monospace, SF Mono, Menlo, monospace',
                        cursor: 'pointer',
                      }}
                      type="button"
                    >
                      + {label}
                    </button>
                    {isOpen && (
                      <div
                        role="menu"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: 4,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          padding: 4,
                          background: '#1e1d27',
                          border: '1px solid #2c2a38',
                          borderRadius: 7,
                          boxShadow: '0 6px 20px #00000040',
                          zIndex: 10,
                        }}
                      >
                        {/* Plain text, not a menu item: describes the stage
                            without being a focusable/selectable option. */}
                        <div
                          style={{
                            padding: '2px 10px 6px',
                            whiteSpace: 'nowrap',
                            font: '500 10px/1.3 ui-monospace, SF Mono, Menlo, monospace',
                            color: '#8b88a0',
                          }}
                        >
                          {subtitle}
                        </div>
                        {specs.map((spec) => (
                          <button
                            key={spec}
                            onClick={() => {
                              addNode(spec);
                              setOpenStage(null);
                            }}
                            style={{
                              padding: '6px 10px',
                              whiteSpace: 'nowrap',
                              background: 'none',
                              border: 0,
                              borderRadius: 5,
                              color: '#e8e6f2',
                              font: '500 11px/1 ui-monospace, SF Mono, Menlo, monospace',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                            type="button"
                          >
                            {NODE_SPECS[spec].name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </ReactFlow>
      </EditorGraphContext.Provider>
    </div>
  );
}
