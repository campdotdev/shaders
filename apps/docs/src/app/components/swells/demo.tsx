'use client';

/**
 * Swells demo island: the interactive slice of the Swells page, with its
 * control store, shader preview, and control panel for the camera, the swells'
 * shape, the light and the colors it blends, the sheen and haze, the
 * glide, the swells' travel, the parallax sway toward the pointer,
 * and the intro. The shared components/[slug] template renders this
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

import { INITIAL, type SwellsParams } from './params';

const SwellsScene = dynamic(() => import('./scene'), { ssr: false });

function SwellsDemo() {
  const params = useSnapshot<SwellsParams>();

  return (
    <DemoPoster
      alt="Swells shader preview: rows of rolling swells, pink-violet on the faces toward the light and deep blue on the shaded ones, fading into a violet haze at the horizon under a dark sky"
      src="/posters/swells.jpg"
    >
      <SwellsScene params={params}>
        <VisualTestPause />
      </SwellsScene>
    </DemoPoster>
  );
}

/** The panel's controls without the panel around them. */
function SwellsFields() {
  return (
    <>
      <Section title="Camera">
        <SliderInput label="Altitude" max={4} min={0.5} path="altitude" step={0.01} />
        <SliderInput label="Tilt" max={60} min={-10} path="tilt" step={0.5} />
        <SliderInput label="Field of view" max={100} min={20} path="fieldOfView" step={1} />
      </Section>
      <Section title="Shape">
        <SliderInput label="Scale" max={20} min={1} path="scale" step={0.1} />
        <SliderInput label="Relief" max={2} min={0} path="relief" step={0.01} />
        <SliderInput label="Sharpness" max={1} min={0} path="sharpness" step={0.01} />
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Ripples" max={1} min={0} path="ripples" step={0.01} />
      </Section>
      <Section title="Light">
        <SliderInput label="Light angle" max={360} min={0} path="lightAngle" step={1} />
        <SliderInput label="Light height" max={90} min={0} path="lightHeight" step={0.5} />
        <SliderInput label="Shadows" max={1} min={0} path="shadows" step={0.01} />
        <SliderInput label="Skylight" max={1} min={0} path="skylight" step={0.01} />
        <ColorInput label="Color" path="color" />
        <ColorInput label="Shadow color" path="shadowColor" />
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <Section title="Air">
        <SliderInput label="Sheen" max={1} min={0} path="sheen" step={0.01} />
        <ColorInput label="Sheen color" path="sheenColor" />
        <SliderInput label="Rim glow" max={1} min={0} path="rimGlow" step={0.01} />
        <SliderInput label="Glints" max={1} min={0} path="glints" step={0.01} />
        <SliderInput label="Glint size" max={0.2} min={0.002} path="glintSize" step={0.001} />
        <SliderInput label="Haze" max={0.2} min={0} path="haze" step={0.001} />
        <ColorInput label="Haze color" path="hazeColor" />
      </Section>
      <Section title="Motion">
        <SliderInput label="Glide speed" max={2} min={-2} path="glideSpeed" step={0.01} />
        <SliderInput label="Swell speed" max={1} min={0} path="swellSpeed" step={0.01} />
        <SliderInput label="Parallax" max={2} min={0} path="parallax" step={0.01} />
        <SelectInput
          label="Intro"
          options={[
            { label: 'Off', value: false },
            { label: 'On', value: true },
          ]}
          path="intro"
        />
      </Section>
    </>
  );
}

function SwellsControls() {
  return (
    <ControlPanel>
      <SwellsFields />
    </ControlPanel>
  );
}

export function SwellsIsland() {
  const store = useMemo(() => createControlStore<SwellsParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<SwellsControls />}>
        <div data-shader-demo>
          <SwellsDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
