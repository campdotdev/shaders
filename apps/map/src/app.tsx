// The page: a stage holding the canvas on the left and a panel column on the
// right. Later tasks add the caption and transport bar over the stage and the
// panel's content. This file only lays the regions out.
import { MapCanvas } from '@/scene/map-canvas';
import { MapScene } from '@/scene/map-scene';

export function App() {
  return (
    <div className="app">
      <div className="stage">
        <MapCanvas>
          <MapScene />
        </MapCanvas>
      </div>
      <aside className="panel" />
    </div>
  );
}
