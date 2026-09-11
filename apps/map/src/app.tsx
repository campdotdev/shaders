// The page: a stage holding the canvas with the caption and transport bar
// laid over it, and a panel column on the right. This file only lays the
// regions out.
import { Panel } from '@/panel/panel';
import { MapCanvas } from '@/scene/map-canvas';
import { MapScene } from '@/scene/map-scene';
import { Caption } from '@/transport/caption';
import { TransportBar } from '@/transport/transport-bar';

export function App() {
  return (
    <div className="app">
      <div className="stage">
        <MapCanvas>
          <MapScene />
        </MapCanvas>
        <Caption />
        <TransportBar />
      </div>
      <Panel />
    </div>
  );
}
