'use client';

// One scene for CursorSmudge phase reviews. The card-sized mode measures
// the complete effect at 312 by 309 CSS pixels and a maximum DPR of 2.
// The tall page also lets a phone push the scene while scrolling it, and a
// scripted stroke (SHA-229) runs the Reactive card's J path.
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { animate, type MotionValue, useMotionValue, useTransform } from 'motion/react';

import {
  ControlPanel,
  ControlsProvider,
  createControlStore,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { EASE_OUT } from '@/lib/easing';

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

// ---- The scripted stroke
// The Reactive card's J path (SHA-216): up from below the bottom edge near
// the left corner, bending over to where the card's arrow sits. A cubic
// Bézier in 0..1 canvas units from the top-left.
const J_PATH = [
  [0.12, 1.15],
  [0.15, 0.55],
  [0.45, 0.35],
  [0.77, 0.33],
] as const;

function pointOnJ(t: number): [number, number] {
  const [p0, p1, p2, p3] = J_PATH;
  const u = 1 - t;
  const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;

  return [
    weights[0] * p0[0] + weights[1] * p1[0] + weights[2] * p2[0] + weights[3] * p3[0],
    weights[0] * p0[1] + weights[1] * p1[1] + weights[2] * p2[1] + weights[3] * p3[1],
  ];
}

/**
 * The point a scripted J stroke follows, whether it is running, and how to
 * start it: from `runStroke`, or the S key, so the pointer can sit on the
 * image while it runs. The caller attaches `point` while `scripting`.
 */
function useScriptedJStroke(seconds: number) {
  const [scripting, setScripting] = useState(false);
  const progress = useMotionValue(0);
  const point = useTransform(progress, pointOnJ);

  // The point starts at the J's foot before the scene attaches it, so the
  // stroke starts there. The scene attaches it in an effect of its own, and
  // a child's effects run before its parent's, so the animation below never
  // runs ahead of the attach.
  const runStroke = useCallback(() => {
    if (scripting) return;
    progress.set(0);
    setScripting(true);
  }, [scripting, progress]);

  useEffect(() => {
    if (!scripting) return undefined;
    const controls = animate(progress, 1, { duration: seconds, ease: EASE_OUT });

    void controls.then(() => setScripting(false));

    return () => controls.stop();
  }, [scripting, progress, seconds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 's') runStroke();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runStroke]);

  return { point, scripting, runStroke };
}

function KeepDrawing() {
  useStaticSceneHint(false);

  return null;
}

function LiveScene({
  benchmark,
  paused,
  strokeAt,
}: {
  benchmark: boolean;
  paused: boolean;
  strokeAt: MotionValue<[number, number]> | null;
}) {
  const params = useSnapshot<ProbeParams>();

  return (
    <ShaderScene maxDPR={2} paused={paused} scrollPush strokeAt={strokeAt}>
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
  const [scriptSeconds, setScriptSeconds] = useState(0.85);
  const { point, scripting, runStroke } = useScriptedJStroke(scriptSeconds);

  // Restore the app's policy when leaving this dev-only probe.
  useEffect(() => {
    const previous = getReducedMotionPolicy();

    return () => setReducedMotionPolicy(previous);
  }, []);

  return (
    <main style={{ padding: 24, minHeight: '180vh', background: '#09090b', color: '#fafafa' }}>
      <h1>CursorSmudge probe</h1>
      <p>
        Move over the still gradient. Stop to watch it recover. On a phone, scroll with a finger
        starting on the image.
      </p>
      <p>
        Scripted stroke: run the Reactive card&apos;s J path with the button, or press S with the
        pointer on the image. Set Decay to 0 to hold it. While it runs, the mouse smudges nothing.
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
        <button disabled={scripting} onClick={runStroke} type="button">
          Run scripted J stroke
        </button>
        <label>
          Stroke length{' '}
          <select
            onChange={(event) => setScriptSeconds(Number(event.target.value))}
            value={scriptSeconds}
          >
            <option value={0.85}>0.85 s, the card&apos;s swoop</option>
            <option value={3}>3 s, time to mouse over it</option>
          </select>
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
            <LiveScene benchmark={benchmark} paused={paused} strokeAt={scripting ? point : null} />
          </div>
          <div style={{ width: 300 }}>
            <Controls />
          </div>
        </div>
      </ControlsProvider>
    </main>
  );
}
