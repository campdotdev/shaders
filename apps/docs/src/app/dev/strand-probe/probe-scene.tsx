'use client';

// Probe for the strand primitives (SHA-331): plain sine-wave strands, drawn
// the way a Mode 2 user draws them. createStrandGeometry builds the mesh,
// extrudeStrand widens a path into strips, strandProfile shades across each
// strip, and useShaderMaterial turns the two into an additive material.
// There is no ShaderScene here. The docs app has no react-three-fiber, so
// the probe stands in for a user's own scene with the engine's renderer, a
// plain three scene, and its own camera.
//
// It has two views. The flat view draws the strands side by side through an
// orthographic camera. `?camera=perspective` lays the same strands out in
// depth, one behind the next, under a perspective camera, with a ball in
// the middle of them: strands behind the ball are hidden, strands in front
// draw over it, and every strand keeps its width however far away it is.
// The paired spec is visual/strand.spec.ts.
//
// Query params: `?strandWidth=` sets how thick a strand is in CSS pixels,
// `?strands=` the strand count, `?spread=` how far apart the strands sit,
// and `?scatter=` how far each strand strays from its neighbors. `?mesh=0`
// leaves the ball out. `?visualTest=1` holds time at 0 and flags the page
// ready after its second frame.
import { useEffect, useRef } from 'react';

import {
  createRenderer,
  createStrandGeometry,
  extrudeStrand,
  type GpuRenderer,
  strandAttributes,
  type StrandPath,
  strandProfile,
  useShaderMaterial,
} from '@camp-dev/shaders';
import { mix, type ShaderNodeObject, sin, uniform, vec3 } from 'three/tsl';
import { Mesh, OrthographicCamera, PerspectiveCamera, Scene, SphereGeometry } from 'three/webgpu';
import type { Node } from 'three/webgpu';

type TSLValue = ShaderNodeObject<Node>;

// ----------------------------------------------------------------------------
// Dials
// ----------------------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const numberParam = (name: string, fallback: number) => {
  const value = Number(params.get(name) ?? Number.NaN);

  return Number.isFinite(value) ? value : fallback;
};

const VISUAL_TEST = params.get('visualTest') === '1';
const PERSPECTIVE = params.get('camera') === 'perspective';
const SHOW_BALL = PERSPECTIVE && params.get('mesh') !== '0';

// How many strands, and how many points along each one. 256 samples keep a
// strand smooth across a wide canvas: each segment is a few pixels long.
const STRANDS = Math.max(1, Math.round(numberParam('strands', 24)));
const SAMPLES = 256;

// Uniforms: values the shader reads that JS can change without rebuilding
// the material. `time` is in seconds, and `strandWidth` in CSS pixels.
const time = uniform(0);
const strandWidth = uniform(numberParam('strandWidth', 3));

// How far apart the first and last strands sit, in the path's own units. In
// the flat view the canvas is 2 units wide, and at 0 every strand shares one
// lane. In the perspective view it is how deep the row of strands runs.
const spread = uniform(numberParam('spread', PERSPECTIVE ? 9 : 0.9));

// How far each strand strays from its neighbors, from 0 to 1. At 0 every
// strand follows the same wave, so the strands run side by side like the
// lines of a ribbon. At 1 each leans and wobbles on its own, and they cross.
// The perspective view starts at 0, so its strands stay in depth order.
const scatter = uniform(numberParam('scatter', PERSPECTIVE ? 0 : 1));

// How much light one strand adds at its center line, per color channel.
// Below 1 on every channel, so one strand alone is a dim blue and a crossing
// of several adds up toward white.
const STRAND_LIGHT = [0.12, 0.3, 0.75] as const;

// ----------------------------------------------------------------------------
// The path and the material
// ----------------------------------------------------------------------------

