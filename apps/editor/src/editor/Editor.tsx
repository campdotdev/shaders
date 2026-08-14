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
  ReactFlow,
  reconnectEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import type { Connection, Edge, IsValidConnection, OnSelectionChangeParams } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AddNodeToolbar } from './AddNodeToolbar';
import { CardNode } from './CardNode';
import type { CardNodeType } from './CardNode';
import { structuralKeyOf } from './graph';
import { EditorGraphContext } from './graph-context';
import { Legend } from './Legend';
import { ParamStore } from './param-store';
import { defaultParamsOf, NODE_SPECS, PORT_COLORS, portsCompatible } from './registry';
import type { PortType, SpecId, Stage } from './registry';
import { STARTER_EDGES, STARTER_NODES } from './starter-graph';
import { TypedEdge } from './TypedEdge';

const nodeTypes = { card: CardNode };
const edgeTypes = { typed: TypedEdge };

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

function specIdOf(nodes: CardNodeType[], nodeId: string | null): SpecId | null {
  const node = nodes.find((candidate) => candidate.id === nodeId);

  return node ? node.data.spec : null;
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

  // The canvas's own on-screen bounds, measured for AddNodeToolbar so it can
  // center new cards on what's visible instead of assuming a full window.
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Same-type ports connect; portsCompatible carries the one exception
  // (Output's `in` also accepts a field) so this stays the only place
  // connection legality is decided.
  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      const sourceType = outputTypeOf(nodes, connection.source);
      const targetSpecId = specIdOf(nodes, connection.target);
      const targetType = inputTypeOf(nodes, connection.target, connection.targetHandle);

      return (
        sourceType !== null &&
        targetSpecId !== null &&
        targetType !== null &&
        portsCompatible(sourceType, targetSpecId, targetType)
      );
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
    <div ref={canvasWrapperRef} style={{ width: '100vw', height: '100vh', background: '#16151d' }}>
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
          <Legend />
          <AddNodeToolbar
            canvasWrapperRef={canvasWrapperRef}
            makeNode={makeNode}
            openStage={openStage}
            setNodes={setNodes}
            setOpenStage={setOpenStage}
          />
        </ReactFlow>
      </EditorGraphContext.Provider>
    </div>
  );
}
