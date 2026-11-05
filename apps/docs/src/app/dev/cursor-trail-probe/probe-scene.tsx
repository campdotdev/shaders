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
  hold: 'off' | 'on';
  grow: number;
  smoothing: number;
}

const INITIAL: ProbeParams = {
  radius: 0.1,
  intensity: 0.5,
  decay: 0.75,
  source: 'flat',
  hold: 'off',
  grow: 0.3,
  smoothing: 0.05,
};

// A dark blue-gray ramp, so added light shows at every point.
const DARK_STOPS = [{ color: 'oklch(0.18 0.03 260)' }, { color: 'oklch(0.28 0.05 250)' }];

function LiveScene({ paused }: { paused: boolean }) {
  const params = useSnapshot<ProbeParams>();

  return (
    <ShaderScene maxDPR={2} paused={paused}>
      <LinearGradient stops={DARK_STOPS} />
      <CursorTrail
        decay={params.decay}
        grow={params.grow}
        hold={params.hold === 'on'}
        intensity={params.intensity}
        radius={params.radius}
        smoothing={params.smoothing}
      />
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
        <SelectInput
          label="Hold"
          options={[
            { label: 'Off: everything fades away', value: 'off' },
            { label: 'On: a still pointer keeps a spot', value: 'on' },
          ]}
          path="hold"
        />
        <SliderInput label="Grow" max={2} min={0} path="grow" step={0.05} />
        <SliderInput label="Smoothing" max={0.3} min={0} path="smoothing" step={0.01} />
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
        Move across the image. A moving pointer trails about as far as it travels in Decay seconds,
        so a faster move leaves a longer tail. A stopped pointer draws the trail in along its path
        over Decay seconds. With Hold off, the head fades as the tail shortens, leaving nothing.
        With Hold on, the tail shortens into a steady spot, which fades when the pointer leaves.
        Grow widens the whole trail with the pointer's speed and eases it back as the pointer slows.
        Smoothing averages the path behind the head, so the trail follows a smoother curve than the
        pointer took. Under the paused motion policy, the trail is off, so only a held spot shows.
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
