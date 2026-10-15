'use client';

/**
 * Temporary tuning rig for the Reactive card's still frame (SHA-216, phase
 * 1): the card's window at the mock's size, beside LiquidGradient's settings
 * and the held smudge's. At the defaults gate, bake the landed values into
 * reactive-gradient.ts and reactive-smudge.ts and delete this route.
 */
import { useMemo, useState } from 'react';

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
import { REACTIVE_SMUDGE, type ReactiveSmudge } from '@/components/features/reactive-smudge';
import { createStop, newStopIndex, type PositionedStop } from '@/lib/stops';

import styles from './tuning.module.css';

type TuningParams = ReactiveGradient & ReactiveSmudge;

// The card, and the settings it draws with as JSON, to paste back into
// reactive-gradient.ts and reactive-smudge.ts. Laying the J again mounts a
// fresh scene, whose field starts empty.
function Preview() {
  const { strength, radius, laySeconds, ...gradient } = useSnapshot<TuningParams>();
  const [lays, setLays] = useState(0);

  return (
    <div className={styles.preview}>
      <div className={`${featureStyles.window} ${styles.window}`}>
        <ReactiveIllustration
          gradient={gradient}
          key={lays}
          smudge={{ strength, radius, laySeconds }}
        />
      </div>
      <button onClick={() => setLays((count) => count + 1)} type="button">
        Lay the J again
      </button>
      <pre className={styles.values}>
        {JSON.stringify({ gradient, smudge: { strength, radius, laySeconds } }, null, 2)}
      </pre>
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
      <Section title="Smudge">
        <SliderInput label="Strength" max={0.3} min={0} path="strength" step={0.01} />
        <SliderInput label="Radius" max={0.5} min={0.01} path="radius" step={0.01} />
        <SliderInput label="Lay seconds" max={3} min={0.2} path="laySeconds" step={0.05} />
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
  const store = useMemo(
    () => createControlStore<TuningParams>({ ...REACTIVE_GRADIENT, ...REACTIVE_SMUDGE }),
    [],
  );

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
