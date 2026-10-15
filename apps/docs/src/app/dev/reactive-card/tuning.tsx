'use client';

/**
 * Temporary tuning rig for the Reactive card's gradient (SHA-216, phase 1):
 * the card's window at the mock's size, beside LiquidGradient's settings.
 * At the defaults gate, bake the landed values into reactive-gradient.ts and
 * delete this route.
 */
import { useMemo } from 'react';

import {
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  ListInput,
  NumberInput,
  Section,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import featureStyles from '@/components/features/features.module.css';
import { REACTIVE_GRADIENT, type ReactiveGradient } from '@/components/features/reactive-gradient';
import { ReactiveIllustration } from '@/components/features/reactive-illustration';
import { createStop, newStopIndex, type PositionedStop } from '@/lib/stops';

import styles from './tuning.module.css';

// The card, and the settings it draws with as JSON, to paste back into
// reactive-gradient.ts.
function Preview() {
  const gradient = useSnapshot<ReactiveGradient>();

  return (
    <div className={styles.preview}>
      <div className={`${featureStyles.window} ${styles.window}`}>
        <ReactiveIllustration gradient={gradient} />
      </div>
      <pre className={styles.values}>{JSON.stringify(gradient, null, 2)}</pre>
    </div>
  );
}

function Controls() {
  return (
    <ControlPanel>
      <Section title="Bands">
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Repeat" max={8} min={1} path="repeat" step={0.1} />
        <SliderInput label="Softness" max={1} min={0} path="softness" step={0.01} />
      </Section>
      <Section title="Flow">
        <SliderInput label="Swirl" max={2} min={0} path="swirl" step={0.01} />
        <SliderInput label="Scale" max={4} min={0.5} path="scale" step={0.1} />
        <SliderInput label="Seed" max={100} min={0} path="seed" step={1} />
      </Section>
      <ListInput<PositionedStop>
        createItem={createStop}
        insertIndex={newStopIndex}
        itemLabel="stop"
        label="Color stops"
        max={6}
        min={2}
        path="stops"
      >
        {() => (
          <>
            <ColorInput label="Color" path="color" />
            <NumberInput
              label="Position"
              max={1}
              min={0}
              path="position"
              scale={100}
              step={0.01}
              unit="%"
            />
          </>
        )}
      </ListInput>
    </ControlPanel>
  );
}

export default function Tuning() {
  const store = useMemo(() => createControlStore<ReactiveGradient>(REACTIVE_GRADIENT), []);

  return (
    <ControlsProvider store={store}>
      <div className={styles.page}>
        <DemoLayout controls={<Controls />}>
          <Preview />
        </DemoLayout>
      </div>
    </ControlsProvider>
  );
}
