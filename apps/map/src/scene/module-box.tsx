// One module: a box on its neighborhood's plate with a centered HTML label
// above it. Hover comes in Task 4 and the active-step glow in Task 7.
import { Html } from '@react-three/drei';

import { neighborhoodById } from '@/data';
import type { Module } from '@/data/types';

import { BOX_HEIGHT, BOX_SIZE, boxCenter } from './layout';

/** Space between the box top and its label, in world units. */
const LABEL_LIFT = 0.14;

export function ModuleBox({ module }: { module: Module }) {
  const [x, y, z] = boxCenter(module);
  const tint = neighborhoodById(module.neighborhood)?.color ?? '#ffffff';

  return (
    <group position={[x, y, z]}>
      <mesh>
        <boxGeometry args={[BOX_SIZE, BOX_HEIGHT, BOX_SIZE]} />
        <meshStandardMaterial
          color="#e8ebf2"
          emissive={tint}
          emissiveIntensity={0.15}
          roughness={0.6}
        />
      </mesh>
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
