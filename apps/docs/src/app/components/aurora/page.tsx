'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import type { AuroraDirection } from '@matter/registry/aurora';
import { Pane } from 'tweakpane';

import { palette } from '@/lib/palette';
import { addCopyButtons } from '@/lib/paneUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

interface PlainAuroraLayer {
  hex: string;
  speed: number;
  intensity: number;
  variation: number;
  falloff: number;
}

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});
const Aurora = dynamic(() => import('@matter/registry/aurora').then((m) => m.Aurora), {
  ssr: false,
});

interface AuroraParams {
  intensity: number;
  speed: number;
  densityX: number;
  densityY: number;
  falloff: number;
  driftX: number;
  driftY: number;
  turbulence: number;
  direction: AuroraDirection;
  horizonColor: string;
  skyColor: string;
  layers: [PlainAuroraLayer, PlainAuroraLayer, PlainAuroraLayer, PlainAuroraLayer];
}

const INITIAL: AuroraParams = {
  intensity: 1,
  speed: 0.6,
  densityX: 1.35,
  densityY: 5.35,
  falloff: 1.1,
  driftX: 0.2,
  driftY: -3.15,
  turbulence: 1.3,
  direction: 'top',
  horizonColor: '#040009',
  skyColor: '#146389',
  layers: [
    {
      hex: palette.green.base,
      speed: 0.07,
      intensity: 0.6,
      variation: 0,
      falloff: 1,
    },
    {
      hex: palette.blue.base,
      speed: 0.1,
      intensity: 0.2,
      variation: 5,
      falloff: 1,
    },
    {
      hex: palette.violet.base,
      speed: 0.15,
      intensity: 0.3,
      variation: 11,
      falloff: 1,
    },
    {
      hex: palette.magenta.base,
      speed: 0.07,
      intensity: 0.2,
      variation: 17,
      falloff: 1,
    },
  ],
};

const LAYER_TITLES = ['Layer 0', 'Layer 1', 'Layer 2', 'Layer 3'];

const fmtNum = (numericValue: number) => {
  const roundedValue = Math.round(numericValue * 10000) / 10000;

  return String(roundedValue);
};

const fmtLayer = (layer: PlainAuroraLayer) =>
  `{ hex: '${layer.hex}', speed: ${fmtNum(layer.speed)}, intensity: ${fmtNum(
    layer.intensity,
  )}, variation: ${fmtNum(layer.variation)}, falloff: ${fmtNum(layer.falloff)} }`;

const fmtJsx = (params: AuroraParams) =>
  `<ShaderScene>
  <Aurora
    intensity={${fmtNum(params.intensity)}}
    speed={${fmtNum(params.speed)}}
    densityX={${fmtNum(params.densityX)}}
    densityY={${fmtNum(params.densityY)}}
    falloff={${fmtNum(params.falloff)}}
    driftX={${fmtNum(params.driftX)}}
    driftY={${fmtNum(params.driftY)}}
    turbulence={${fmtNum(params.turbulence)}}
    direction="${params.direction}"
    horizonColor="${params.horizonColor}"
    skyColor="${params.skyColor}"
    layers={[
      ${fmtLayer(params.layers[0])},
      ${fmtLayer(params.layers[1])},
      ${fmtLayer(params.layers[2])},
      ${fmtLayer(params.layers[3])},
    ]}
  />
</ShaderScene>`;

const fmtParams = (params: AuroraParams) =>
  `{
  intensity: ${fmtNum(params.intensity)},
  speed: ${fmtNum(params.speed)},
  densityX: ${fmtNum(params.densityX)},
  densityY: ${fmtNum(params.densityY)},
  falloff: ${fmtNum(params.falloff)},
  driftX: ${fmtNum(params.driftX)},
  driftY: ${fmtNum(params.driftY)},
  turbulence: ${fmtNum(params.turbulence)},
  direction: '${params.direction}',
  horizonColor: '${params.horizonColor}',
  skyColor: '${params.skyColor}',
  layers: [
    ${fmtLayer(params.layers[0])},
    ${fmtLayer(params.layers[1])},
    ${fmtLayer(params.layers[2])},
    ${fmtLayer(params.layers[3])},
  ],
}`;

