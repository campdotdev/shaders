'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { colorRamp, type ColorRampStop, elapsedTime, fractalNoise } from '@lovo/matter';
import { ShaderScene, useShaderContext } from '@lovo/matter-react';
import { uniform, uv, vec2, vec3 } from 'three/tsl';
import { Pane } from 'tweakpane';

import { addPlaneMesh } from '@/lib/meshUtils';

interface Params {
  octaves: number;
  lacunarity: number;
  gain: number;
  scale: number;
  timeSpeed: number;
}

const INITIAL: Params = {
  octaves: 4,
  lacunarity: 2.0,
  gain: 0.5,
  scale: 3.0,
  timeSpeed: 0.2,
};

const STOPS: ColorRampStop[] = [
  { color: vec3(0, 0, 0), position: 0 },
  { color: vec3(1, 1, 1), position: 1 },
];

function FbmMesh({
  octaves,
  lacunarity,
  gain,
  scaleUniform,
  timeSpeedUniform,
}: {
  octaves: number;
  lacunarity: number;
  gain: number;
  scaleUniform: ReturnType<typeof uniform>;
  timeSpeedUniform: ReturnType<typeof uniform>;
}) {
  const ctx = useShaderContext();

  useEffect(() => {
    if (!ctx) return;

    const animatedUv = uv()
      .mul(scaleUniform)
      .add(vec2(elapsedTime.mul(timeSpeedUniform), elapsedTime.mul(timeSpeedUniform)));
    const noiseValue = fractalNoise(animatedUv, { octaves, lacunarity, gain });
    const fbmNormalized = noiseValue.add(1).mul(0.5);

    return addPlaneMesh(ctx, colorRamp(fbmNormalized, STOPS));
  }, [ctx, octaves, lacunarity, gain, scaleUniform, timeSpeedUniform]);

  return null;
}

export default function FbmPlayground() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<Params>(INITIAL);

  const [instanceKey, setInstanceKey] = useState(0);

  const scaleUniform = useMemo(() => uniform(INITIAL.scale), []);
  const timeSpeedUniform = useMemo(() => uniform(INITIAL.timeSpeed), []);

  useEffect(() => {
    const container = paneContainerRef.current;

    if (!container) return;

    const local = { ...INITIAL };
    const pane = new Pane({ container, title: 'FBM playground' });

    pane.addBinding(local, 'octaves', { min: 1, max: 8, step: 1 });
    pane.addBinding(local, 'lacunarity', { min: 1, max: 4, step: 0.05 });
    pane.addBinding(local, 'gain', { min: 0, max: 1, step: 0.01 });
    pane.addBlade({ view: 'separator' });
    pane.addBinding(local, 'scale', { min: 0.5, max: 10, step: 0.1 });
    pane.addBinding(local, 'timeSpeed', {
      label: 'time speed',
      min: 0,
      max: 2,
      step: 0.01,
    });
    pane.addBlade({ view: 'separator' });
    pane.addButton({ title: 'Apply octaves / lacunarity / gain' }).on('click', () => {
      setParams({ ...local });
      setInstanceKey((k) => k + 1);
    });

    pane.on('change', (ev) => {
      if (!('key' in ev.target)) return;
      const key = ev.target.key;

      if (key === 'scale') {
        scaleUniform.value = local.scale;
      } else if (key === 'timeSpeed') {
        timeSpeedUniform.value = local.timeSpeed;
      }
    });

    return () => {
      pane.dispose();
    };
  }, [scaleUniform, timeSpeedUniform]);

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <ShaderScene key={instanceKey}>
          <FbmMesh
            gain={params.gain}
            lacunarity={params.lacunarity}
            octaves={params.octaves}
            scaleUniform={scaleUniform}
            timeSpeedUniform={timeSpeedUniform}
          />
        </ShaderScene>
      </div>
      <div
        ref={paneContainerRef}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 10,
          width: '320px',
        }}
      />
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>FBM playground</h1>
        <p>
          Internal Matter dev surface — not part of the public component catalog. Use this to feel
          out good defaults for <code>octaves</code>, <code>lacunarity</code>, and <code>gain</code>{' '}
          when prototyping FBM-based shaders.
        </p>
      </section>
    </main>
  );
}
