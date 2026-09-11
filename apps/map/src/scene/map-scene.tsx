// Everything drawn from the data: one plate per neighborhood, one box per
// module, and the payload that hops between them.
import { MODULES, NEIGHBORHOODS } from '@/data';

import { ModuleBox } from './module-box';
import { NeighborhoodPlate } from './neighborhood-plate';
import { Payload } from './payload';

export function MapScene() {
  return (
    <>
      {NEIGHBORHOODS.map((neighborhood) => (
        <NeighborhoodPlate key={neighborhood.id} neighborhood={neighborhood} />
      ))}
      {MODULES.map((module) => (
        <ModuleBox key={module.id} module={module} />
      ))}
      <Payload />
    </>
  );
}
