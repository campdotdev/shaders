// Fixture shader for nested-component. Imports the shared util too, which is
// what makes utils/color.ts reachable from more than one file in the set.
import type { ColorStop } from '../utils/color';

export function NestedShader(stops: ColorStop[]) {
  return stops;
}
