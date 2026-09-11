// Everything drawn from the data: one plate per neighborhood and one box per
// module. The payload joins in Task 7.
import { MODULES, NEIGHBORHOODS } from '@/data';

import { ModuleBox } from './module-box';
import { NeighborhoodPlate } from './neighborhood-plate';

export function MapScene() {
  return (
    <>
      {NEIGHBORHOODS.map((neighborhood) => (
        <NeighborhoodPlate key={neighborhood.id} neighborhood={neighborhood} />
      ))}
      {MODULES.map((module) => (
        <ModuleBox key={module.id} module={module} />
      ))}
    </>
  );
}
