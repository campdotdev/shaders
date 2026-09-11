// One neighborhood: a thin tinted plate covering its rectangle, with an HTML
// label pinned to its near corner. Hover comes in Task 4.
import { Html } from '@react-three/drei';

import type { Neighborhood } from '@/data/types';

import { PLATE_HEIGHT, plateCenter } from './layout';

/** Gap between adjacent plates, in world units, so districts read as separate. */
const PLATE_INSET = 0.1;

export function NeighborhoodPlate({ neighborhood }: { neighborhood: Neighborhood }) {
  const [x, y, z] = plateCenter(neighborhood);
  const [width, depth] = neighborhood.size;

  return (
    <group position={[x, y, z]}>
      <mesh>
        <boxGeometry args={[width - PLATE_INSET, PLATE_HEIGHT, depth - PLATE_INSET]} />
        {/* A standard material reacts to the lights. `emissive` adds the color
            back regardless of lighting, so the tint stays readable on the
            shadowed side without washing out under the directional light. */}
        <meshStandardMaterial
          color="#1b2030"
          emissive={neighborhood.color}
          emissiveIntensity={0.18}
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
