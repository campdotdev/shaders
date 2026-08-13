'use client';

// The editor canvas: React Flow with card nodes, typed wires, connection
// validation (a field port only accepts a field wire, color only color), an
// add-node toolbar, and the shared ParamStore that lets sliders write to the
// GPU without recompiling. Ships prewired with the demo graph — gradient
// warped by noise, colorized, into Output — so there's something to edit.
import { useCallback, useMemo, useRef } from 'react';

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
import type { Connection, Edge, IsValidConnection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CardNode } from './CardNode';
import type { CardNodeType } from './CardNode';
import { EditorGraphContext, structuralKeyOf } from './graph-context';
import { ParamStore } from './param-store';
import { defaultParamsOf, NODE_SPECS, PORT_COLORS } from './registry';
import type { PortType, SpecId } from './registry';

const nodeTypes = { card: CardNode };

/** Everything the toolbar can add — every spec except the singleton Output. */
const ADDABLE_SPECS: SpecId[] = [
  'gradient',
  'noise',
  'warp',
  'curve',
  'blend',
  'colorRamp',
  'tone',
];

// ---------------------------------------------------------------------------
// Demo graph — mirrors the concept mock: Gradient --in--> Warp <--by-- Noise,
// then Warp -> Color Ramp -> Output.
// ---------------------------------------------------------------------------

function makeNode(id: string, spec: SpecId, x: number, y: number): CardNodeType {
  return { id, type: 'card', position: { x, y }, data: { spec, params: defaultParamsOf(spec) } };
}

const initialNodes: CardNodeType[] = [
  makeNode('gradient-1', 'gradient', 30, 60),
  makeNode('noise-1', 'noise', 30, 300),
  makeNode('warp-1', 'warp', 270, 170),
  makeNode('ramp-1', 'colorRamp', 500, 165),
  makeNode('output-1', 'output', 720, 120),
];

/** Styles an edge with its port type's tint so wires read as typed at a glance. */
function typedEdge(edge: Omit<Edge, 'style'>, type: PortType): Edge {
  return { ...edge, style: { stroke: PORT_COLORS[type], strokeWidth: 1.7 } };
}

const initialEdges: Edge[] = [
  typedEdge(
    { id: 'e-gradient-warp', source: 'gradient-1', target: 'warp-1', targetHandle: 'source' },
    'field',
  ),
  typedEdge(
    { id: 'e-noise-warp', source: 'noise-1', target: 'warp-1', targetHandle: 'by' },
    'field',
  ),
  typedEdge({ id: 'e-warp-ramp', source: 'warp-1', target: 'ramp-1', targetHandle: 'in' }, 'field'),
  typedEdge(
    { id: 'e-ramp-output', source: 'ramp-1', target: 'output-1', targetHandle: 'in' },
    'color',
  ),
];

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
          {
            ...connection,
            style: { stroke: PORT_COLORS[sourceType ?? 'field'], strokeWidth: 1.7 },
          },
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

  // Compiler-shaped mirrors of the React Flow state, plus the structural
  // fingerprint the Output card's material effect keys on. Positions and
  // slider values are excluded — only wiring, specs, and select params
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
          edges={edges}
          fitView
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          nodes={nodes}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          onReconnect={onReconnect}
          onReconnectEnd={onReconnectEnd}
          onReconnectStart={onReconnectStart}
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
              {ADDABLE_SPECS.map((spec) => (
                <button
                  key={spec}
                  onClick={() => addNode(spec)}
                  style={{
                    padding: '6px 10px',
                    background: '#1e1d27',
                    border: '1px solid #2c2a38',
                    borderRadius: 7,
                    color: '#e8e6f2',
                    font: '500 11px/1 ui-monospace, SF Mono, Menlo, monospace',
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  + {NODE_SPECS[spec].name}
                </button>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </EditorGraphContext.Provider>
    </div>
  );
}
