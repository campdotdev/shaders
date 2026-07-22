'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { Pane } from 'tweakpane';
import * as TweakpanePluginColorPlus from 'tweakpane-plugin-color-plus';

import { DemoPoster } from '@/components/DemoPoster';
import { addCopyButtons } from '@/lib/paneUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

import {
  INITIAL,
  type Layer,
  MAX_LAYERS,
  MAX_STOPS,
  MIN_LAYERS,
  MIN_STOPS,
  type Params,
} from './params';

const WavesScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const formatColor = (colors: string[]) =>
  colors.length === 1 ? `'${colors[0]}'` : `[${colors.map((color) => `'${color}'`).join(', ')}]`;

const formatLayer = (layer: Layer) =>
  `{ color: ${formatColor(layer.colors)}, amplitude: ${formatNumber(layer.amplitude)}, glow: ${formatNumber(layer.glow)}, brightness: ${formatNumber(layer.brightness)}, opacity: ${formatNumber(layer.opacity)}, thickness: ${formatNumber(layer.thickness)} }`;

const formatLayers = (layers: Layer[]) => layers.map(formatLayer).join(',\n    ');

const formatJsx = (params: Params) =>
  `<ShaderScene>
  <Waves
    layers={[
    ${formatLayers(params.layers)}
    ]}
    amplitude={${formatNumber(params.amplitude)}}
    frequency={${formatNumber(params.frequency)}}
    speed={${formatNumber(params.speed)}}
    glow={${formatNumber(params.glow)}}
    brightness={${formatNumber(params.brightness)}}
    opacity={${formatNumber(params.opacity)}}
    thickness={${formatNumber(params.thickness)}}
    baseline={${formatNumber(params.baseline)}}
    braiding={${formatNumber(params.braiding)}}
    breathing={${formatNumber(params.breathing)}}
    flare={${formatNumber(params.flare)}}
    flareRadius={${formatNumber(params.flareRadius)}}
    colorDrift={${formatNumber(params.colorDrift)}}
    colorSpace="${params.colorSpace}"
  />
</ShaderScene>`;

const formatParams = (params: Params) =>
  `{
  layers: [
    ${formatLayers(params.layers)}
  ],
  amplitude: ${formatNumber(params.amplitude)},
  frequency: ${formatNumber(params.frequency)},
  speed: ${formatNumber(params.speed)},
  glow: ${formatNumber(params.glow)},
  brightness: ${formatNumber(params.brightness)},
  opacity: ${formatNumber(params.opacity)},
  thickness: ${formatNumber(params.thickness)},
  baseline: ${formatNumber(params.baseline)},
  braiding: ${formatNumber(params.braiding)},
  breathing: ${formatNumber(params.breathing)},
  flare: ${formatNumber(params.flare)},
  flareRadius: ${formatNumber(params.flareRadius)},
  colorDrift: ${formatNumber(params.colorDrift)},
  colorSpace: '${params.colorSpace}',
}`;

