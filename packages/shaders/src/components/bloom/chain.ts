// The bloom's blur chain: a stack of textures, each half the size of the
// one before, that turns the bright parts of the image into a wide, soft
// glow. A wide blur at the canvas's size would read hundreds of pixels for
// each pixel. Halving the image first makes each read cover twice the
// distance, so a few reads at each size add up to the same blur. The chain
// shrinks the bright parts level by level, then works back up, adding each
// level to the one above it. Bloom's shader (./shader.tsx) hands it
// the bright parts and reads the glow back. It holds no React: `start`
// takes the scene's context only for its renderer, its canvas size, and
// its scheduler.
import type { ShaderNodeObject } from 'three/tsl';
import { clamp, float, passTexture, texture, uniform, uv, vec2, vec4 } from 'three/tsl';
import {
  HalfFloatType,
  LinearFilter,
  Node,
  NodeUpdateType,
  type PassNode,
  RenderTarget,
  type Texture,
  Vector2,
  type WebGPURenderer,
} from 'three/webgpu';

import { createTexturePass, type TexturePass } from '../../engine.js';
import type { ShaderContextValue } from '../../react/context/shader-context.js';
import type { ResizeValue } from '../../react/hooks/use-resize/use-resize.js';

type TSLValue = ShaderNodeObject<Node>;
type TexelUniform = ReturnType<typeof uniform<Vector2>>;

// ---------------------------------------------
// Constants
// ---------------------------------------------

/**
 * The height the smallest level aims for, in texels (pixels of a texture).
 * The chain keeps halving until one more halving would go below this, so
 * the smallest level is 8 to 15 texels tall on any canvas. Its blur reaches
 * about three of its texels, which is about a third of the canvas's height
 * at 8. Lower adds levels and a wider glow, and higher stops sooner.
 */
const COARSEST_HEIGHT = 8;

/**
 * The most levels the chain builds. Each level is two more draws a frame.
 * 8 levels reach the coarsest height on a canvas up to 4095 device pixels
 * tall, and a taller canvas gets a glow that is narrower for its size.
 */
const MAX_LEVELS = 8;

/**
 * The two ends of the glow, as scales. A level's scale is the log2 of its
 * height in texels, so a level 256 texels tall is at scale 8, and one
 * step down in scale is one halving. A scale names a blur width as a share
 * of the canvas, whatever the canvas's resolution: one texel at scale 8 is
 * 1/256 of the canvas's height on a small canvas and on a large one.
 *
 * The glow is the band of scales from FINEST_SCALE down to where `radius`
 * puts the other end, and COARSEST_SCALE is that end at a radius of 1.
 * Levels finer than the band still exist on a tall canvas, because the
 * chain has to halve its way down to the band, but they add nothing to
 * the glow. That is what makes the glow the same on a 1x and a 2x display.
 *
 * Raising FINEST_SCALE adds a tighter, hotter rim. A canvas shorter than
 * 2 ** (FINEST_SCALE + 1) device pixels has no level fine enough to draw
 * all of it, and its first level stands in for the ones it lacks (see the
 * weights in buildLevels).
 * COARSEST_SCALE is one above the scale of COARSEST_HEIGHT, so the
 * smallest level fades in as the canvas grows instead of switching on.
 */
const FINEST_SCALE = 8;
const COARSEST_SCALE = Math.log2(COARSEST_HEIGHT) + 1;

/**
 * The scale of the chain's first level on a canvas this many device pixels
 * tall: the log2 of half the height. Level `index` is `index` scales below.
 */
export function firstLevelScale(heightPx: number): number {
  return Math.log2(Math.max(heightPx, 1)) - 1;
}

/**
 * How many levels the chain builds for a canvas this many device pixels
 * tall: the number of times the height halves before it would drop below
 * COARSEST_HEIGHT, kept between 2 and MAX_LEVELS. A canvas 1392 pixels tall
 * gets 7, the smallest about 11 texels tall. Doubling the canvas adds one
 * level, so the glow keeps its size as a share of the canvas.
 *
 * The least is 2 because a level's weight goes on in an up pass, and a
 * chain of one level has no up pass. A canvas under 32 pixels tall would
 * otherwise show its one level at full strength, whatever `radius` is.
 */
export function levelCount(heightPx: number): number {
  const halvings = Math.floor(Math.log2(Math.max(heightPx, 1) / COARSEST_HEIGHT));

  return Math.min(MAX_LEVELS, Math.max(2, halvings));
}

/**
 * The size of level `index` in texels, for a canvas in device pixels. Level
 * 0 is half the canvas, and each level after is half the one before. A
 * texture needs at least one texel a side.
 */
