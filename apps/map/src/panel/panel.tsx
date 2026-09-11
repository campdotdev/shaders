// The right-hand column. For now it shows what the pointer is over. Task 9
// adds the flow's title, tabs, and step list below the header.
import { moduleById, neighborhoodById } from '@/data';
import { useHovered } from '@/hover/store';

export function Panel() {
  const hovered = useHovered();
  const hoveredNeighborhood =
    hovered?.kind === 'neighborhood' ? neighborhoodById(hovered.id) : undefined;
  const hoveredModule = hovered?.kind === 'module' ? moduleById(hovered.id) : undefined;

  return (
    <aside className="panel">
      <header className="panel-header">
        {hoveredNeighborhood !== undefined && (
          <>
            <h1 style={{ color: hoveredNeighborhood.color }}>{hoveredNeighborhood.name}</h1>
            <p>{hoveredNeighborhood.description}</p>
          </>
        )}
        {hoveredModule !== undefined && (
          <>
            <h1>{hoveredModule.name}</h1>
            <p>{hoveredModule.summary}</p>
            <code>{hoveredModule.path}</code>
          </>
        )}
        {hovered === null && <p className="muted">Hover a district or a module.</p>}
      </header>
    </aside>
  );
}
