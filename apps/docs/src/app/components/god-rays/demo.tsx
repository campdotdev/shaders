'use client';

/**
 * GodRays demo island: the interactive slice of the GodRays page — control
 * store, shader preview, and control panel for the ray origin and cone,
 * motion, shape dials, and layer colors. The shared components/[slug]
 * template renders this between its static header and prose sections.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  ListInput,
  Section,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import styles from './demo.module.css';
import { type GodRaysParams, INITIAL, MAX_COLORS, MIN_COLORS } from './params';

const GodRaysScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'GodRays' } as const;

/** A new color clones the last one in the list so the addition is visible. */
const createColor = (colors: readonly string[]): string =>
  colors[colors.length - 1] ?? 'oklch(0.8 0.1 80)';

function GodRaysDemo() {
  const params = useSnapshot<GodRaysParams>();

  return (
    <DemoPoster
      alt="GodRays shader preview: layered blue, purple, and pink light rays fanning down from above the top edge over a dark backdrop"
      src="/posters/god-rays.jpg"
    >
      <GodRaysScene params={params}>
        <VisualTestPause />
      </GodRaysScene>
    </DemoPoster>
  );
}

function GodRaysControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<GodRays>">
      <Section title="Origin">
        <SliderInput label="Center X" max={1.5} min={-0.5} path="centerX" step={0.01} />
        <SliderInput label="Center Y" max={1.5} min={-0.5} path="centerY" step={0.01} />
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Spread" max={360} min={10} path="spread" step={1} />
      </Section>
      <Section title="Motion">
        <SliderInput label="Speed" max={3} min={0} path="speed" step={0.01} />
      </Section>
      <Section title="Shape">
        <SliderInput label="Intensity" max={3} min={0} path="intensity" step={0.01} />
        <SliderInput label="Density" max={64} min={2} path="density" step={0.5} />
        <SliderInput label="Diffusion" max={1} min={0} path="diffusion" step={0.01} />
        <SliderInput label="Patchiness" max={1} min={0} path="patchiness" step={0.01} />
        <SliderInput label="Radius" max={2} min={0} path="radius" step={0.01} />
        <SliderInput label="Glow radius" max={1} min={0} path="glowRadius" step={0.01} />
        <SliderInput label="Glow intensity" max={3} min={0} path="glowIntensity" step={0.01} />
      </Section>
      <ListInput<string>
        createItem={createColor}
        itemLabel="color"
        label="Colors (near to far)"
        max={MAX_COLORS}
        min={MIN_COLORS}
        path="colors"
      >
        {() => <ColorInput label="Color" path="" />}
      </ListInput>
    </ControlPanel>
  );
}

export function GodRaysIsland() {
  const store = useMemo(() => createControlStore<GodRaysParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<GodRaysControls />}>
        <div className={styles.demoBackdrop} data-shader-demo>
          <GodRaysDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
