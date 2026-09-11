// One module: a box on its neighborhood's plate with a centered HTML label
// above it. Hovering brightens the box and writes the module into the hover
// store for the panel. The two boxes at either end of the current step glow
// gold while the payload is in flight between them.
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';

import { neighborhoodById } from '@/data';
import type { Module } from '@/data/types';
import { setHovered, useHovered } from '@/hover/store';
import { usePlayback } from '@/timeline/use-playback';

import { BOX_HEIGHT, BOX_SIZE, boxCenter } from './layout';

/** Space between the box top and its label, in world units. */
const LABEL_LIFT = 0.14;
const ACTIVE_COLOR = '#ffd166';

function emissiveFor(isActive: boolean, isHovered: boolean): number {
  if (isActive) return 0.9;
  if (isHovered) return 0.5;

  return 0.15;
}

export function ModuleBox({ module }: { module: Module }) {
  const hovered = useHovered();
  const { flow, stepIndex } = usePlayback();
  const step = flow.steps[stepIndex];
  const isActive = step !== undefined && (step.from === module.id || step.to === module.id);
  const isHovered = hovered?.kind === 'module' && hovered.id === module.id;
  const [x, y, z] = boxCenter(module);
  const tint = neighborhoodById(module.neighborhood)?.color ?? '#ffffff';

  function onPointerOver(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    setHovered({ kind: 'module', id: module.id });
  }

  function onPointerOut(): void {
    setHovered(null);
  }

  return (
    <group position={[x, y, z]}>
      <mesh onPointerOut={onPointerOut} onPointerOver={onPointerOver}>
        <boxGeometry args={[BOX_SIZE, BOX_HEIGHT, BOX_SIZE]} />
        {/* A standard material reacts to the lights. `emissive` adds the color
            back regardless of lighting, so the tint stays readable on the
            shadowed side without washing out under the directional light. */}
        <meshStandardMaterial
          color="#e8ebf2"
          emissive={isActive ? ACTIVE_COLOR : tint}
          emissiveIntensity={emissiveFor(isActive, isHovered)}
          roughness={0.6}
        />
      </mesh>
      {/* drei's Html projects a DOM element to a 3D point every frame. The
          label is real text: crisp at any zoom and styled with CSS. Pointer
          events are off so the label never blocks hover on the box. */}
      <Html
        center
        position={[0, BOX_HEIGHT / 2 + LABEL_LIFT, 0]}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[5, 0]}
      >
        <span className="module-label">{module.name}</span>
      </Html>
    </group>
  );
}
