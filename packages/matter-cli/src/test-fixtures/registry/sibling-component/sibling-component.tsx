// Second fixture component in its own directory. Exists so a single `add`
// invocation can claim utils/color.ts twice and prove it is written once.
import type { ColorStop } from '../utils/color';
import { SiblingShader } from './shader';

export function SiblingComponent({ stops }: { stops: ColorStop[] }) {
  return SiblingShader(stops);
}
