// The output stage of a ShaderScene: the base pass that renders the scene's
// meshes to a texture, the resamples and post-process transforms that
// Effects register, and the full-screen quad that writes the composed result
// to the canvas, plus the pre-passes that draw before the scene. ShaderScene
// creates one per mount and hands its register functions and the GPU timer's
// switch to its children through the context.
// It is written against three's renderer alone, with no React, so the scene
// component stays readable and this part has its own test.
//
// Why not three's PostProcessing class: in three 0.170 it keeps a SINGLE quad
// and material at module level, shared by every instance, so two scenes on
// one page overwrite each other's output and both canvases draw whichever
// scene updated last (the shared-quad gotcha in docs/agents/tsl.md). Owning
// the quad per stage is the whole fix. A three bump that gives
// PostProcessing a quad per instance could swap this back.
import { type Camera, LinearSRGBColorSpace, NoToneMapping, type Scene } from 'three';
import type { ShaderNodeObject } from 'three/tsl';
import { pass, passTexture, renderOutput, uv, vec4 } from 'three/tsl';
import type { Node, WebGPURenderer } from 'three/webgpu';
import { NodeMaterial, QuadMesh } from 'three/webgpu';

import { dither } from '../../primitives/dither/dither.js';
import { createGpuTimer, type TimeGpu } from '../gpu-timer/gpu-timer.js';

/** A post-process step: takes the composed pixel (rgba), returns its replacement. */
export type PostProcessTransform = (input: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

/**
 * Reads the image beneath an Effect at a coordinate (0..1 across the canvas)
 * and returns its rgba. It is a function that builds shader nodes, not a GPU
 * sampler object.
 */
export type Sampler = (coordinate: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

/**
 * An Effect's resample: takes the sampler for everything beneath the Effect
 * and returns the sampler that replaces it. The new sampler can call the one
 * beneath more than once, such as three times for a color split. A
 * PostProcessTransform sees only the composed pixel, so it cannot read the
 * image anywhere else.
 */
export type Resample = (sampleBeneath: Sampler) => Sampler;

/**
 * A UV warp: takes the coordinate the image beneath an Effect is about to be
 * sampled at (0..1 across the canvas) and returns a replacement, such as a
 * coordinate snapped to a grid for pixelation. It is the resample that
 * samples the image beneath once, at the moved coordinate.
 */
export type UvTransform = (uv: ShaderNodeObject<Node>) => ShaderNodeObject<Node>;

/**
 * A draw into a texture that the scene's meshes read, such as Aurora's field.
 * The stage runs it before the scene pass on every frame it draws (the
 * draw-order gotcha in docs/agents/tsl.md).
 */
export type PrePass = () => void;

// Function-typed properties rather than methods, because ShaderScene hands
// the register functions to its context detached from this object.
export interface OutputStage {
  /** Add a post-process step after the ones already registered. Returns its remover. */
  registerOverlay: (transform: PostProcessTransform) => () => void;
  /**
   * Add a resample above the ones already registered, so its sampler wraps
   * theirs. Returns its remover.
   */
  registerResample: (resample: Resample) => () => void;
  /**
   * Add a draw that runs before the scene pass, after the ones already
   * registered, on every frame and on the redraw after a resize. Returns its
   * remover.
   */
  registerPrePass: (prePass: PrePass) => () => void;
  /** True while at least one overlay is registered, which counts as something to draw. */
  hasOverlays: () => boolean;
  /** Turn on GPU timing for every pass render() draws: the pre-passes, the scene pass, and the output quad. */
  timeGpu: TimeGpu;
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

  // The chain: base pass first (the scene's meshes rendered to a texture
  // and read through every resample), then each registered overlay
  // transform in MOUNT ORDER. A Map iterates in insertion order, so <Grain>
  // after <Vignette> grains the vignetted image. Resamples stack in mount
  // order too: each one wraps the samplers registered before it.
  const overlays = new Map<symbol, PostProcessTransform>();
  const resamples = new Map<symbol, Resample>();
  // Pre-passes draw before the chain, in mount order too. They change no
  // node in the output graph, so registering one rebuilds nothing.
  const prePasses = new Map<symbol, PrePass>();
  // The scene pass keeps no depth buffer, the per-pixel distances three tests
  // to hide a farther surface behind a nearer one, because every component's
  // quad sits at the same depth (the no-depth gotcha in docs/agents/tsl.md).
  // On WebGPU the pass keeps as many color samples per pixel as the renderer
  // does, so createRenderer's antialias option decides its MSAA.
  const scenePass = pass(scene, camera, { depthBuffer: false });
  // Times every pass render() draws: the pre-passes, the scene pass that
  // renders the meshes into its own render target, and the quad that draws
  // the composed result to the canvas.
  const gpuTimer = createGpuTimer(renderer);

  const rebuildOutputNode = () => {
    // With no resample the pass node samples itself at the screen
    // coordinate. With any registered, each resample wraps the sampler
    // beneath it, starting from a read of the scene's texture. The
    // last-registered one is the outermost function, and the stage calls it
    // once per pixel at uv(), the output quad's 0..1 screen position. So the
    // last-mounted Effect's UV warp moves the screen coordinate first, and
    // that Effect acts as the top layer.
    // passTexture wraps the pass's color texture in a sampleable TextureNode
    // (getTextureNode's typing is too loose to chain .uv from); its setup()
    // still builds the pass itself, so the scene renders even though only its
    // texture appears in the graph. A pass texture turns the texture matrix
    // off, and every .uv() read cloned from it keeps it off, so no read pays
    // the multiply (the texture-matrix gotcha in docs/agents/tsl.md).
    const scenePassTexture = passTexture(scenePass, scenePass.getTexture('output'));
    const sampleScene: Sampler = (coordinate) => scenePassTexture.uv(coordinate);
    const sampleTop = Array.from(resamples.values()).reduce(
      (sampleBeneath, resample) => resample(sampleBeneath),
      sampleScene,
    );
    const basePassNode = resamples.size === 0 ? vec4(scenePass) : vec4(sampleTop(uv()));

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

    registerResample(resample) {
      const key = Symbol('resample');

      resamples.set(key, resample);
      rebuildOutputNode();

      return () => {
        resamples.delete(key);
        rebuildOutputNode();
      };
    },

    registerPrePass(prePass) {
      const key = Symbol('pre-pass');

      prePasses.set(key, prePass);

      return () => {
        prePasses.delete(key);
      };
    },

    hasOverlays: () => overlays.size > 0,

    timeGpu: gpuTimer.start,

    // Run the pre-passes, then draw the quad the way PostProcessing.render
    // does: the quad's material already applied tone mapping and the output
    // transfer (renderOutput above), so the renderer's own pass of both is
    // switched off for this one draw and restored after, or the canvas
    // would be tone-mapped and encoded twice. The restore runs in a finally
    // block so a draw that throws (a lost device, say) cannot leave both
    // switched off, where the next rebuildOutputNode would capture them and
    // bake the wrong settings into the quad's material for every frame
    // after. The timer wraps the whole draw: the pre-passes, then the quad,
    // during which three renders the scene pass the quad samples.
    render() {
      gpuTimer.measure(() => {
        for (const prePass of prePasses.values()) prePass();
        const { toneMapping, outputColorSpace } = renderer;

        renderer.toneMapping = NoToneMapping;
        renderer.outputColorSpace = LinearSRGBColorSpace;
        try {
          outputQuad.render(renderer);
        } finally {
          renderer.toneMapping = toneMapping;
          renderer.outputColorSpace = outputColorSpace;
        }
      });
    },

    dispose() {
      outputMaterial.dispose();
    },
  };
}
