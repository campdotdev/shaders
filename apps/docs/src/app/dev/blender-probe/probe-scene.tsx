'use client';

// The Blender probe: a material rebuilt in TSL from its node graph, beside
// Blender's own render of the same color. It reads what
// blender/export_material.py writes to public/blender-probe/, which git
// ignores. `?material=<name>` picks an export, and `?view=tsl` draws only the
// canvas, for scripts/compare-blender-probe.mjs to capture.
import Image from 'next/image';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  ShaderMonitor,
  ShaderScene,
  useAnimatableSpeed,
  useShaderContext,
  useStaticSceneHint,
} from '@camp-dev/shaders';
import { positionLocal, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { buildMaterialColor } from './graph/evaluate';
import { parseTap, tapSlug } from './graph/tap';
import type { MaterialGraph } from './graph/types';

// Where the export script's output is served from.
const MATERIAL_ROOT = '/blender-probe';
// The reference render's edge in pixels, export_material.py's --size. The
// canvas draws the same number of device pixels, so the two line up pixel
// for pixel.
const SIZE = 1024;
// ShaderScene's own cap on canvas pixels per CSS pixel.
const MAX_DPR = 2;
// How fast the slice drifts through the marble, in object units per second.
// The plane spans 2 units, and the marble's Voronoi cells are about 0.17
// across, so the default renews a cell about every 11 seconds. Higher churns
// faster; 0 holds the marble still.
const DEFAULT_SPEED = 0.015;

// ----------------------------------------------------------------------------
// The TSL side
// ----------------------------------------------------------------------------

function MaterialMesh({
  graph,
  tap,
  speed,
}: {
  graph: MaterialGraph;
  tap: string | null;
  speed: number;
}) {
  const shaderContext = useShaderContext();
  // The depth the slice has drifted to: speed x frame time, summed on the
  // CPU every frame and handed to the shader as one uniform.
  const depthUniform = useAnimatableSpeed(speed);

  // At speed 0 the marble holds still, so the scene draws once and parks.
  useStaticSceneHint(speed === 0);

  useEffect(() => {
    if (!shaderContext) return;

    const material = new MeshBasicNodeMaterial();
    // Blender's noise fills a 3D volume, and the plane is a slice through
    // it at depth z. Moving the slice along z makes the veins form and
    // dissolve in place, and every frame stays a true slice of the Blender
    // material. At depth 0 it is the slice Blender rendered.
    const objectCoordinate = positionLocal.add(vec3(0, 0, depthUniform));

    // The graph evaluates to scene-linear color, the same space Blender
    // renders in. The scene's output stage applies the sRGB transfer, as
    // Blender's Standard view transform does.
    material.colorNode = vec4(
      buildMaterialColor(graph, tap === null ? null : parseTap(tap), objectCoordinate),
      1,
    );

    // A 2x2 plane fills the scene's -1..1 camera, and its local position is
    // the Object coordinate the graph's Texture Coordinate node reads.
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);
    shaderContext.scheduler.requestRender();
    // scripts/compare-blender-probe.mjs reports which backend drew the capture.
    document.documentElement.dataset.probeBackend = shaderContext.renderer.backend;

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
        mesh.geometry.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
    };
  }, [shaderContext, graph, tap, depthUniform]);

  return null;
}

// ----------------------------------------------------------------------------
// Loading the export
// ----------------------------------------------------------------------------

type Load =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'missing'; name: string }
  | { status: 'ready'; name: string; graph: MaterialGraph; materials: string[] };

// A shallow check that a fetched file is an export, not a 404 page or an
// older format.
function isMaterialGraph(value: unknown): value is MaterialGraph {
  return (
    typeof value === 'object' &&
    value !== null &&
    'root' in value &&
    'groups' in value &&
    'tap' in value
  );
}

