// The r3f canvas with everything the map needs before any data arrives: the
// isometric camera, pan-and-zoom controls, two lights, and a ground grid.
// Scene objects render as children. The grid is centered on a fixed point for
// now; Task 3 replaces that with the bounds of the neighborhoods.
import type { ReactNode } from 'react';

import { MapControls, OrthographicCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

// ---- Camera placement ------------------------------------------------------

// An orthographic camera has no perspective: distance does not shrink things,
// so a grid stays a grid wherever it sits on screen. Zoom is a scale factor on
// the camera, not a distance, which is why the camera can sit anywhere along
// its view line. Equal offsets along x, y, and z put it on the diagonal, the
// true isometric angle, where all three axes foreshorten equally.
const CAMERA_DISTANCE = 30;
const GRID_CENTER: readonly [x: number, z: number] = [9, 5.5];
const GRID_SIZE = 24;

export function MapCanvas({ children }: { children: ReactNode }) {
  const [centerX, centerZ] = GRID_CENTER;

  return (
    <Canvas dpr={[1, 2]}>
      <OrthographicCamera
        far={200}
        makeDefault
        near={0.1}
        position={[centerX + CAMERA_DISTANCE, CAMERA_DISTANCE, centerZ + CAMERA_DISTANCE]}
        zoom={42}
      />
      {/* MapControls pans parallel to the ground and zooms on wheel. Rotation is
          off so the isometric angle is fixed. The target is the point the camera
          looks at, so it has to sit on the grid. */}
      <MapControls
        enableRotate={false}
        makeDefault
        maxZoom={120}
        minZoom={15}
        target={[centerX, 0, centerZ]}
      />
      {/* Ambient fills every face evenly. The directional light comes from one
          side, so the three visible faces of every box get three tones, which is
          the whole isometric look. */}
      <ambientLight intensity={0.7} />
      <directionalLight intensity={1.4} position={[centerX + 8, 20, centerZ + 4]} />
      <gridHelper
        args={[GRID_SIZE, GRID_SIZE, '#1f2430', '#161a23']}
        position={[centerX, -0.01, centerZ]}
      />
      {children}
    </Canvas>
  );
}