// How high a strand rides at a point `x` along it: two waves added
// together.
//   - A slow wave. `scatter` shifts its phase by `across`, so neighbors
//     lean into each other and cross. With no scatter, every strand rides
//     the same wave.
//   - A faster, smaller wave with a random phase per strand, from `seed`,
//     and a height that `scatter` scales.
// The spacing and the randomness live in the path, and not in
// extrudeStrand, which only widens whatever curve the path describes.
//
// Each wave has a frequency, in radians per unit of x: higher packs more
// crests into the strand. It has a height in the path's units, and a speed
// in radians per second, where the sign sets which way the crests travel.
const SLOW_WAVE = { frequency: 4, height: 0.14, speed: 0.5 };
const FAST_WAVE = { frequency: 11, height: 0.04, speed: -0.8 };

// How far the slow wave's phase shifts from the first strand to the last at
// full scatter, in radians. 5 is most of a full turn (6.28), so the far
// strands run nearly opposite the near ones.
const LEAN = 5;

// A full turn in radians, which spreads the seed's 0 to 1 over every phase.
const FULL_TURN = Math.PI * 2;

const waveHeight = (x: TSLValue, across: TSLValue, seed: TSLValue) => {
  const lean = across.mul(LEAN).mul(scatter);
  const slow = sin(x.mul(SLOW_WAVE.frequency).add(lean).add(time.mul(SLOW_WAVE.speed))).mul(
    SLOW_WAVE.height,
  );
  const fast = sin(
    x.mul(FAST_WAVE.frequency).add(seed.mul(FULL_TURN)).add(time.mul(FAST_WAVE.speed)),
  )
    .mul(FAST_WAVE.height)
    .mul(scatter);

  return slow.add(fast);
};

// The flat view's path. The orthographic camera shows x from -1 to 1, so
// the strand runs a little past both edges of the canvas. Each strand has a
// lane, spread evenly over `spread` units of y by `across`, and rides the
// wave from there. z stays 0.
const flatPath: StrandPath = (along, across, seed) => {
  const x = mix(-1.1, 1.1, along);
  const lane = across.sub(0.5).mul(spread);

  return vec3(x, lane.add(waveHeight(x, across, seed)), 0);
};

// The perspective view's path. The strands lie side by side on a floor a
// little below the camera, each running left to right, and `across` now
// sets how far away a strand is: the first sits NEAR_Z in front of the
// origin, and each one after it is a step further back, down to `spread`
// units behind the first. The wave lifts a strand off the floor. The path
// says nothing about the camera. extrudeStrand projects these points
// through whichever camera draws the mesh.

// Where the nearest strand sits on the z axis, in the scene's units. The
// camera stands at z = 4 and looks toward negative z, so raising this brings
// the row of strands toward it.
const NEAR_Z = 1.5;

// The height of the floor the strands lie on. The camera is at y = 1.2, so
// lowering the floor shows the strands from further above.
const FLOOR_Y = -0.5;

// Half a strand's length along x. At 3, the nearest strands run past both
// edges of the canvas and the furthest end inside it.
const HALF_LENGTH = 3;

const depthPath: StrandPath = (along, across, seed) => {
  const x = mix(-HALF_LENGTH, HALF_LENGTH, along);
  const z = across.mul(spread).negate().add(NEAR_Z);

  return vec3(x, waveHeight(x, across, seed).add(FLOOR_Y), z);
};

// Hoisted so its reference is stable: useShaderMaterial rebuilds the
// material whenever the build callback changes (the build-callback gotcha in
// docs/agents/tsl.md).
const buildStrands = () => {
  const strand = extrudeStrand(PERSPECTIVE ? depthPath : flatPath, { strandWidth });
  const { seed } = strandAttributes();

  // The bell curve across the strip, times the strand's light. Each strand
  // is a little brighter or dimmer by its seed, from 0.6 to 1, so the
  // strands read as separate where they bunch.
  const brightness = strandProfile(strand.distance, strandWidth).mul(mix(0.6, 1, seed));

  return { color: vec3(...STRAND_LIGHT).mul(brightness), vertex: strand.position };
};

// The ball's material is useShaderMaterial's plain form: a color node and
// nothing else. A flat dull red, which no sum of the blue strands can pass
// for, and three's default blending, so the ball is solid and writes depth.
const buildBall = () => vec3(0.2, 0.03, 0.03);

// Where the ball sits and how big it is, in the scene's units: sunk a
// little into the floor, 3 units behind the origin. With the default spread, about half
// the strands pass in front of its center and half behind.
const BALL_CENTER = [0, -0.1, -3] as const;
const BALL_RADIUS = 0.8;

