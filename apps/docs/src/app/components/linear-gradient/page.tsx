'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { Pane } from 'tweakpane';
import * as TweakpanePluginColorPlus from 'tweakpane-plugin-color-plus';

import { addCopyButtons } from '@/lib/paneUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, MAX_STOPS, MIN_STOPS } from './params';
import type { Params, Stop } from './params';

const LinearGradientScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const formatStops = (stops: Stop[]) =>
  stops
    .map((stop) => `{ color: '${stop.color}', position: ${formatNumber(stop.position)} }`)
    .join(',\n      ');

const formatJsx = (params: Params) =>
  `<ShaderScene>
  <LinearGradient
    stops={[
      ${formatStops(params.stops)},
    ]}
    angle={${formatNumber(params.angle)}}
    speed={${formatNumber(params.speed)}}
    focalPoint={[${formatNumber(params.focalX)}, ${formatNumber(params.focalY)}]}
    colorSpace="${params.colorSpace}"
    hueInterpolation="${params.hueInterpolation}"
  />
</ShaderScene>`;

const formatParams = (params: Params) =>
  `{
  stops: [
    ${params.stops
      .map((stop) => `{ color: '${stop.color}', position: ${formatNumber(stop.position)} }`)
      .join(',\n    ')},
  ],
  angle: ${formatNumber(params.angle)},
  speed: ${formatNumber(params.speed)},
  focalPoint: [${formatNumber(params.focalX)}, ${formatNumber(params.focalY)}],
  colorSpace: '${params.colorSpace}',
  hueInterpolation: '${params.hueInterpolation}',
}`;

export default function LinearGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<Params>(() => structuredClone(INITIAL));

  useEffect(() => {
    const container = paneContainerRef.current;

    if (!container) return;

    const local: Params = structuredClone(INITIAL);
    const pane = new Pane({ container, title: '<LinearGradient>' });

    // Pre-release wide-gamut color picker (docs-only). The built-in Tweakpane
    // picker is sRGB and rejects oklch()/oklab() strings; color-plus adapts its
    // UI to the bound color's gamut.
    pane.registerPlugin(TweakpanePluginColorPlus);
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
      () => formatJsx(local),
      () => formatParams(local),
    );

    pane.addBinding(local, 'angle', { min: 0, max: 360, step: 1 });
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 });
    pane.addBinding(local, 'focalX', { label: 'focal x', min: 0, max: 1, step: 0.01 });
    pane.addBinding(local, 'focalY', { label: 'focal y', min: 0, max: 1, step: 0.01 });
    pane.addBinding(local, 'colorSpace', {
      options: {
        OKLab: 'oklab',
        OKLch: 'oklch',
        Linear: 'linear',
        LCH: 'lch',
        HSL: 'hsl',
        HSV: 'hsv',
      },
    });
    pane.addBinding(local, 'hueInterpolation', {
      label: 'hue arc',
      options: {
        shorter: 'shorter',
        longer: 'longer',
        increasing: 'increasing',
        decreasing: 'decreasing',
      },
    });
    pane.addBlade({ view: 'separator' });

    const stopsFolder = pane.addFolder({ title: 'Color stops' });

    // Tweakpane folders are static; to render variable-length lists we
    // dispose every child of the stops folder and rebuild on each mutation.
    const rebuildStops = () => {
      for (const child of [...stopsFolder.children]) child.dispose();

      local.stops.forEach((stop, stopIndex) => {
        const row = stopsFolder.addFolder({ title: `Stop ${stopIndex}`, expanded: true });

        // Wide-gamut picker (color-plus). `formatLocked` keeps the written-back
        // value in the bound color's format (oklch here) no matter how the picker
        // is manipulated, so every stop stays in a format parseColor supports
        // (hex / oklch / oklab) rather than emitting rgb()/hsl()/display-p3().
        row.addBinding(stop, 'color', {
          label: 'color',
          view: 'color-plus',
          color: { formatLocked: true },
        });
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
        const nextColor = last?.color ?? 'oklch(0.6 0 0)';
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
        <LinearGradientScene params={params}>
          <VisualTestPause />
        </LinearGradientScene>
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
