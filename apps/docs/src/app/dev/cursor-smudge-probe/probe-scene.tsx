'use client';

// One scene for CursorSmudge phase reviews. The card-sized mode measures
// the complete effect at 312 by 309 CSS pixels and a maximum DPR of 2.
// The tall page also lets a phone push the scene while scrolling it.
import { useEffect, useMemo, useState } from 'react';

import {
  CursorSmudge,
  getReducedMotionPolicy,
  LinearGradient,
  LiquidGradient,
  type ReducedMotionPolicy,
  setReducedMotionPolicy,
  ShaderMonitor,
  ShaderScene,
  useStaticSceneHint,
} from '@camp-dev/shaders';

import {
  ControlPanel,
  ControlsProvider,
  createControlStore,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';

// ---- Probe settings and measured scene
interface ProbeParams {
  strength: number;
  radius: number;
  decay: number;
  source: 'liquid' | 'linear';
}

const INITIAL: ProbeParams = {
  strength: 0.12,
  radius: 0.18,
  decay: 0.4,
  source: 'liquid',
};

function KeepDrawing() {
  useStaticSceneHint(false);

  return null;
}

function LiveScene({ benchmark, paused }: { benchmark: boolean; paused: boolean }) {
  const params = useSnapshot<ProbeParams>();

  return (
    <ShaderScene maxDPR={2} paused={paused} scrollPush>
      {params.source === 'liquid' ? <LiquidGradient speed={0} /> : <LinearGradient />}
      <CursorSmudge decay={params.decay} radius={params.radius} strength={params.strength} />
      {benchmark ? <KeepDrawing /> : null}
      <ShaderMonitor anchor="top-left" />
    </ShaderScene>
  );
}

// ---- Effect controls
function Controls() {
  return (
    <ControlPanel>
      <Section title="Smudge">
        <SliderInput label="Strength" max={0.3} min={0} path="strength" step={0.01} />
        <SliderInput label="Radius" max={0.5} min={0.01} path="radius" step={0.01} />
        <SliderInput label="Decay" max={1} min={0} path="decay" step={0.01} />
        <SelectInput
          label="Source"
          options={[
            { label: 'LiquidGradient', value: 'liquid' },
            { label: 'LinearGradient', value: 'linear' },
          ]}
          path="source"
        />
      </Section>
    </ControlPanel>
  );
}

// ---- Review layout and scene policies
export default function ProbeScene() {
  const store = useMemo(() => createControlStore<ProbeParams>(INITIAL), []);
  const [benchmark, setBenchmark] = useState(false);
  const [large, setLarge] = useState(false);
  const [paused, setPaused] = useState(false);
  const [motion, setMotion] = useState<ReducedMotionPolicy>(getReducedMotionPolicy);

  // Restore the app's policy when leaving this dev-only probe.
  useEffect(() => {
    const previous = getReducedMotionPolicy();

    return () => setReducedMotionPolicy(previous);
  }, []);

  return (
    <main style={{ padding: 24, minHeight: '180vh', background: '#09090b', color: '#fafafa' }}>
      <h1>CursorSmudge · phase 3</h1>
      <p>
        Move over the still gradient. Stop to watch it recover. On a phone, scroll with a finger
        starting on the image.
      </p>
      <p>
        {large ? '624 × 618' : '312 × 309'} CSS pixels, up to 2× pixel density. The GPU reading
        includes the displacement pass.
      </p>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBlock: 16 }}>
        <label>
          <input
            checked={benchmark}
            onChange={(event) => setBenchmark(event.target.checked)}
            type="checkbox"
          />{' '}
          Keep drawing for GPU measurement
        </label>
        <label>
          <input
            checked={large}
            onChange={(event) => setLarge(event.target.checked)}
            type="checkbox"
          />{' '}
          Larger preview
        </label>
        <label>
          <input
            checked={paused}
            onChange={(event) => setPaused(event.target.checked)}
            type="checkbox"
          />{' '}
          Pause scene
        </label>
        <label>
          Motion policy{' '}
          <select
            onChange={(event) => {
              const next = event.target.value;

              if (next === 'auto' || next === 'off' || next === 'slow' || next === 'paused') {
                setMotion(next);
                setReducedMotionPolicy(next);
              }
            }}
            value={motion}
          >
            <option value="auto">Follow system</option>
            <option value="off">Full speed</option>
            <option value="slow">Slow</option>
            <option value="paused">Paused, clear effect</option>
          </select>
        </label>
      </div>
      <ControlsProvider store={store}>
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
          <div
            data-smudge-probe
            style={{
              position: 'relative',
              width: large ? 624 : 312,
              height: large ? 618 : 309,
              flexShrink: 0,
            }}
          >
            <LiveScene benchmark={benchmark} paused={paused} />
          </div>
          <div style={{ width: 300 }}>
            <Controls />
          </div>
        </div>
      </ControlsProvider>
    </main>
  );
}
