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
  useAnimatableUniform,
  useShaderContext,
  useStaticSceneHint,
} from '@camp-dev/shaders';
import { positionLocal, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { swirl } from './flow';
import { buildMaterialColor, type OctavePlan } from './graph/evaluate';
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

// ----------------------------------------------------------------------------
// Motion
// ----------------------------------------------------------------------------
// Every motion setting rides a uniform, so the sliders move without
// rebuilding the shader.

interface Motion {
  // How fast the slice drifts through the marble, in object units per
  // second. The plane spans 2 units and the Voronoi cells are about 0.17
  // across, so 0.015 renews a cell about every 11 seconds. 0 holds still.
  speed: number;
  // How far each point is carried back along the flow, in object units. 0
  // is Blender's marble untouched. 0.06 bends the veins along the flow and
  // keeps them marble; by 0.4 they smear into brushed streaks.
  swirl: number;
  // Eddies per object unit. At 1.2, the 2-unit plane holds two or three
  // eddies across. Higher makes smaller, tighter eddies.
  eddies: number;
  // How fast the eddies reshape, as flow time per unit of slice depth, so
  // the swirl and the drift keep their tempo together as speed changes. At
  // 6 and the default speed, an eddy reshapes over about 10 seconds.
  pace: number;
}

const DEFAULT_MOTION: Motion = { speed: 0.015, swirl: 0.06, eddies: 1.2, pace: 6 };

// Real-time mode drops every fBM octave finer than this many canvas pixels
// per cycle. 2 pixels is the finest pattern a grid of pixels can show, so
// below it an octave only adds grain that sparkles as the marble moves. On
// the green marble at 1024px, it cuts a frame from about 18 ms to 11 ms on
// an M1 Max. 4 pixels saves only another millisecond and softens the grain.
const MIN_WAVELENGTH_PIXELS = 2;
// The finest pattern worth drawing in real time, in cycles per object unit.
// The plane spans 2 object units across SIZE canvas pixels.
const REALTIME_MAX_FREQUENCY = SIZE / 2 / MIN_WAVELENGTH_PIXELS;

// ----------------------------------------------------------------------------
// The TSL side
// ----------------------------------------------------------------------------

interface MaterialMeshProps {
  graph: MaterialGraph;
  tap: string | null;
  motion: Motion;
  // True while the page compares with Blender's render, which shows the
  // marble unmoved and unswirled.
  comparing: boolean;
  // True drops the fBM octaves finer than the canvas can show.
  realtime: boolean;
  onOctaves: (octaves: OctavePlan[]) => void;
}

function MaterialMesh({ graph, tap, motion, comparing, realtime, onOctaves }: MaterialMeshProps) {
  const shaderContext = useShaderContext();
  const speed = comparing ? 0 : motion.speed;
  // The depth the slice has drifted to: speed x frame time, summed on the
  // CPU every frame and handed to the shader as one uniform.
  const depthUniform = useAnimatableSpeed(speed);
  const swirlUniform = useAnimatableUniform(comparing ? 0 : motion.swirl);
  const eddiesUniform = useAnimatableUniform(motion.eddies);
  const paceUniform = useAnimatableUniform(motion.pace);

  // At speed 0 the marble holds still, so the scene draws once and parks.
  useStaticSceneHint(speed === 0);

  // A comparison puts the slice back at depth 0, where Blender rendered it.
  // A raw uniform write repaints nothing on a parked scene, so it asks for a
  // frame (the bare-uniform-write gotcha in docs/agents/tsl.md).
  useEffect(() => {
    if (!comparing || !shaderContext) return;

    depthUniform.value = 0;
    shaderContext.scheduler.requestRender();
  }, [comparing, depthUniform, shaderContext]);

  useEffect(() => {
    if (!shaderContext) return;

    const material = new MeshBasicNodeMaterial();
    // Blender's noise fills a 3D volume, and the plane is a slice through
    // it at depth z. Moving the slice along z makes the veins form and
    // dissolve in place. The swirl first carries each point back along a
    // slow flow, so the veins also stream around eddies. With depth 0 and
    // swirl 0, the slice is the one Blender rendered.
    const swirled = swirl(positionLocal.xy, {
      amount: swirlUniform,
      eddiesPerUnit: eddiesUniform,
      time: depthUniform.mul(paceUniform),
    });
    const objectCoordinate = vec3(swirled, depthUniform);

    // The graph evaluates to scene-linear color, the same space Blender
    // renders in. The scene's output stage applies the sRGB transfer, as
    // Blender's Standard view transform does.
    material.colorNode = vec4(
      buildMaterialColor(graph, {
        tap: tap === null ? null : parseTap(tap),
        objectCoordinate,
        maxFrequency: realtime ? REALTIME_MAX_FREQUENCY : Infinity,
        onOctaves,
      }),
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
  }, [
    shaderContext,
    graph,
    tap,
    realtime,
    onOctaves,
    depthUniform,
    swirlUniform,
    eddiesUniform,
    paceUniform,
  ]);

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
  monitor,
  onFirstPaint,
  ...meshProps
}: MaterialMeshProps & { monitor: boolean; onFirstPaint: () => void }) {
  return (
    <ShaderScene gamut="srgb" maxDPR={MAX_DPR} onFirstPaint={onFirstPaint}>
      <MaterialMesh {...meshProps} />
      {monitor && <ShaderMonitor />}
    </ShaderScene>
  );
}

// Turns real-time mode on and off and lists what it dropped.
function RealtimeControls({
  realtime,
  octaves,
  onRealtimeChange,
}: {
  realtime: boolean;
  octaves: OctavePlan[];
  onRealtimeChange: (realtime: boolean) => void;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <label>
        <input
          checked={realtime}
          onChange={(event) => onRealtimeChange(event.target.checked)}
          type="checkbox"
        />{' '}
        Realtime (drop octaves finer than {MIN_WAVELENGTH_PIXELS} pixels)
      </label>
      {realtime && octaves.length > 0 && (
        <ul style={{ margin: '4px 0 0', paddingLeft: 20, color: '#999' }}>
          {octaves.map(({ node, kept, total }) => (
            <li key={node}>
              {node}: {kept} of {total} octaves
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The tuning sliders, one per Motion setting.
const SLIDERS: Array<{
  key: keyof Motion;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}> = [
  { key: 'speed', label: 'Speed', min: 0.005, max: 0.3, step: 0.005, unit: 'units/s' },
  { key: 'swirl', label: 'Swirl', min: 0, max: 1, step: 0.01, unit: 'units' },
  { key: 'eddies', label: 'Eddies', min: 0.25, max: 4, step: 0.05, unit: 'per unit' },
  { key: 'pace', label: 'Flow pace', min: 0, max: 20, step: 0.5, unit: 'x drift' },
];

// Turns the motion on and off and tunes it.
function MotionControls({
  animate,
  motion,
  onAnimateChange,
  onMotionChange,
}: {
  animate: boolean;
  motion: Motion;
  onAnimateChange: (animate: boolean) => void;
  onMotionChange: (motion: Motion) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
      <label>
        <input
          checked={animate}
          onChange={(event) => onAnimateChange(event.target.checked)}
          type="checkbox"
        />{' '}
        Animate
      </label>
      {SLIDERS.map(({ key, label, min, max, step, unit }) => (
        <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 72 }}>{label}</span>
          <input
            max={max}
            min={min}
            onChange={(event) => onMotionChange({ ...motion, [key]: Number(event.target.value) })}
            step={step}
            type="range"
            value={motion[key]}
          />
          {motion[key]} {unit}
        </label>
      ))}
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
  view,
  onViewChange,
  children,
}: {
  canvas: ReactNode;
  reference: string;
  size: number;
  ready: boolean;
  view: View;
  onViewChange: (view: View) => void;
  children: ReactNode;
}) {
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
            onChange={() => onViewChange('tsl')}
            type="radio"
          />{' '}
          TSL
        </label>
        <label>
          <input
            checked={view === 'difference'}
            name="probe-view"
            onChange={() => onViewChange('difference')}
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

// One loaded export: the comparison, the live canvas, and its controls.
function LoadedProbe({
  load,
  params,
  size,
}: {
  load: Extract<Load, { status: 'ready' }>;
  params: URLSearchParams;
  size: number;
}) {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('tsl');
  const [animate, setAnimate] = useState(false);
  const [motion, setMotion] = useState(DEFAULT_MOTION);
  const [realtime, setRealtime] = useState(true);
  const [octaves, setOctaves] = useState<OctavePlan[]>([]);
  const { name, graph, materials } = load;
  const tap = params.get('tap');
  const stem = tap === null ? name : `${name}@${tapSlug(tap)}`;
  const reference = `${MATERIAL_ROOT}/${stem}.reference.png`;
  // The capture view and the difference view compare with Blender, so they
  // show the marble still, unswirled, at full detail, at the depth Blender
  // rendered. Switching real-time mode recompiles the shader.
  const captureView = params.get('view') === 'tsl';
  const comparing = captureView || view === 'difference';
  const canvas = (
    <MaterialScene
      comparing={comparing}
      graph={graph}
      monitor={!captureView}
      motion={animate ? motion : { ...motion, speed: 0 }}
      onFirstPaint={() => setReady(true)}
      onOctaves={setOctaves}
      realtime={realtime && !comparing}
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
        <TslPanel
          canvas={canvas}
          onViewChange={setView}
          ready={ready}
          reference={reference}
          size={size}
          view={view}
        >
          <MotionControls
            animate={animate}
            motion={motion}
            onAnimateChange={setAnimate}
            onMotionChange={setMotion}
          />
          <RealtimeControls octaves={octaves} onRealtimeChange={setRealtime} realtime={realtime} />
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

  // CSS pixels that hold SIZE device pixels on this display.
  return <LoadedProbe load={load} params={params} size={SIZE / Math.min(pixelRatio, MAX_DPR)} />;
}
