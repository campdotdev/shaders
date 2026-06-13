'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { Pane } from 'tweakpane';

import { palette } from '@/lib/palette';
import { addCopyButtons } from '@/lib/paneUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
);

interface Stop {
  color: string;
  position: number;
}

interface Params {
  angle: number;
  speed: number;
  focalX: number;
  focalY: number;
  stops: Stop[];
}

const MIN_STOPS = 1;
const MAX_STOPS = 6;

const INITIAL: Params = {
  angle: 90,
  speed: 0,
  focalX: 0.5,
  focalY: 0.5,
  stops: [
    { color: palette.violet.base, position: 0 },
    { color: palette.purple.base, position: 0.5 },
    { color: palette.magenta.dark, position: 1 },
  ],
};

const fmtNum = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const fmtColors = (stops: Stop[]) => stops.map((stop) => `'${stop.color}'`).join(', ');

const fmtStops = (stops: Stop[]) => stops.map((stop) => fmtNum(stop.position)).join(', ');

const fmtJsx = (params: Params) =>
  `<ShaderScene>
  <LinearGradient
    colors={[${fmtColors(params.stops)}]}
    stops={[${fmtStops(params.stops)}]}
    angle={${fmtNum(params.angle)}}
    speed={${fmtNum(params.speed)}}
    focalPoint={[${fmtNum(params.focalX)}, ${fmtNum(params.focalY)}]}
  />
</ShaderScene>`;

const fmtParams = (params: Params) =>
  `{
  colors: [${fmtColors(params.stops)}],
  stops: [${fmtStops(params.stops)}],
  angle: ${fmtNum(params.angle)},
  speed: ${fmtNum(params.speed)},
  focalPoint: [${fmtNum(params.focalX)}, ${fmtNum(params.focalY)}],
}`;

export default function LinearGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<Params>(() => structuredClone(INITIAL));

  useEffect(() => {
    const container = paneContainerRef.current;

    if (!container) return;

    const local: Params = structuredClone(INITIAL);
    const pane = new Pane({ container, title: '<LinearGradient>' });
    const sync = () => setParams(structuredClone(local));

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(local, structuredClone(INITIAL));
      // local.stops bindings reference the previous stop objects; rebuild the
      // dynamic folder so new bindings point at the fresh ones.
      rebuildStops();
      pane.refresh();
      sync();
    });

    addCopyButtons(
      pane,
      () => fmtJsx(local),
      () => fmtParams(local),
    );

    pane.addBinding(local, 'angle', { min: 0, max: 360, step: 1 });
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 });
    pane.addBinding(local, 'focalX', { label: 'focal x', min: 0, max: 1, step: 0.01 });
    pane.addBinding(local, 'focalY', { label: 'focal y', min: 0, max: 1, step: 0.01 });
    pane.addBlade({ view: 'separator' });

    const stopsFolder = pane.addFolder({ title: 'Color stops' });

    // Tweakpane folders are static; to render variable-length lists we
    // dispose every child of the stops folder and rebuild on each mutation.
    const rebuildStops = () => {
      for (const child of [...stopsFolder.children]) child.dispose();

      local.stops.forEach((stop, stopIndex) => {
        const row = stopsFolder.addFolder({ title: `Stop ${stopIndex}`, expanded: true });

        row.addBinding(stop, 'color', { label: 'color' });
        row.addBinding(stop, 'position', { label: 'position', min: 0, max: 1, step: 0.01 });

        const removeButton = row.addButton({ title: 'Remove stop' });

        if (local.stops.length <= MIN_STOPS) removeButton.disabled = true;
        removeButton.on('click', () => {
          local.stops.splice(stopIndex, 1);
          rebuildStops();
          sync();
        });
      });

      const addButton = stopsFolder.addButton({ title: '+ Add stop' });

      if (local.stops.length >= MAX_STOPS) addButton.disabled = true;
      addButton.on('click', () => {
        const last = local.stops[local.stops.length - 1];
        // New stop slots in halfway between the current last position and 1.0.
        // Color duplicates the last stop's color so the new stop is visible
        // and immediately editable rather than appearing as a random hex.
        const nextColor = last?.color ?? '#888888';
        const nextPosition = last !== undefined ? (last.position + 1) / 2 : 1;

        local.stops.push({ color: nextColor, position: nextPosition });
        rebuildStops();
        sync();
      });
    };

    rebuildStops();

    pane.on('change', sync);

    return () => {
      pane.dispose();
    };
  }, []);

  const colors = params.stops.map((stop) => stop.color);
  const stops = params.stops.map((stop) => stop.position);
  // angle and speed are live uniforms now — only color count / hex values /
  // stop positions still require a material rebuild because they're baked
  // into the TSL graph as JS literals (vec3 colors, position scalars).
  const remountKey = `${colors.join('|')}|${stops.join('|')}`;

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', height: '70vh' }}>
        <Image
          alt="Linear gradient shader preview: vertical gradient from violet to purple to magenta"
          fill
          priority
          sizes="100vw"
          src="/posters/linear-gradient.png"
          style={{ objectFit: 'cover' }}
        />
        <ShaderScene>
          <LinearGradient
            angle={params.angle}
            colors={colors}
            focalPoint={[params.focalX, params.focalY]}
            key={remountKey}
            speed={params.speed}
            stops={stops}
          />
          <VisualTestPause />
        </ShaderScene>
        <div
          aria-hidden="true"
          data-tweakpane-host
          ref={paneContainerRef}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            width: '320px',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;LinearGradient /&gt;</h1>
        <p>
          Animated linear gradient with optional cursor parallax. The simplest, foundational Matter
          component.
        </p>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {`<ShaderScene>
  <LinearGradient />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
