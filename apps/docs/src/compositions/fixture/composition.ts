/**
 * The fixture composition: a MeshGradient under Grain, there so the
 * composition page, the Gallery grid, the golden files, and the visual spec
 * have something real to draw while the pipeline is built. Composition 1's
 * assembly ticket deletes it, with its golden files, poster, and baselines.
 */
import { defineComposition } from '../define';

export const fixture = defineComposition({
  slug: 'fixture',
  title: 'Fixture',
  description: 'A MeshGradient under Grain, for building the pipeline.',
  stack: [
    { id: 'base', component: 'MeshGradient', props: { speed: 0.4 } },
    { id: 'grain', component: 'Grain', props: { intensity: 0.08 } },
  ],
  presets: [
    { name: 'Tight', props: { base: { frequency: 12, amplitude: 15 } } },
    { name: 'Coarse', props: { grain: { intensity: 0.3 } } },
  ],
  controls: [
    { kind: 'slider', entry: 'base', path: 'speed', label: 'Drift', min: 0, max: 2, step: 0.01 },
  ],
});
