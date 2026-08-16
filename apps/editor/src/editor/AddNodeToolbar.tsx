'use client';

// The "+ generate / effects / color / adjust" toolbar: four stage flyouts
// that add a card to the canvas, centered on whatever the user is currently
// looking at. Split out of Editor.tsx (MAT-94 Task 11.5) so the editor file
// stays under the 300-line bar. Card construction (`makeNode`) stays put in
// Editor.tsx — it's also used for the starter graph there — and is passed in
// as a prop, which keeps this file a component-only export (a non-component
// export alongside AddNodeToolbar would defeat Fast Refresh).
import { useCallback, useRef } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

import { Panel, useReactFlow } from '@xyflow/react';

import type { CardNodeType } from './CardNode';
import { NODE_SPECS, STAGE_COLORS } from './registry';
import type { SpecId, Stage } from './registry';

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
    specs: ['warp', 'blend'],
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

/**
 * The "+ generate / effects / color / adjust" toolbar. Split out as its own
 * component (rather than living inline in Editor) so it can sit as a child
 * of <ReactFlow> and call useReactFlow() directly — react-flow's node/canvas
 * context is only wired up for components inside the <ReactFlow> tree, and
 * Editor itself renders that tree rather than being inside it.
 */
export function AddNodeToolbar({
  canvasWrapperRef,
  makeNode,
  openStage,
  setNodes,
  setOpenStage,
}: {
  canvasWrapperRef: RefObject<HTMLDivElement | null>;
  /** Builds a card node at a canvas position, seeded with its spec's default
      params. Lives in Editor.tsx (the starter graph needs it too) and is
      passed down rather than imported. */
  makeNode: (id: string, spec: SpecId, x: number, y: number) => CardNodeType;
  openStage: Exclude<Stage, 'output'> | null;
  setNodes: Dispatch<SetStateAction<CardNodeType[]>>;
  setOpenStage: Dispatch<SetStateAction<Exclude<Stage, 'output'> | null>>;
}) {
  const { screenToFlowPosition } = useReactFlow();

  // New cards drop at the center of whatever the user is currently looking
  // at (gate decision: cards should land where the user is looking, not a
  // fixed corner they'd have to pan to find), with a small stagger so
  // consecutive adds don't stack exactly on top of each other.
  const addedCount = useRef(0);
  const addNode = useCallback(
    (spec: SpecId) => {
      const count = addedCount.current;

      addedCount.current += 1;

      // Measure the canvas element's own on-screen bounds rather than
      // assuming it fills the window — a future layout (side panel, split
      // view) could shrink it, and this still has to center on what's visible.
      const wrapperBounds = canvasWrapperRef.current?.getBoundingClientRect();
      const screenCenter = wrapperBounds
        ? {
            x: wrapperBounds.left + wrapperBounds.width / 2,
            y: wrapperBounds.top + wrapperBounds.height / 2,
          }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const flowCenter = screenToFlowPosition(screenCenter);

      setNodes((current) => {
        // The counter alone can't guarantee uniqueness: it restarts at 0 per
        // mount, while an import, a paste, or an undo can already have
        // `${spec}-added-N` ids on the canvas. Scan past whatever's taken —
        // inside the updater, against the freshest node list.
        const takenIds = new Set(current.map((node) => node.id));
        let suffix = count;
        let id = `${spec}-added-${suffix}`;

        while (takenIds.has(id)) {
          suffix += 1;
          id = `${spec}-added-${suffix}`;
        }

        return [
          ...current,
          makeNode(
            id,
            spec,
            // Subtract roughly half a card so the CARD lands centered, not its
            // top-left corner, then apply the repeat-add stagger around that.
            flowCenter.x - 75 + ((count % 5) - 2) * 28,
            flowCenter.y - 40 + ((count % 3) - 1) * 28,
          ),
        ];
      });
    },
    [canvasWrapperRef, makeNode, screenToFlowPosition, setNodes],
  );

  return (
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
              {/* A plain disclosure group, deliberately not role="menu": menu
                  semantics demand menuitem children and arrow-key navigation
                  these buttons don't implement, so the role would promise
                  screen readers behavior that isn't there. */}
              {isOpen && (
                <div
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
  );
}