export default function WavesPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<Params>(() => structuredClone(INITIAL));

  useEffect(() => {
    const container = paneContainerRef.current;

    if (!container) return;

    const local: Params = structuredClone(INITIAL);
    const pane = new Pane({ container, title: '<Waves>' });

    // Pre-release wide-gamut color picker (docs-only). The built-in Tweakpane
    // picker is sRGB and rejects oklch()/oklab() strings; color-plus adapts its
    // UI to the bound color's gamut.
    pane.registerPlugin(TweakpanePluginColorPlus);

    const sync = () => setParams(structuredClone(local));

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(local, structuredClone(INITIAL));
      rebuildLayers();
      pane.refresh();
      sync();
    });

    addCopyButtons(
      pane,
      () => formatJsx(local),
      () => formatParams(local),
    );

    pane.addBinding(local, 'amplitude', { min: 0, max: 0.5, step: 0.005 });
    pane.addBinding(local, 'frequency', { min: 0.1, max: 10, step: 0.05 });
    pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 });
    pane.addBinding(local, 'glow', { min: 0, max: 1, step: 0.01 });
    pane.addBinding(local, 'brightness', { min: 0, max: 2, step: 0.01 });
    pane.addBinding(local, 'opacity', { min: 0, max: 1, step: 0.001 });
    pane.addBinding(local, 'thickness', { min: 0.01, max: 8, step: 0.01 });
    pane.addBinding(local, 'baseline', { min: -1, max: 1, step: 0.01 });
    pane.addBinding(local, 'braiding', { min: 0, max: 2, step: 0.01 });
    pane.addBinding(local, 'breathing', { min: 0, max: 1, step: 0.01 });
    pane.addBinding(local, 'flare', { min: 0, max: 6, step: 0.05 });
    pane.addBinding(local, 'flareRadius', { min: 0.05, max: 1.5, step: 0.01 });
    pane.addBinding(local, 'colorDrift', { min: 0, max: 1, step: 0.01 });
    pane.addBinding(local, 'colorSpace', {
      options: {
        linear: 'linear',
        oklab: 'oklab',
        oklch: 'oklch',
        lch: 'lch',
        hsl: 'hsl',
        hsv: 'hsv',
      },
    });
    pane.addBlade({ view: 'separator' });

    const layersFolder = pane.addFolder({ title: 'Layers' });

    // Tweakpane folders are static; to render variable-length lists we
    // dispose every child of the layers folder and rebuild on each mutation.
    // Disposing a layer's folder cascades to its nested stops folder too.
    const rebuildLayers = () => {
      for (const child of [...layersFolder.children]) child.dispose();

      local.layers.forEach((layer, layerIndex) => {
        const row = layersFolder.addFolder({
          title: `Layer ${layerIndex}`,
          expanded: layerIndex === 0,
        });

        row.addBinding(layer, 'amplitude', { min: 0, max: 0.5, step: 0.005 });
        row.addBinding(layer, 'glow', { min: 0, max: 1, step: 0.01 });
        row.addBinding(layer, 'brightness', { min: 0, max: 2, step: 0.01 });
        row.addBinding(layer, 'opacity', { min: 0, max: 1, step: 0.001 });
        row.addBinding(layer, 'thickness', { min: 0.01, max: 8, step: 0.01 });

        const stopsFolder = row.addFolder({ title: 'Colors' });

        // Same dispose-and-rebuild approach, one level deeper: each layer's
        // color stops are their own dynamic list.
        const rebuildStops = () => {
          for (const child of [...stopsFolder.children]) child.dispose();

          layer.colors.forEach((color, stopIndex) => {
            const stopRow = stopsFolder.addFolder({
              title: `Stop ${stopIndex}`,
              expanded: true,
            });

            // color-plus binds to a holder object rather than the colors
            // array directly (array indices aren't bindable keys); the
            // change listener writes the picked value back into the array.
            const stopHolder = { color };

            stopRow
              .addBinding(stopHolder, 'color', {
                label: 'color',
                view: 'color-plus',
                color: { formatLocked: true },
              })
              .on('change', (event) => {
                // Write-back only — the pane-wide 'change' listener syncs.
                layer.colors[stopIndex] = event.value;
              });

            const removeStopButton = stopRow.addButton({ title: 'Remove stop' });

            if (layer.colors.length <= MIN_STOPS) removeStopButton.disabled = true;
            removeStopButton.on('click', () => {
              layer.colors.splice(stopIndex, 1);
              rebuildStops();
              sync();
            });
          });

          const addStopButton = stopsFolder.addButton({ title: '+ Add stop' });

          if (layer.colors.length >= MAX_STOPS) addStopButton.disabled = true;
          addStopButton.on('click', () => {
            const last = layer.colors[layer.colors.length - 1];
            // Duplicate the last stop's color so the new stop is visible.
            const nextColor = last ?? 'oklch(0.6 0.15 250)';

            layer.colors.push(nextColor);
            rebuildStops();
            sync();
          });
        };

        rebuildStops();

        const removeLayerButton = row.addButton({ title: 'Remove layer' });

        if (local.layers.length <= MIN_LAYERS) removeLayerButton.disabled = true;
        removeLayerButton.on('click', () => {
          local.layers.splice(layerIndex, 1);
          rebuildLayers();
          sync();
        });
      });

      const addLayerButton = layersFolder.addButton({ title: '+ Add layer' });

      if (local.layers.length >= MAX_LAYERS) addLayerButton.disabled = true;
      addLayerButton.on('click', () => {
        const last = local.layers[local.layers.length - 1];
        const next: Layer = {
          colors: last ? [...last.colors] : ['oklch(0.6 0.15 250)'],
          amplitude: last?.amplitude ?? INITIAL.amplitude,
          glow: last?.glow ?? INITIAL.glow,
          brightness: last?.brightness ?? INITIAL.brightness,
          opacity: last?.opacity ?? INITIAL.opacity,
          thickness: last?.thickness ?? INITIAL.thickness,
        };

        local.layers.push(next);
        rebuildLayers();
        sync();
      });
    };

    rebuildLayers();

    pane.on('change', sync);

    return () => {
      pane.dispose();
    };
  }, []);

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', background: '#0a0a14' }}>
        <DemoPoster
          alt="Waves shader preview: an eight-line blue-to-violet wave bundle braiding and breathing over a dark field"
          src="/posters/waves.jpg"
        >
          <WavesScene params={params}>
            <VisualTestPause />
          </WavesScene>
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
        <h1 style={{ marginTop: 0 }}>&lt;Waves /&gt;</h1>
        <p>
          A coherent bundle of additive wave lines in an analogous blue-to-violet run. The lines
          share one wave and braid, breathe, and fray wide toward the canvas edges; each line takes
          a flat color or a gradient.
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
          {formatJsx(params)}
        </pre>
      </section>
    </main>
  );
}