// ----------------------------------------------------------------------------
// The scene
// ----------------------------------------------------------------------------

export default function ProbeScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const material = useShaderMaterial(buildStrands, { blending: 'additive' });
  const ballMaterial = useShaderMaterial(buildBall);

  // Owns everything a Mode 2 user's own app would: the canvas, the renderer,
  // the scene, the camera, and the frame loop. The canvas is created here,
  // not in JSX, so a Strict Mode remount gets a fresh one. A canvas keeps
  // the GPU context of the first renderer made for it.
  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const canvas = document.createElement('canvas');

    canvas.style.cssText = 'display:block;width:100%;height:100%';
    container.append(canvas);

    const geometry = createStrandGeometry({ strands: STRANDS, samples: SAMPLES });
    const scene = new Scene();

    scene.add(new Mesh(geometry, material));

    // The ball, in the perspective view only. three draws solid meshes
    // before transparent ones, so the ball is on the canvas, with its
    // distance in the depth buffer, before the strands draw. Each strand
    // pixel then compares its own distance with the one stored there, and
    // draws only where it is nearer.
    const ballGeometry = SHOW_BALL ? new SphereGeometry(BALL_RADIUS, 48, 24) : null;

    if (ballGeometry) {
      const ball = new Mesh(ballGeometry, ballMaterial);

      ball.position.set(...BALL_CENTER);
      scene.add(ball);
    }

    // An orthographic camera has no perspective: a point's place on screen
    // ignores its distance. This one shows x from -1 to 1, and fitCamera
    // sets how much y it shows from the canvas's shape, so a unit is the
    // same length both ways. A perspective camera draws far things smaller,
    // as an eye does. This one stands 4 units in front of the origin and a
    // little above the floor, and looks down the row of strands.
    const camera = PERSPECTIVE
      ? new PerspectiveCamera(50, 1, 0.1, 100)
      : new OrthographicCamera(-1, 1, 1, -1, 0, 10);

    if (PERSPECTIVE) {
      camera.position.set(0, 1.2, 4);
      camera.lookAt(0, -0.2, -3);
    } else {
      camera.position.z = 5;
    }

    let renderer: GpuRenderer | null = null;
    let disposed = false;
    let frameRequest = 0;
    let frames = 0;
    const startedAt = performance.now();

    const fitCamera = () => {
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);

      if (camera instanceof PerspectiveCamera) {
        camera.aspect = aspect;
      } else {
        camera.top = 1 / aspect;
        camera.bottom = -1 / aspect;
      }
      camera.updateProjectionMatrix();
    };

    const draw = () => {
      if (!renderer) return;

      time.value = VISUAL_TEST ? 0 : (performance.now() - startedAt) / 1000;
      // Once the renderer is initialized, render() draws at once. three types
      // it as possibly a promise, for a renderer that is still starting up.
      void renderer.three.render(scene, camera);
      frames += 1;

      // Two frames, then hold still.
      if (VISUAL_TEST && frames >= 2) {
        window.__shadersBackend = renderer.backend;
        window.__shadersTestReady = true;

        return;
      }
      frameRequest = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => {
      renderer?.resize();
      fitCamera();
      // A held visual-test frame has no loop running to pick the resize up.
      if (VISUAL_TEST && frames >= 2) void renderer?.three.render(scene, camera);
    });

    // `depth` gives the canvas a depth buffer on WebGPU: a distance stored
    // per pixel, which is what lets the ball hide the strands behind it.
    // The engine leaves it off by default, because a ShaderScene has no use
    // for one.
    void createRenderer(canvas, { clearColor: 0x000000, clearAlpha: 1, depth: true }).then(
      (created) => {
        if (disposed) {
          created.dispose();

          return;
        }
        renderer = created;
        fitCamera();
        observer.observe(canvas);
        frameRequest = requestAnimationFrame(draw);
      },
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRequest);
      observer.disconnect();
      geometry.dispose();
      ballGeometry?.dispose();
      renderer?.dispose();
      canvas.remove();
    };
  }, [material, ballMaterial]);

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />;
}