export function levelSize(widthPx: number, heightPx: number, index: number): [number, number] {
  const divisor = 2 ** (index + 1);

  return [Math.max(1, Math.round(widthPx / divisor)), Math.max(1, Math.round(heightPx / divisor))];
}

// ---------------------------------------------
// The two filters
// ---------------------------------------------

/**
 * Read `map` at this texel's place, moved by `offset` texels of `map`.
 * uv() is the 0..1 position of the texel being drawn, and `texel` is the
 * size of one of `map`'s texels in that 0..1 space. The coordinate goes in
 * when the node is built, which skips three's texture matrix (the
 * texture-matrix gotcha in docs/agents/tsl.md). `texel` is a vec2 uniform,
 * so it is passed as an argument, never chained from (the vec-uniform
 * gotcha in the same file).
 */
const readAt = (map: Texture, texel: TexelUniform, offsetX: number, offsetY: number): TSLValue =>
  vec4(texture(map, uv().add(vec2(offsetX, offsetY).mul(texel))));

/**
 * Shrink `map` to half its size: the average of four reads, one texel out
 * along each diagonal. The texel being drawn sits where four of `map`'s
 * texels meet. Each read lands where four more meet, and the linear filter
 * returns the average of those four. So the four reads cover a 4 by 4
 * block of `map`, twice as wide as the 2 by 2 block that falls under this
 * texel. The blocks of neighboring texels overlap, which keeps a small
 * bright spot from flickering as it moves between them.
 */
const shrink = (map: Texture, texel: TexelUniform): TSLValue =>
  readAt(map, texel, -1, -1)
    .add(readAt(map, texel, 1, -1))
    .add(readAt(map, texel, -1, 1))
    .add(readAt(map, texel, 1, 1))
    .mul(0.25);

/**
 * Read `map`, a smaller level, at this texel's place through a tent filter:
 * nine reads in a 3 by 3 grid one texel apart, weighted 1-2-1 along each
 * axis, so the center counts four times as much as a corner and the
 * weights fall off in straight lines, like a tent's sides. The weights sum
 * to 16. A plain linear read of a smaller texture shows its texels as
 * faint diamonds. The tent spreads each texel over its neighbors, which
 * hides them.
 */
const tent = (map: Texture, texel: TexelUniform): TSLValue => {
  const corners = readAt(map, texel, -1, -1)
    .add(readAt(map, texel, 1, -1))
    .add(readAt(map, texel, -1, 1))
    .add(readAt(map, texel, 1, 1));
  const edges = readAt(map, texel, 0, -1)
    .add(readAt(map, texel, -1, 0))
    .add(readAt(map, texel, 1, 0))
    .add(readAt(map, texel, 0, 1));
  const center = readAt(map, texel, 0, 0);

  return corners.add(edges.mul(2)).add(center.mul(4)).div(16);
};

// ---------------------------------------------
// The node that draws the chain
// ---------------------------------------------

/**
 * A node that draws nothing into the shader and exists for its
 * `updateBefore`. three calls it once a frame, before it draws any material
 * whose graph holds this node. The glow's texture node carries it, so the
 * chain draws during the output quad's draw. The chain's first pass reads
 * the scene's texture, whose pass node works the same way, so three draws
 * the scene before that first pass, whichever of the two nodes it reaches
 * first (ADR 0010).
 */
class ChainDrawNode extends Node {
  private readonly draw: () => void;

  constructor(draw: () => void) {
    super('void');
    this.draw = draw;
    this.updateBeforeType = NodeUpdateType.FRAME;
  }

  override updateBefore(): void {
    this.draw();
  }
}

// ---------------------------------------------
// The levels
// ---------------------------------------------

/** One level of a built chain. */
interface Level {
  /** The pass that shrinks the level above into this one. Level 0's draws the bright parts. */
  down: TexturePass;
  /** What `down` draws into. */
  shrunk: Texture;
  /**
   * The pass that adds the summed level below it to this level's shrunk
   * image. The smallest level has none, because nothing is below it.
   */
  up: TexturePass | null;
  /** The size of one texel of this level, in 0..1, for the filters' reads. */
  texel: Vector2;
}

/** The levels of a built chain, largest first, and the texture the glow is read from. */
interface Levels {
  levels: Level[];
  /** The finished glow: the largest level's summed image. */
  glow: Texture;
}

/**
 * Set `texel` to one texel of what `pass` draws into, at the size it was
 * allocated. createTexturePass clamps each side to the device's limit, so
 * on a very wide or tall canvas a level is smaller than levelSize asks
 * for, and the filters' reads have to step by the texels it really has.
 */
