// The output stage of a ShaderScene: the base pass that renders the scene's
// meshes to a texture, the chain of post-process transforms that overlays
// register, and the full-screen quad that writes the composed result to the
// canvas. ShaderScene creates one per mount and hands the two register
// functions to its children through the context. It is written against
// three's renderer alone, with no React, so the scene component stays
// readable and this part has its own test.
//
// Why not three's PostProcessing class: in three 0.170 it keeps a SINGLE quad
// and material at module level, shared by every instance, so two scenes on
// one page overwrite each other's output and both canvases draw whichever
// scene updated last (the shared-quad gotcha in AGENTS.md). Owning the quad
// per stage is the whole fix. A three bump that gives PostProcessing a quad
// per instance could swap this back.
import { type Camera, LinearSRGBColorSpace, NoToneMapping, type Scene } from 'three';
import type { ShaderNodeObject } from 'three/tsl';
import { pass, passTexture, renderOutput, uv, vec4 } from 'three/tsl';
import type { Node, WebGPURenderer } from 'three/webgpu';
import { NodeMaterial, QuadMesh } from 'three/webgpu';

import { dither } from '../../primitives/dither/dither.js';

/** A post-process step: takes the composed pixel (rgba), returns its replacement. */
export type PostProcessTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

/**
 * A base-pass UV warp: takes the coordinate the scene texture is about to be
 * sampled at (0..1 across the canvas) and returns a replacement. Lets an
 * overlay resample the rendered scene, such as snapping to a grid for
 * pixelation, which a color-only PostProcessTransform cannot express.
 */
export type UvTransform = (uv: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

// Function-typed properties rather than methods, because ShaderScene hands
// the two register functions to its context detached from this object.
export interface OutputStage {
  /** Add a post-process step after the ones already registered. Returns its remover. */
  registerOverlay: (transform: PostProcessTransform) => () => void;
  /** Add a base-pass UV warp after the ones already registered. Returns its remover. */
  registerBaseUvTransform: (transform: UvTransform) => () => void;
  /** True while at least one overlay is registered, which counts as something to draw. */
  hasOverlays: () => boolean;
  /** Draw the composed scene to the canvas. */
  render: () => void;
  /** Release the quad's material. The renderer stays the caller's to dispose. */
  dispose: () => void;
}

// ----------------------------------------------------------------------------
// Building the stage
// ----------------------------------------------------------------------------

export function createOutputStage(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
): OutputStage {
  const outputMaterial = new NodeMaterial();

  outputMaterial.name = 'ShaderScene output';
  const outputQuad = new QuadMesh(outputMaterial);

  // The chain: base pass first (the scene's meshes rendered to a texture),
  // then each registered overlay transform in MOUNT ORDER. A Map iterates in
  // insertion order, so <Grain> after <Vignette> grains the vignetted image.
  // UV transforms warp where the base pass texture is sampled (<Dither>'s
  // pixel snap, say) and compose in mount order too.
  const overlays = new Map<symbol, PostProcessTransform>();
  const uvTransforms = new Map<symbol, UvTransform>();
  const scenePass = pass(scene, camera);

  const rebuildOutputNode = () => {
    // With no UV transforms the pass node samples itself at the screen
    // coordinate. With any registered, resample its texture at the warped
    // coordinate, where uv() is the output quad's 0..1 screen position.
    // passTexture wraps the pass's color texture in a sampleable TextureNode
    // (getTextureNode's typing is too loose to chain .uv from); its setup()
    // still builds the pass itself, so the scene renders even though only its
    // texture appears in the graph.
    const scenePassTexture = passTexture(scenePass, scenePass.getTexture('output'));
    const basePassNode =
      uvTransforms.size === 0
        ? vec4(scenePass)
        : vec4(
            scenePassTexture.uv(
              Array.from(uvTransforms.values()).reduce<ShaderNodeObject<Node>>(
                (coordinate, transform) => transform(coordinate),
                uv(),
              ),
            ),
          );

    // Overlays (Grain, Vignette, ...) compose in linear working space.
    const composed = Array.from(overlays.values()).reduce(
      (currentPipeline, transform) => transform(currentPipeline),
      basePassNode,
    );

    // renderOutput applies tone mapping plus the working-to-output color
    // space transfer, reading both from the context set here (the renderer's
    // own settings, captured the way three's PostProcessing captures them),
    // so dither runs last, in display-encoded space, right before 8-bit
    // quantization. That breaks up gradient banding uniformly across every
    // component in the scene. needsUpdate is what makes the renderer
    // recompile the quad's program on its next draw.
    const { toneMapping, outputColorSpace } = renderer;

    outputMaterial.fragmentNode = dither(renderOutput(composed)).context({
      toneMapping,
      outputColorSpace,
    });
    outputMaterial.needsUpdate = true;
  };

  rebuildOutputNode();

  return {
    registerOverlay(transform) {
      const key = Symbol('overlay');

      overlays.set(key, transform);
      rebuildOutputNode();

      return () => {
        overlays.delete(key);
        rebuildOutputNode();
      };
    },

    registerBaseUvTransform(transform) {
      const key = Symbol('uv-transform');

      uvTransforms.set(key, transform);
      rebuildOutputNode();

      return () => {
        uvTransforms.delete(key);
        rebuildOutputNode();
      };
    },

    hasOverlays: () => overlays.size > 0,

    // Draw the quad the way PostProcessing.render does: the quad's material
    // already applied tone mapping and the output transfer (renderOutput
    // above), so the renderer's own pass of both is switched off for this
    // one draw and restored after, or the canvas would be tone-mapped and
    // encoded twice.
    render() {
      const { toneMapping, outputColorSpace } = renderer;

      renderer.toneMapping = NoToneMapping;
      renderer.outputColorSpace = LinearSRGBColorSpace;
      outputQuad.render(renderer);
      renderer.toneMapping = toneMapping;
      renderer.outputColorSpace = outputColorSpace;
    },

    dispose() {
      outputMaterial.dispose();
    },
  };
}
