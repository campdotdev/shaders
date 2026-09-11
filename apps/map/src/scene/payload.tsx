// The payload: a small glowing sphere that hops from step to step. This is
// the one place the scene touches the clock. useFrame runs once per drawn
// frame with the seconds since the last one; it advances the store's clock,
// asks where the payload is, and moves the mesh directly. No React state
// changes here, so nothing re-renders at frame rate.
import { useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

import { moduleById } from '@/data';
import { getPlaybackSnapshot, getPosition, getSchedule, playback } from '@/timeline/store';
import { locate } from '@/timeline/timeline';

import { easeInOut, hopPosition, moduleTop } from './layout';

/** Radius of the sphere, in world units. */
const PAYLOAD_RADIUS = 0.18;
/** Clearance above a module's top when the payload lands, in world units. */
const LANDING_LIFT = 0.2;

export function Payload() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, deltaSeconds) => {
    playback.advance(deltaSeconds);

    const mesh = meshRef.current;
    const { flow } = getPlaybackSnapshot();
    const { stepIndex, progress } = locate(getSchedule(), getPosition());
    const step = flow.steps[stepIndex];

    if (mesh === null || step === undefined) return;

    const from = moduleById(step.from);
    const to = moduleById(step.to);

    if (from === undefined || to === undefined) return;

    const [x, y, z] = hopPosition(moduleTop(from), moduleTop(to), easeInOut(Math.min(progress, 1)));

    mesh.position.set(x, y + LANDING_LIFT, z);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[PAYLOAD_RADIUS, 24, 24]} />
      {/* Emissive well above 1 so the sphere reads as a light source next to
          the boxes, which sit around 0.15. */}
      <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={2.5} />
    </mesh>
  );
}