function fitTexel(texel: Vector2, pass: TexturePass): void {
  texel.set(1 / pass.width, 1 / pass.height);
}

/** What the chain blurs until Bloom sets a source: nothing, so the glow is empty. */
const transparent = vec4(0, 0, 0, 0);

/**
 * Build every pass for a canvas of this size, or return null when the
 * renderer cannot draw into half-float targets or has lost its device.
 */
function buildLevels(
  renderer: WebGPURenderer,
  source: TSLValue,
  radius: TSLValue,
  firstScale: TSLValue,
  widthPx: number,
  heightPx: number,
): Levels | null {
  const count = levelCount(heightPx);
  const levels: Level[] = [];
  const passes: TexturePass[] = [];

  // Half floats, 16-bit numbers that keep values past 1, so light brighter
  // than white survives the chain. The linear filter is what lets one read
  // between texels return the average of the four around it, which both
  // filters above count on.
  const createPass = (node: TSLValue, index: number): TexturePass => {
    const [width, height] = levelSize(widthPx, heightPx, index);
    const pass = createTexturePass(renderer, node, {
      width,
      height,
      type: HalfFloatType,
      filter: LinearFilter,
    });

    passes.push(pass);

    return pass;
  };

  const fail = () => {
    for (const pass of passes) pass.dispose();

    return null;
  };

  // Down: level 0 draws the bright parts at half the canvas's size, and
  // each level after shrinks the one before.
  for (let index = 0; index < count; index += 1) {
    const above = levels.at(-1);
    const down = createPass(above ? shrink(above.shrunk, uniform(above.texel)) : source, index);
    const shrunk = down.texture;

    if (shrunk === null) return fail();
    const texel = new Vector2();

    fitTexel(texel, down);
    levels.push({ down, shrunk, up: null, texel });
  }

  // Up: from the second-smallest level to the largest, add the summed
  // level below, read through the tent, to each level's own shrunk image.
  // The glow is then the sum of the levels: a narrow blur, plus one twice
  // as wide, plus one twice as wide again.
  //
  // The sum is what gives the glow its shape. Each level holds the same
  // light spread over four times the area of the level above, so it is a
  // quarter as bright at its center and reaches twice as far. Stacked, they
  // make a glow that is hot against the light and falls to a quarter each
  // time the distance doubles, which is how light scattered in a lens or
  // in haze falls off. One blur alone, however wide, is flat on top and
  // ends at an edge. Nothing divides the sum, so a wider glow holds more
  // light, and its hot center stays as bright as it was.
  //
  // Each level joins the sum by a weight, and the weight depends only on
  // the level's scale (see FINEST_SCALE), never on its index. A level
  // inside the band counts in full. At each end of the band the weight
  // falls to 0 over one scale, in a straight line. The levels sit one
  // scale apart, so as the canvas grows and every level's scale slides up,
  // the weight one level loses on a ramp is the weight its neighbor gains,
  // and the sum of the weights never changes. So the glow holds the same
  // light at every resolution, and no level ever switches on or off.
  //
  // `radius` moves the band's coarse end, from FINEST_SCALE at 0, where
  // the band is one scale wide, to COARSEST_SCALE at 1. clamp is a plain
  // GPU function, so the dial moves without rebuilding anything.
  //
  // That sum holds only while the chain has a level at every scale in the
  // band. On a canvas under 512 device pixels tall the first level is
  // already coarser than FINEST_SCALE, so the band's finer scales have no
  // level, and their weight would be lost: the glow would dim as the
  // canvas shrank, and a small scene would glow less on a 1x display than
  // on a 2x one. So the first level also takes the weight of every level
  // that would sit above it, one scale apart, had the canvas been taller.
  // Those weights add up to a short formula. Count from the fine end of
  // the band, FINEST_SCALE + 1, down to the first level's scale: the
  // weights of the levels from there up sum to that distance, because each
  // full level adds 1 and the two ramps add what is left over. The sum
  // stops growing at the whole band's weight, FINEST_SCALE + 1 minus the
  // coarse end. At a first scale of 8 or more this is fadeOut, the same
  // weight as before. At 7.5 it is 1.5: the level's own 1, plus the 0.5 of
  // the missing level at 8.5. The small canvas then holds the same light
  // as a large one, drawn by a coarser level, which is as fine as its
  // pixels can show.
  const coarseEnd = clamp(radius, 0, 1)
    .mul(COARSEST_SCALE - FINEST_SCALE)
    .add(FINEST_SCALE);
  const fineEnd = float(FINEST_SCALE + 1);
  const weightAt = (index: number): TSLValue => {
    const scale = firstScale.sub(index);

    if (index === 0) return clamp(fineEnd.sub(scale), 0, fineEnd.sub(coarseEnd));
    const fadeIn = clamp(scale.sub(coarseEnd).add(1), 0, 1);
    const fadeOut = clamp(fineEnd.sub(scale), 0, 1);

    return fadeIn.mul(fadeOut);
  };
  // The smallest level has nothing below it to add, so no pass sums it,
  // and its weight goes on where the level above reads it. Every other
  // level's weight goes on in its own pass, so the sum below it reads as 1.
  let below: { image: Texture; texel: Vector2; weight: TSLValue } | null = null;

  for (const [index, level] of [...levels.entries()].reverse()) {
    if (below === null) {
      below = { image: level.shrunk, texel: level.texel, weight: weightAt(index) };
      continue;
    }
    const own = vec4(texture(level.shrunk, uv())).mul(weightAt(index));
    const up = createPass(
      own.add(tent(below.image, uniform(below.texel)).mul(below.weight)),
      index,
    );
    const summed = up.texture;

    if (summed === null) return fail();
    level.up = up;
    below = { image: summed, texel: level.texel, weight: float(1) };
  }

  return below ? { levels, glow: below.image } : fail();
}

