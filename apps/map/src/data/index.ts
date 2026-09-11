// Lookup over the hand-authored data. The scene and panel import from here
// rather than from the data files, so the lookup tables are built once.
import { MODULES } from './modules';
import { NEIGHBORHOODS } from './neighborhoods';
import type { Module, Neighborhood } from './types';

const modulesById = new Map<string, Module>(MODULES.map((module) => [module.id, module]));
const neighborhoodsById = new Map<string, Neighborhood>(
  NEIGHBORHOODS.map((neighborhood) => [neighborhood.id, neighborhood]),
);

export { MODULES, NEIGHBORHOODS };

export function moduleById(id: string): Module | undefined {
  return modulesById.get(id);
}

export function neighborhoodById(id: string): Neighborhood | undefined {
  return neighborhoodsById.get(id);
}
