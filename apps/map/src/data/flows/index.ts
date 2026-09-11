// Every flow the map can play. Adding a flow is one file here and one entry
// in this list; nothing else in the app changes.
import type { Flow } from '../types';
import { propToPixel } from './prop-to-pixel';

export const FLOWS: readonly Flow[] = [propToPixel];

export function getFlow(id: string): Flow | undefined {
  return FLOWS.find((flow) => flow.id === id);
}