// ---------------------------------------------
// The chain
// ---------------------------------------------

export interface BloomChain {
  /**
   * Set what the chain blurs: a node for the bright parts of the image,
   * drawn across the first level by uv(). The output stage hands Bloom the
   * image again each time it rebuilds, and this takes the new node without
   * rebuilding the levels.
   */
  setSource: (source: TSLValue) => void;
  /**
   * The size of one texel of the first level, in 0..1 across the canvas, as
   * a vec2 uniform. The first level is half the canvas's size, so one texel
   * spans two of the canvas's pixels each way. The source uses it to aim
   * its reads at single pixels.
   */
  firstTexel: TexelUniform;
  /** The glow at a 0..1 canvas coordinate, as a node. Transparent black until the chain has drawn. */
  glowAt: (coordinate: TSLValue) => TSLValue;
  /**
   * Allocate the levels for a scene, size them to its canvas, and keep them
   * sized. Returns the function that releases them.
   */
  start: (shaderContext: ShaderContextValue) => () => void;
}

/**
 * Create a chain. `radius` is how far the glow's band of scales reaches
 * toward the wide end, from 0 for the finest scale alone to 1 for all of
 * them, as a node. Values outside 0 to 1 clamp. `isOn` is asked once a frame, and the chain skips that
 * frame's draws when it returns false, so a glow nobody will see costs no
 * draws. Creating a chain allocates nothing on the GPU, so it is
 * safe in a memo. `start` does.
 */
