'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { Pane } from 'tweakpane';

import { DemoPoster } from '@/components/DemoPoster';
import { palette } from '@/lib/palette';
import { addCopyButtons } from '@/lib/paneUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

import {
  type AuroraParams,
  INITIAL,
  MAX_LAYERS,
  MIN_LAYERS,
  type PlainAuroraLayer,
} from './params';

const AuroraScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const formatLayer = (layer: PlainAuroraLayer) =>
  `{ color: '${layer.color}', speed: ${formatNumber(layer.speed)}, intensity: ${formatNumber(layer.intensity)}, seed: ${formatNumber(layer.seed)}, falloff: ${formatNumber(layer.falloff)} }`;

const formatLayers = (layers: PlainAuroraLayer[]) => layers.map(formatLayer).join(',\n      ');

const formatJsx = (params: AuroraParams) =>
  `<ShaderScene>
  <Aurora
    intensity={${formatNumber(params.intensity)}}
    speed={${formatNumber(params.speed)}}
    densityX={${formatNumber(params.densityX)}}
    densityY={${formatNumber(params.densityY)}}
    falloff={${formatNumber(params.falloff)}}
    driftX={${formatNumber(params.driftX)}}
    driftY={${formatNumber(params.driftY)}}
    turbulence={${formatNumber(params.turbulence)}}
    direction="${params.direction}"
    layers={[
      ${formatLayers(params.layers)},
    ]}
  />
</ShaderScene>`;

const formatParams = (params: AuroraParams) =>
  `{
  intensity: ${formatNumber(params.intensity)},
  speed: ${formatNumber(params.speed)},
  densityX: ${formatNumber(params.densityX)},
  densityY: ${formatNumber(params.densityY)},
  falloff: ${formatNumber(params.falloff)},
  driftX: ${formatNumber(params.driftX)},
  driftY: ${formatNumber(params.driftY)},
  turbulence: ${formatNumber(params.turbulence)},
  direction: '${params.direction}',
  layers: [
    ${formatLayers(params.layers)},
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

    const globals = pane.addFolder({ title: 'Global' });

    globals.addBinding(local, 'intensity', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'speed', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'densityX', { label: 'density X', min: 0.5, max: 10, step: 0.05 });
    globals.addBinding(local, 'densityY', { label: 'density Y', min: 0.5, max: 10, step: 0.05 });
    globals.addBinding(local, 'falloff', { min: 0, max: 2, step: 0.01 });
    globals.addBinding(local, 'driftX', { label: 'drift X', min: -5, max: 5, step: 0.05 });
    globals.addBinding(local, 'driftY', { label: 'drift Y', min: -5, max: 5, step: 0.05 });
    globals.addBinding(local, 'turbulence', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'direction', {
      label: 'from',
      options: { Bottom: 'bottom', Top: 'top', Left: 'left', Right: 'right' },
    });

    pane.addBlade({ view: 'separator' });

    const layersFolder = pane.addFolder({ title: 'Layers' });

    // Tweakpane folders are static; to render variable-length lists we dispose
    // every child of the layers folder and rebuild on each mutation.
    const rebuildLayers = () => {
      for (const child of [...layersFolder.children]) child.dispose();

      local.layers.forEach((layer, layerIndex) => {
        const row = layersFolder.addFolder({
          title: `Layer ${layerIndex}`,
          expanded: layerIndex === 0,
        });

        row.addBinding(layer, 'color');
        row.addBinding(layer, 'speed', { min: 0, max: 0.5, step: 0.005 });
        row.addBinding(layer, 'intensity', { min: 0, max: 1, step: 0.01 });
        row.addBinding(layer, 'falloff', { label: 'falloff ×', min: 0.1, max: 3, step: 0.01 });
        row.addBinding(layer, 'seed', { min: 0, max: 100, step: 1 });

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
        const next: PlainAuroraLayer = {
          color: last?.color ?? palette.green.base,
          speed: last?.speed ?? 0.1,
          intensity: last?.intensity ?? 0.3,
          seed: ((last?.seed ?? 0) + 6) % 101,
          falloff: last?.falloff ?? 1,
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
      <div data-shader-demo style={{ position: 'relative', background: '#0b0f1a' }}>
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
  <Aurora intensity={1} falloff={1.1} layers={[...]} />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
