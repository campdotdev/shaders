'use client';

// One scene for CursorTrail phase reviews, at the homepage hero's 1636 by
// 696 CSS pixel proportions, the size composition 2 is measured at. The
// sources show the trail over a flat field and over a dark LED wall, where
// each cell reads one heat value.
import { useEffect, useMemo, useState } from 'react';

import {
  CursorTrail,
  getReducedMotionPolicy,
  LedWall,
  LinearGradient,
  type ReducedMotionPolicy,
  setReducedMotionPolicy,
  ShaderMonitor,
  ShaderScene,
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

// ---- Probe settings
interface ProbeParams {
  radius: number;
  intensity: number;
  decay: number;
  source: 'flat' | 'wall';
}

const INITIAL: ProbeParams = {
  radius: 0.1,
  intensity: 0.5,
  decay: 0.5,
  source: 'flat',
};

// A dark blue-gray ramp, so added light shows at every point.
const DARK_STOPS = [{ color: 'oklch(0.18 0.03 260)' }, { color: 'oklch(0.28 0.05 250)' }];

function LiveScene({ paused }: { paused: boolean }) {
  const params = useSnapshot<ProbeParams>();

  return (
    <ShaderScene maxDPR={2} paused={paused}>
      <LinearGradient stops={DARK_STOPS} />
      <CursorTrail decay={params.decay} intensity={params.intensity} radius={params.radius} />
      {params.source === 'wall' ? (
        <LedWall bleed={0} dotSize={7} flicker={0} spacing={8} swell={0} />
      ) : null}
      <ShaderMonitor anchor="top-left" />
    </ShaderScene>
  );
}

// ---- Effect controls
function Controls() {
  return (
    <ControlPanel>
      <Section title="Trail">
        <SliderInput label="Radius" max={0.4} min={0} path="radius" step={0.01} />
        <SliderInput label="Intensity" max={2} min={0} path="intensity" step={0.05} />
        <SliderInput label="Decay" max={3} min={0} path="decay" step={0.05} />
        <SelectInput
          label="Source"
          options={[
            { label: 'Flat gradient', value: 'flat' },
            { label: 'LED wall', value: 'wall' },
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
  const [paused, setPaused] = useState(false);
  const [motion, setMotion] = useState<ReducedMotionPolicy>(getReducedMotionPolicy);

  // Restore the app's policy when leaving this dev-only probe.
  useEffect(() => {
    const previous = getReducedMotionPolicy();

    return () => setReducedMotionPolicy(previous);
  }, []);

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#09090b', color: '#fafafa' }}>
      <h1>CursorTrail probe</h1>
      <p>
        Move across the image. The heat cools to nothing in Decay seconds, so a faster move leaves a
        longer tail. A still pointer keeps a steady spot, and the spot cools away like the trail
        when the pointer leaves. Under the paused motion policy, only the spot shows.
      </p>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBlock: 16 }}>
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
            data-trail-probe
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 1100,
              aspectRatio: '1636 / 696',
            }}
          >
            <LiveScene paused={paused} />
          </div>
          <div style={{ width: 300 }}>
            <Controls />
          </div>
        </div>
      </ControlsProvider>
    </div>
  );
}