export function createBloomChain(radius: TSLValue, isOn: () => boolean = () => true): BloomChain {
  let built: Levels | null = null;
  let source: TSLValue = transparent;
  // Set by `start`: fits the levels to a canvas size that changed since the
  // last draw.
  let fitToCanvas: (() => void) | null = null;

  const draw = () => {
    fitToCanvas?.();
    if (!built || !isOn()) return;
    // Down the chain from the largest level, then back up from the
    // second-smallest. Each pass reads the one drawn just before it.
    for (const level of built.levels) level.down.render();
    for (const level of [...built.levels].reverse()) level.up?.render();
  };

  // A texture node is the GPU's handle on an image. Bloom's sampler reads
  // this one, and `start` points it at the chain's glow by writing
  // `.value`. Every read is a copy that looks up `.value` here, so the swap
  // reaches them all and Bloom never registers again.
  //
  // passTexture ties the texture node to the node that draws the chain:
  // building the texture node into a quad's material builds that node too,
  // which is what puts its updateBefore on the output quad. It also turns
  // three's texture matrix off for every read (the texture-matrix gotcha
  // in docs/agents/tsl.md). Its typing asks for three's own PassNode, but
  // it only ever calls build() on what it is given.
  //
  // Until the swap, the node holds a stand-in from a render target, a
  // texture the GPU can draw into, which nothing ever draws into. On the
  // WebGL2 fallback, three flips y when it reads a render target, and it
  // decides the flip from the texture the node holds when the shader
  // compiles, so the stand-in has to be a render target's texture too.
  const drawNode = new ChainDrawNode(draw);
  const standIn = new RenderTarget(1, 1).texture;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- @types/three 0.170 types passTexture's first argument as PassNode, but three.webgpu.js only calls build() on it, and three's own BloomNode passes itself the same way
  const glowTexture = passTexture(drawNode as unknown as PassNode, standIn);

  // 1 while the node holds the chain's glow, 0 otherwise, so the stand-in
  // and a chain the renderer could not build both read as no glow.
  const ready = uniform(0);

  // The first level's texel size, kept in one uniform for the chain's whole
  // life, so the source can hold it across a rebuild of the levels.
  const firstTexelSize = new Vector2(1, 1);
  const firstTexel = uniform(firstTexelSize);

  // The first level's scale, which every level's weight is worked out
  // from. It follows the canvas's height, so a resize moves the weights
  // without rebuilding a pass.
  const firstScale = uniform(0);

  return {
    setSource(nextSource) {
      source = nextSource;
      built?.levels[0]?.down.setNode(nextSource);
    },

    firstTexel,

    glowAt: (coordinate) => glowTexture.uv(coordinate).mul(ready),

    start(shaderContext) {
      const renderer = shaderContext.renderer.three;

      // An earlier stop disposed the stand-in, which drops three's record of
      // it but leaves its version as it was, so a sampler still bound to it
      // never asks for a new upload. A start that builds no levels, such as
      // Strict Mode's second start on a renderer without half-float targets,
      // keeps sampling it. Bumping the version makes three upload it again.
      standIn.needsUpdate = true;

      const release = () => {
        if (!built) return;
        for (const level of built.levels) {
          level.down.dispose();
          level.up?.dispose();
        }
        built = null;
        glowTexture.value = standIn;
        ready.value = 0;
      };

      // Size the levels to the canvas: its CSS size times the renderer's
      // pixel ratio, rather than the drawing buffer, which still holds the
      // old size when a zoom reaches this listener before the renderer
      // resizes. While the number of levels holds, each pass keeps its
      // texture object through the resize, so every node stays bound (the
      // resize-rebind gotcha in docs/agents/tsl.md), and the texel sizes
      // are written into the uniforms the filters already read. A canvas
      // that halves or doubles changes the number of levels, and the chain
      // is built again.
      const fit = ([width, height]: ResizeValue) => {
        const pixelRatio = renderer.getPixelRatio();
        const widthPx = width * pixelRatio;
        const heightPx = height * pixelRatio;

        firstScale.value = firstLevelScale(heightPx);

        if (built?.levels.length === levelCount(heightPx)) {
          for (const [index, level] of built.levels.entries()) {
            const [levelWidth, levelHeight] = levelSize(widthPx, heightPx, index);

            level.down.resize(levelWidth, levelHeight);
            level.up?.resize(levelWidth, levelHeight);
            fitTexel(level.texel, level.down);
          }
        } else {
          release();
          built = buildLevels(renderer, source, radius, float(firstScale), widthPx, heightPx);
          if (built) {
            glowTexture.value = built.glow;
            ready.value = 1;
          }
        }

        // The first level's texel, as allocated. Without a chain there is no
        // glow to aim at, so the size it would have had stands in.
        const first = built?.levels[0];

        if (first) {
          firstTexelSize.copy(first.texel);
        } else {
          const [firstWidth, firstHeight] = levelSize(widthPx, heightPx, 0);

          firstTexelSize.set(1 / firstWidth, 1 / firstHeight);
        }
      };

      fit(shaderContext.canvasSize.get());
      shaderContext.scheduler.requestRender();

      // A later change of size waits for the chain's next draw. Resizing a
      // target empties it, and the scene redraws in the same browser frame
      // as the resize. three calls updateBefore once per browser frame, so
      // when the loop has already drawn that frame, the redraw draws no
      // chain, and an emptied target would show as a frame with no glow on
      // every step of a window drag. Left alone, the targets keep the last
      // frame's glow, stretched to the new canvas for that one redraw, as
      // the scene pass keeps its own image. The frame request makes sure a
      // draw follows, so a parked scene gets the glow at its new size (the
      // bare-uniform-write gotcha in docs/agents/tsl.md).
      let resizedTo: ResizeValue | null = null;

      fitToCanvas = () => {
        if (!resizedTo) return;
        fit(resizedTo);
        resizedTo = null;
      };
      const stopFitting = shaderContext.canvasSize.on('change', (size) => {
        resizedTo = size;
        shaderContext.scheduler.requestRender();
      });

      return () => {
        fitToCanvas = null;
        stopFitting();
        release();
        // A shader that samples the stand-in gives it a GPU texture, and
        // three frees a texture it only samples when the texture itself is
        // disposed. Its render target was never drawn into, so disposing
        // the target would free nothing. A later start marks it for upload
        // again.
        standIn.dispose();
      };
    },
  };
}
