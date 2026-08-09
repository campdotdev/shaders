'use client';

// Raw-field probe for the voronoiCells primitive: grayscale hash per cell,
// darkened toward every border. One image proves all three outputs — flat
// gray patches = per-cell hash is stable; dark seams = edgeDistance works;
// seams of EQUAL width everywhere (including near corners) = pass 2's exact
// bisector distance works. Swap the colorNode lines below to isolate fields.
import { useEffect } from 'react';

import { voronoiCells } from '@lovo/matter';
import { ShaderScene, useShaderContext } from '@lovo/matter-react';
import { smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

function VoronoiProbe() {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    const cells = voronoiCells(uv().mul(6), { jitter: uniform(1) });

    const material = new MeshBasicNodeMaterial();

    // Default view: hash × border shading.
    material.colorNode = vec3(cells.hash.mul(smoothstep(0.0, 0.05, cells.edgeDistance)));
    // Alternate views (swap in one at a time while probing; `length` comes
    // from three/tsl):
    // material.colorNode = vec3(cells.edgeDistance.mul(4)); // raw border distance ramp
    // material.colorNode = vec3(length(cells.seedOffset));  // radial distance to each seed

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
      try {
        mesh.geometry.dispose();
      } catch {
        // same
      }
    };
  }, [shaderContext]);

  return null;
}

export default function ProbeScene() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ShaderScene>
        <VoronoiProbe />
      </ShaderScene>
    </div>
  );
}