export default function AuroraPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<AuroraParams>(INITIAL);

  useEffect(() => {
    const container = paneContainerRef.current;

    if (!container) return;
    // Tweakpane mutates `local` in place; we sync to React state on `change`.
    const local: AuroraParams = structuredClone(INITIAL);

    const pane = new Pane({ container, title: '<Aurora>' });
    const syncToReact = () => setParams(structuredClone(local));

    // Remembered pre-mute intensity per layer, so Unmute can restore.
    const savedIntensities: number[] = INITIAL.layers.map((layer) => layer.intensity);
    const muteBtns: Array<{ title: string } | null> = [null, null, null, null];

    const resetGlobals = () => {
      local.intensity = INITIAL.intensity;
      local.speed = INITIAL.speed;
      local.densityX = INITIAL.densityX;
      local.densityY = INITIAL.densityY;
      local.falloff = INITIAL.falloff;
      local.driftX = INITIAL.driftX;
      local.driftY = INITIAL.driftY;
      local.turbulence = INITIAL.turbulence;
      local.direction = INITIAL.direction;
      local.horizonColor = INITIAL.horizonColor;
      local.skyColor = INITIAL.skyColor;
    };

    const resetLayer = (layerIndex: number) => {
      const layer = local.layers[layerIndex];
      const initial = INITIAL.layers[layerIndex];

      if (layer === undefined || initial === undefined) return;
      Object.assign(layer, initial);
      savedIntensities[layerIndex] = initial.intensity;
      const button = muteBtns[layerIndex];

      if (button) button.title = 'Mute layer';
    };

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      resetGlobals();
      for (let layerIndex = 0; layerIndex < 4; layerIndex += 1) resetLayer(layerIndex);
      pane.refresh();
      syncToReact();
    });

    addCopyButtons(
      pane,
      () => fmtJsx(local),
      () => fmtParams(local),
    );

    const globals = pane.addFolder({ title: 'Global' });

    globals.addBinding(local, 'intensity', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'speed', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'densityX', {
      label: 'density X',
      min: 0.5,
      max: 10,
      step: 0.05,
    });
    globals.addBinding(local, 'densityY', {
      label: 'density Y',
      min: 0.5,
      max: 10,
      step: 0.05,
    });
    globals.addBinding(local, 'falloff', { min: 0, max: 2, step: 0.01 });
    globals.addBinding(local, 'driftX', {
      label: 'drift X',
      min: -5,
      max: 5,
      step: 0.05,
    });
    globals.addBinding(local, 'driftY', {
      label: 'drift Y',
      min: -5,
      max: 5,
      step: 0.05,
    });
    globals.addBinding(local, 'turbulence', { min: 0, max: 3, step: 0.01 });
    globals.addBinding(local, 'direction', {
      label: 'from',
      options: { Bottom: 'bottom', Top: 'top', Left: 'left', Right: 'right' },
    });
    globals.addBinding(local, 'horizonColor', { label: 'horizon' });
    globals.addBinding(local, 'skyColor', { label: 'sky' });

    for (let layerIndex = 0; layerIndex < 4; layerIndex += 1) {
      const title = LAYER_TITLES[layerIndex];
      const layer = local.layers[layerIndex];
      const initial = INITIAL.layers[layerIndex];

      if (title === undefined || layer === undefined || initial === undefined) continue;
      const folder = pane.addFolder({
        title,
        expanded: layerIndex === 0,
      });

      const muteBtn = folder.addButton({
        title: layer.intensity > 0 ? 'Mute layer' : 'Unmute layer',
      });

      muteBtns[layerIndex] = muteBtn;
      muteBtn.on('click', () => {
        if (layer.intensity > 0) {
          savedIntensities[layerIndex] = layer.intensity;
          layer.intensity = 0;
          muteBtn.title = 'Unmute layer';
        } else {
          const restore = savedIntensities[layerIndex] ?? initial.intensity;

          layer.intensity = restore > 0 ? restore : initial.intensity;
          muteBtn.title = 'Mute layer';
        }
        pane.refresh();
        syncToReact();
      });

      folder.addBinding(layer, 'hex', { label: 'color' });
      folder.addBinding(layer, 'speed', { min: 0, max: 0.5, step: 0.005 });
      folder.addBinding(layer, 'intensity', { min: 0, max: 1, step: 0.01 });
      folder.addBinding(layer, 'falloff', {
        label: 'falloff ×',
        min: 0.1,
        max: 3,
        step: 0.01,
      });

      folder.addButton({ title: 'Reset layer' }).on('click', () => {
        resetLayer(layerIndex);
        pane.refresh();
        syncToReact();
      });
    }

    pane.on('change', () => {
      syncToReact();
    });

    return () => {
      pane.dispose();
    };
  }, []);

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <Image
          alt="Aurora shader preview: cyan sky over green and blue curtain bands with a dark horizon"
          fill
          priority
          sizes="100vw"
          src="/posters/aurora.jpg"
          style={{ objectFit: 'cover' }}
        />
        <ShaderScene>
          <Aurora
            densityX={params.densityX}
            densityY={params.densityY}
            direction={params.direction}
            driftX={params.driftX}
            driftY={params.driftY}
            falloff={params.falloff}
            horizonColor={params.horizonColor}
            intensity={params.intensity}
            layers={params.layers}
            skyColor={params.skyColor}
            speed={params.speed}
            turbulence={params.turbulence}
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
  <Aurora intensity={1} falloff={0.6} layers={[...]} />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