function useExport(requested: string | null): Load {
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  // The site is a static export, so the exports exist only as files the
  // browser fetches. There is no server or data layer to move this into. The
  // cancelled flag drops a stale run's result.
  // react-doctor-disable-next-line react-doctor/no-fetch-in-effect
  useEffect(() => {
    let cancelled = false;

    async function fetchExport(): Promise<Load> {
      const indexResponse = await fetch(`${MATERIAL_ROOT}/index.json`);
      const index: unknown = indexResponse.ok ? await indexResponse.json() : [];
      const materials = Array.isArray(index)
        ? index.filter((entry): entry is string => typeof entry === 'string')
        : [];
      const name = requested ?? materials[0] ?? '';
      const graphResponse = await fetch(`${MATERIAL_ROOT}/${name}.graph.json`);
      const graph: unknown = graphResponse.ok ? await graphResponse.json() : null;

      return isMaterialGraph(graph)
        ? { status: 'ready', name, graph, materials }
        : { status: 'missing', name };
    }

    fetchExport()
      .then((result) => {
        if (!cancelled) setLoad(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'failed', message: String(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [requested]);

  return load;
}

// ----------------------------------------------------------------------------
// The page
// ----------------------------------------------------------------------------

type View = 'tsl' | 'difference';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: 24,
  background: '#111',
  color: '#ddd',
  font: '14px/1.5 system-ui, sans-serif',
};

function MaterialScene({
  graph,
  tap,
  speed,
  monitor,
  onFirstPaint,
}: {
  graph: MaterialGraph;
  tap: string | null;
  speed: number;
  monitor: boolean;
  onFirstPaint: () => void;
}) {
  return (
    <ShaderScene gamut="srgb" maxDPR={MAX_DPR} onFirstPaint={onFirstPaint}>
      <MaterialMesh graph={graph} speed={speed} tap={tap} />
      {monitor && <ShaderMonitor />}
    </ShaderScene>
  );
}

// Turns the drift on and off and sets its speed.
function MotionControls({
  animate,
  speed,
  onAnimateChange,
  onSpeedChange,
}: {
  animate: boolean;
  speed: number;
  onAnimateChange: (animate: boolean) => void;
  onSpeedChange: (speed: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
      <label>
        <input
          checked={animate}
          onChange={(event) => onAnimateChange(event.target.checked)}
          type="checkbox"
        />{' '}
        Animate
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        Speed
        <input
          max={0.3}
          min={0.005}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
          step={0.005}
          type="range"
          value={speed}
        />
        {speed.toFixed(3)} units/s
      </label>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ marginBottom: 8, color: '#999' }}>{title}</figcaption>
      {children}
    </figure>
  );
}

// The live canvas, which can also show its difference from Blender's render.
function TslPanel({
  canvas,
  reference,
  size,
  ready,
  children,
}: {
  canvas: ReactNode;
  reference: string;
  size: number;
  ready: boolean;
  children: ReactNode;
}) {
  const [view, setView] = useState<View>('tsl');
  const [gain, setGain] = useState(8);

  return (
    <Panel title={view === 'tsl' ? 'TSL (live)' : `Difference x${gain} (black is a match)`}>
      {/* Difference mode lays Blender's render over the canvas with a
          difference blend, so matching pixels cancel to black, then
          brightens the result so small errors show. */}
      <div
        data-probe-ready={ready || undefined}
        style={{
          position: 'relative',
          width: size,
          height: size,
          isolation: 'isolate',
          filter: view === 'difference' ? `brightness(${gain})` : undefined,
        }}
      >
        {canvas}
        {view === 'difference' && (
          <Image
            alt=""
            height={size}
            src={reference}
            style={{ position: 'absolute', inset: 0, mixBlendMode: 'difference' }}
            width={size}
          />
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <label>
          <input
            checked={view === 'tsl'}
            name="probe-view"
            onChange={() => setView('tsl')}
            type="radio"
          />{' '}
          TSL
        </label>
        <label>
          <input
            checked={view === 'difference'}
            name="probe-view"
            onChange={() => setView('difference')}
            type="radio"
          />{' '}
          Difference
        </label>
        <label>
          Gain{' '}
          <select onChange={(event) => setGain(Number(event.target.value))} value={gain}>
            {[1, 8, 32, 128].map((option) => (
              <option key={option} value={option}>
                x{option}
              </option>
            ))}
          </select>
        </label>
      </div>
      {children}
    </Panel>
  );
}

// The page reads the URL and the pixel ratio once. Neither has a change
// event the probe needs, so the subscription does nothing, and the server
// snapshots are what a server render would see.
const subscribeNever = () => () => undefined;

export default function ProbeScene() {
  const search = useSyncExternalStore(
    subscribeNever,
    () => window.location.search,
    () => '',
  );
  const pixelRatio = useSyncExternalStore(
    subscribeNever,
    () => window.devicePixelRatio,
    () => 1,
  );
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const load = useExport(params.get('material'));
  const [ready, setReady] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  // CSS pixels that hold SIZE device pixels on this display.
  const size = SIZE / Math.min(pixelRatio, MAX_DPR);

  if (load.status === 'loading') return <main style={pageStyle}>Loading the export...</main>;
  if (load.status === 'failed') {
    return <main style={pageStyle}>Loading the export failed: {load.message}</main>;
  }
  if (load.status === 'missing') {
    return (
      <main style={pageStyle}>
        No export named {`"${load.name}"`} in public{MATERIAL_ROOT}. Run blender/export_material.py,
        as this route&apos;s README describes.
      </main>
    );
  }

  const { name, graph, materials } = load;
  const tap = params.get('tap');
  const stem = tap === null ? name : `${name}@${tapSlug(tap)}`;
  const reference = `${MATERIAL_ROOT}/${stem}.reference.png`;
  // The capture view stays still and unmonitored, at the depth Blender rendered.
  const captureView = params.get('view') === 'tsl';
  const canvas = (
    <MaterialScene
      graph={graph}
      monitor={!captureView}
      onFirstPaint={() => setReady(true)}
      speed={animate && !captureView ? speed : 0}
      tap={tap}
    />
  );

  if (captureView) {
    return (
      <div
        data-probe-canvas
        data-probe-ready={ready || undefined}
        style={{ position: 'relative', width: size, height: size }}
      >
        {canvas}
      </div>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ margin: '0 0 4px', fontSize: 20 }}>{graph.material}</h1>
      <p style={{ margin: '0 0 16px', color: '#999' }}>
        Exported from Blender {graph.blender}. Both sides show the color the graph feeds the
        Principled BSDF&apos;s Base Color, on a plane through the object&apos;s origin, with no
        lighting.{tap !== null && ` Tapped at ${tap}.`}{' '}
        {materials.map((other) => (
          <a href={`?material=${other}`} key={other} style={{ color: '#9cf', marginRight: 8 }}>
            {other}
          </a>
        ))}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <Panel title="Blender (Cycles, emission, Standard view)">
          <Image
            alt={`Blender's render of ${graph.material}`}
            height={size}
            src={reference}
            style={{ display: 'block' }}
            width={size}
          />
        </Panel>
        <TslPanel canvas={canvas} ready={ready} reference={reference} size={size}>
          <MotionControls
            animate={animate}
            onAnimateChange={setAnimate}
            onSpeedChange={setSpeed}
            speed={speed}
          />
        </TslPanel>
        <Panel title="Lit in Blender, for context (not ported)">
          <Image
            alt={`${graph.material} lit in Blender`}
            height={size / 2}
            src={`${MATERIAL_ROOT}/${name}.lit.jpg`}
            style={{ display: 'block' }}
            width={size / 2}
          />
        </Panel>
      </div>
    </main>
  );
}
