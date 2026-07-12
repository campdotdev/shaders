'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { Pane } from 'tweakpane';
import * as TweakpanePluginColorPlus from 'tweakpane-plugin-color-plus';

import { DemoPoster } from '@/components/DemoPoster';
import { addCopyButtons } from '@/lib/paneUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { type AuroraParams, INITIAL, MAX_STOPS, MIN_STOPS, type PlainColorStop } from './params';

const AuroraScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const formatStops = (stops: PlainColorStop[]) =>
  stops
    .map((stop) => `{ color: '${stop.color}', position: ${formatNumber(stop.position)} }`)
    .join(',\n      ');

const formatJsx = (params: AuroraParams) =>
  `<ShaderScene>
  <Aurora
    intensity={${formatNumber(params.intensity)}}
    speed={${formatNumber(params.speed)}}
    turbulence={${formatNumber(params.turbulence)}}
    density={${formatNumber(params.density)}}
    falloff={${formatNumber(params.falloff)}}
    colorSpace="${params.colorSpace}"
    hueInterpolation="${params.hueInterpolation}"
    stops={[
      ${formatStops(params.stops)},
    ]}
  />
</ShaderScene>`;

const formatParams = (params: AuroraParams) =>
  `{
  intensity: ${formatNumber(params.intensity)},
  speed: ${formatNumber(params.speed)},
  turbulence: ${formatNumber(params.turbulence)},
  density: ${formatNumber(params.density)},
  falloff: ${formatNumber(params.falloff)},
  colorSpace: '${params.colorSpace}',
  hueInterpolation: '${params.hueInterpolation}',
  stops: [
    ${formatStops(params.stops)},
  ],
}`;

export default function AuroraPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<AuroraParams>(() => structuredClone(INITIAL));

  useEffect(() => {
    const container = paneContainerRef.current;

    if (!container) return;

    const local: AuroraParams = structuredClone(INITIAL);
    const pane = new Pane({ container, title: '<Aurora>' });

    // Pre-release wide-gamut color picker (docs-only). The built-in Tweakpane
    // picker is sRGB and rejects oklch()/oklab() strings; color-plus adapts its
    // UI to the bound color's gamut.
    pane.registerPlugin(TweakpanePluginColorPlus);

    const sync = () => setParams(structuredClone(local));

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(local, structuredClone(INITIAL));
      rebuildStops();
      pane.refresh();
      sync();
    });

    addCopyButtons(
      pane,
      () => formatJsx(local),
      () => formatParams(local),
    );

    const globals = pane.addFolder({ title: 'Global' });

    globals.addBinding(local, 'intensity', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'speed', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'turbulence', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'density', { min: 0.25, max: 4, step: 0.01 });
    globals.addBinding(local, 'falloff', { min: 0, max: 2, step: 0.01 });
    globals.addBinding(local, 'colorSpace', {
      options: {
        OKLab: 'oklab',
        OKLch: 'oklch',
        Linear: 'linear',
        LCH: 'lch',
        HSL: 'hsl',
        HSV: 'hsv',
      },
    });
    globals.addBinding(local, 'hueInterpolation', {
      label: 'hue arc',
      options: {
        shorter: 'shorter',
        longer: 'longer',
        increasing: 'increasing',
        decreasing: 'decreasing',
      },
    });
    pane.addBlade({ view: 'separator' });

    const stopsFolder = pane.addFolder({ title: 'Stops (low → high altitude)' });

    // Tweakpane folders are static; to render variable-length lists we dispose
    // every child of the stops folder and rebuild on each mutation.
    const rebuildStops = () => {
      for (const child of [...stopsFolder.children]) child.dispose();

      local.stops.forEach((stop, stopIndex) => {
        const row = stopsFolder.addFolder({
          title: `Stop ${stopIndex}`,
          expanded: stopIndex === 0,
        });

        // Wide-gamut picker (color-plus). `formatLocked` keeps the written-back
        // value in the bound color's format (oklch here) no matter how the
        // picker is used.
        row.addBinding(stop, 'color', {
          label: 'color',
          view: 'color-plus',
          color: { formatLocked: true },
        });
        row.addBinding(stop, 'position', { min: 0, max: 1, step: 0.01 });

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
        // Duplicate the last stop's color so the new stop is visible.
        const nextColor = last?.color ?? 'oklch(0.6 0 0)';

        local.stops.push({ color: nextColor, position: 1 });
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
      <div
        data-shader-demo
        style={{
          position: 'relative',
          // sRGB approximation of the reference sky the aurora was tuned
          // against — the component itself is transparent.
          background: 'linear-gradient(to top, #193157, #1b2138)',
        }}
      >
        <DemoPoster
          alt="Aurora shader preview: green and teal light curtains with a blue veil and pink fringe over a dark backdrop"
          src="/posters/aurora.jpg"
        >
          <AuroraScene params={params}>
            <VisualTestPause />
          </AuroraScene>
        </DemoPoster>
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
            maxHeight: 'calc(100% - 2rem)',
            overflowY: 'auto',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;Aurora /&gt;</h1>
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
  <Aurora intensity={1} stops={[...]} />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
