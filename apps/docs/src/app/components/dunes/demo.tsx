'use client';

/**
 * Dunes demo island: the interactive slice of the Dunes page, with its
 * control store, shader preview, and control panel for the camera, the sand,
 * the sun, and the temporary tuning rig. The shared components/[slug] template renders this
 * between its static header and prose sections.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  COLOR_SPACE_OPTIONS,
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  HUE_ARC_OPTIONS,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { type DunesParams, INITIAL } from './params';

const DunesScene = dynamic(() => import('./scene'), { ssr: false });

function DunesDemo() {
  const params = useSnapshot<DunesParams>();

  return (
    <DemoPoster
      alt="Dunes shader preview: rows of wind-shaped sand dunes, golden on the faces toward a low sun and rose brown on the shaded ones, running to a horizon under a pale blue sky"
      src="/posters/dunes.jpg"
    >
      <DunesScene params={params}>
        <VisualTestPause />
      </DunesScene>
    </DemoPoster>
  );
}

/** The panel's controls without the panel around them. */
function DunesFields() {
  return (
    <>
      <Section title="Camera">
        <SliderInput label="Altitude" max={4} min={0.5} path="altitude" step={0.01} />
        <SliderInput label="Tilt" max={60} min={-10} path="tilt" step={0.5} />
        <SliderInput label="Field of view" max={100} min={20} path="fieldOfView" step={1} />
      </Section>
      <Section title="Sand">
        <SliderInput label="Scale" max={20} min={1} path="scale" step={0.1} />
        <SliderInput label="Relief" max={2} min={0} path="relief" step={0.01} />
        <SliderInput label="Ripples" max={1} min={0} path="ripples" step={0.01} />
      </Section>
      <Section title="Sun">
        <SliderInput label="Sun angle" max={360} min={0} path="sunAngle" step={1} />
        <SliderInput label="Sun height" max={90} min={0} path="sunHeight" step={0.5} />
        <ColorInput label="Color" path="color" />
        <ColorInput label="Shadow color" path="shadowColor" />
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <Section title="Tuning (dev)">
        <SliderInput label="Step scale" max={1} min={0.1} path="tuning.stepScale" step={0.01} />
        <SliderInput label="Max distance" max={120} min={5} path="tuning.maxDistance" step={1} />
        <SliderInput label="Wind angle" max={360} min={0} path="tuning.windAngle" step={1} />
        <SliderInput label="Slip face" max={0.5} min={0.05} path="tuning.slipFace" step={0.01} />
        <SliderInput label="Meander" max={4} min={0} path="tuning.meander" step={0.05} />
        <SliderInput
          label="Ripple size"
          max={0.5}
          min={0.05}
          path="tuning.rippleSize"
          step={0.005}
        />
        <SliderInput
          label="Ripple height"
          max={0.05}
          min={0}
          path="tuning.rippleHeight"
          step={0.001}
        />
      </Section>
    </>
  );
}

function DunesControls() {
  return (
    <ControlPanel>
      <DunesFields />
    </ControlPanel>
  );
}

export function DunesIsland() {
  const store = useMemo(() => createControlStore<DunesParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<DunesControls />}>
        <div data-shader-demo>
          <DunesDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
