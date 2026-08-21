import type { ShaderContextValue } from '@camp-dev/shaders-react';
import type { ShaderNodeObject } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import type { Node } from 'three/webgpu';

/**
 * Add a fullscreen plane mesh with the given colorNode to the shader scene,
 * and return a cleanup callback that safely removes and disposes it.
 *
 * three's WebGPURenderer can throw during dispose() under rapid rebuild cycles
 * (Nodes bookkeeping race — CLAUDE.md gotcha #13-adjacent). The try/catch
 * swallows the benign error; GPU resources are reaped when the renderer itself
 * is disposed at unmount.
 */
export function addPlaneMesh(
  shaderContext: ShaderContextValue,
  colorNode: ShaderNodeObject<Node>,
): () => void {
  const material = new MeshBasicNodeMaterial();

  material.colorNode = colorNode;

  const mesh = new Mesh(new PlaneGeometry(2, 2), material);

  shaderContext.scene.add(mesh);

  return () => {
    shaderContext.scene.remove(mesh);
    try {
      material.dispose();
    } catch {
      /* benign during rebuild */
    }
    try {
      mesh.geometry.dispose();
    } catch {
      /* same */
    }
  };
}
