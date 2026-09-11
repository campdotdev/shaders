// One neighborhood: a thin tinted plate covering its rectangle, with an HTML
// label pinned to its near corner. Hovering lifts the plate and brightens it,
// and writes the neighborhood into the hover store for the panel.
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';

import type { Neighborhood } from '@/data/types';
import { setHovered, useHovered } from '@/hover/store';

import { PLATE_HEIGHT, plateCenter } from './layout';

/** Gap between adjacent plates, in world units, so districts read as separate. */
const PLATE_INSET = 0.1;
/** How far a hovered plate rises, in world units. */
const HOVER_LIFT = 0.08;

export function NeighborhoodPlate({ neighborhood }: { neighborhood: Neighborhood }) {
  const hovered = useHovered();
  const isHovered = hovered?.kind === 'neighborhood' && hovered.id === neighborhood.id;
  const [x, y, z] = plateCenter(neighborhood);
  const [width, depth] = neighborhood.size;

  // r3f raycasts the pointer into the scene and fires these on the meshes it
  // hits, nearest first. Boxes stop propagation, so a plate only hears about
  // the pointer when nothing is on top of it.
  function onPointerOver(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    setHovered({ kind: 'neighborhood', id: neighborhood.id });
  }

  function onPointerOut(): void {
    setHovered(null);
  }

  return (
    <group position={[x, isHovered ? y + HOVER_LIFT : y, z]}>
      <mesh onPointerOut={onPointerOut} onPointerOver={onPointerOver}>
        <boxGeometry args={[width - PLATE_INSET, PLATE_HEIGHT, depth - PLATE_INSET]} />
        {/* A standard material reacts to the lights. `emissive` adds the color
            back regardless of lighting, so the tint stays readable on the
            shadowed side without washing out under the directional light. */}
        <meshStandardMaterial
          color="#1b2030"
          emissive={neighborhood.color}
          emissiveIntensity={isHovered ? 0.4 : 0.18}
          roughness={0.95}
        />
      </mesh>
      {/* drei's Html projects a DOM element to a 3D point every frame. The
          label is real text: crisp at any zoom and styled with CSS. Pointer
          events are off so the label never blocks hover on the plate. */}
      <Html
        position={[-width / 2 + 0.2, PLATE_HEIGHT, depth / 2 - 0.2]}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[5, 0]}
      >
        <span className="plate-label" style={{ color: neighborhood.color }}>
          {neighborhood.name}
        </span>
      </Html>
    </group>
  );
}
