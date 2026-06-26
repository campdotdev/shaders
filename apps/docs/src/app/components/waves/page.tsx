'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import type { WaveLayer } from '@matter/registry/waves';
import { Pane } from 'tweakpane';

import { palette } from '@/lib/palette';
import { addCopyButtons } from '@/lib/paneUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});
const Waves = dynamic(() => import('@matter/registry/waves').then((m) => m.Waves), { ssr: false });

interface Layer {
  color: string;
  amplitude: number;
  frequency: number;
  speed: number;
  glow: number;
  thickness: number;
  offset: number;
  turbulence: number;
}

interface Params {
  // globals
  amplitude: number;
  frequency: number;
  speed: number;
  glow: number;
  thickness: number;
  baseline: number;
  // per-layer
  layers: Layer[];
}

const MIN_LAYERS = 1;
const MAX_LAYERS = 12;

const INITIAL: Params = {
  amplitude: 0.09,
  frequency: 1,
  speed: 1,
  glow: 0.72,
  thickness: 0.65,
  baseline: 0.08,
  layers: [
    {
      color: palette.red.light,
      amplitude: 0.045,
      frequency: 0.75,
      speed: 0.55,
      glow: 0.55,
      thickness: 0.45,
      offset: 0,
      turbulence: 0.12,
    },
    {
      color: palette.amber.base,
      amplitude: 0.065,
      frequency: 1.05,
      speed: 0.8,
      glow: 0.62,
      thickness: 0.55,
      offset: 1.57,
      turbulence: 0.32,
    },
    {
      color: palette.green.base,
      amplitude: 0.09,
      frequency: 1.35,
      speed: 1.05,
      glow: 0.7,
      thickness: 0.65,
      offset: 3.14,
      turbulence: 0.52,
    },
    {
      color: palette.blue.light,
      amplitude: 0.115,
      frequency: 1.7,
      speed: 1.3,
      glow: 0.78,
      thickness: 0.75,
      offset: 4.71,
      turbulence: 0.72,
    },
  ],
};

const formatNumber = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const formatLayer = (layer: Layer) =>
  `{ color: '${layer.color}', amplitude: ${formatNumber(layer.amplitude)}, frequency: ${formatNumber(layer.frequency)}, speed: ${formatNumber(layer.speed)}, glow: ${formatNumber(layer.glow)}, thickness: ${formatNumber(layer.thickness)}, offset: ${formatNumber(layer.offset)}, turbulence: ${formatNumber(layer.turbulence)} }`;

const formatLayers = (layers: Layer[]) => layers.map(formatLayer).join(',\n    ');

const formatJsx = (params: Params) =>
  `<ShaderScene>
  <Waves
    amplitude={${formatNumber(params.amplitude)}}
    frequency={${formatNumber(params.frequency)}}
    speed={${formatNumber(params.speed)}}
    glow={${formatNumber(params.glow)}}
    thickness={${formatNumber(params.thickness)}}
    baseline={${formatNumber(params.baseline)}}
    layers={[
    ${formatLayers(params.layers)}
    ]}
  />
</ShaderScene>`;

const formatParams = (params: Params) =>
  `{
  amplitude: ${formatNumber(params.amplitude)},
  frequency: ${formatNumber(params.frequency)},
  speed: ${formatNumber(params.speed)},
  glow: ${formatNumber(params.glow)},
  thickness: ${formatNumber(params.thickness)},
  baseline: ${formatNumber(params.baseline)},
  layers: [
    ${formatLayers(params.layers)}
  ],
}`;

export default function WavesPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<Params>(() => structuredClone(INITIAL));

  useEffect(() => {
    const container = paneContainerRef.current;

    if (!container) return;

    const local: Params = structuredClone(INITIAL);
    const pane = new Pane({ container, title: '<Waves>' });
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

    pane.addBinding(local, 'amplitude', { min: 0, max: 0.3, step: 0.005 });
    pane.addBinding(local, 'frequency', { min: 0.1, max: 10, step: 0.05 });
    pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 });
    pane.addBinding(local, 'glow', { min: 0, max: 3, step: 0.01 });
    pane.addBinding(local, 'thickness', { min: 0.1, max: 4, step: 0.01 });
    pane.addBinding(local, 'baseline', { min: -1, max: 1, step: 0.01 });
    pane.addBlade({ view: 'separator' });

    const layersFolder = pane.addFolder({ title: 'Layers' });

    // Tweakpane folders are static; to render variable-length lists we
    // dispose every child of the layers folder and rebuild on each mutation.
    const rebuildLayers = () => {
      for (const child of [...layersFolder.children]) child.dispose();

      local.layers.forEach((layer, layerIndex) => {
        const row = layersFolder.addFolder({
          title: `Layer ${layerIndex}`,
          expanded: layerIndex === 0,
        });

        row.addBinding(layer, 'color');
        row.addBinding(layer, 'amplitude', { min: 0, max: 0.3, step: 0.005 });
        row.addBinding(layer, 'frequency', { min: 0.1, max: 10, step: 0.05 });
        row.addBinding(layer, 'speed', { min: 0, max: 4, step: 0.05 });
        row.addBinding(layer, 'glow', { min: 0, max: 3, step: 0.01 });
        row.addBinding(layer, 'thickness', { min: 0.1, max: 4, step: 0.01 });
        row.addBinding(layer, 'offset', { min: 0, max: 6.28, step: 0.01 });
        row.addBinding(layer, 'turbulence', { min: 0, max: 1, step: 0.01 });

        const removeButton = row.addButton({ title: 'Remove layer' });

        if (local.layers.length <= MIN_LAYERS) removeButton.disabled = true;
        removeButton.on('click', () => {
          local.layers.splice(layerIndex, 1);
          rebuildLayers();
          sync();
        });
      });

      const addButton = layersFolder.addButton({ title: '+ Add layer' });

      if (local.layers.length >= MAX_LAYERS) addButton.disabled = true;
      addButton.on('click', () => {
        const last = local.layers[local.layers.length - 1];
        const next: Layer = {
          color: last?.color ?? palette.red.light,
          amplitude: last?.amplitude ?? 0.07,
          frequency: last?.frequency ?? 1,
          speed: last?.speed ?? 1,
          glow: last?.glow ?? 1,
          thickness: last?.thickness ?? 1,
          offset: ((last?.offset ?? 0) + 1.57) % 6.28,
          turbulence: last?.turbulence ?? 0.35,
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

  // Convert page-state Layer (concrete numbers) to WaveLayer for the component.
  // Same shape; the shader treats concrete values as overrides (literal bake).
  const layers: WaveLayer[] = params.layers.map((layer) => ({
    color: layer.color,
    amplitude: layer.amplitude,
    frequency: layer.frequency,
    speed: layer.speed,
    glow: layer.glow,
    thickness: layer.thickness,
    offset: layer.offset,
    turbulence: layer.turbulence,
  }));

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', background: '#0a0a14' }}>
        <ShaderScene>
          <Waves
            amplitude={params.amplitude}
            baseline={params.baseline}
            frequency={params.frequency}
            glow={params.glow}
            layers={layers}
            speed={params.speed}
            thickness={params.thickness}
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
        <h1 style={{ marginTop: 0 }}>&lt;Waves /&gt;</h1>
        <p>Additive proximity-glow wave field with per-layer color and physics overrides.</p>
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
