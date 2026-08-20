// Fixture wrapper mirroring the real registry shape: a component directory
// whose wrapper imports a sibling shader and a shared util one level up.
import { helper } from '@matter-internal/lib';

import type { ColorStop } from '../utils/color';
import { NestedShader } from './shader';

export function NestedComponent({ stops }: { stops: ColorStop[] }) {
  return NestedShader(helper(stops));
}
