// The four types that describe the map. Everything under src/data is plain
// data typed against these, and everything else in the app reads that data.
// Coordinates are grid cells: integer columns run along world x and integer
// rows run along world z. src/scene/layout.ts turns cells into world units.

/** A grid cell as [column, row]. Columns run along x, rows along z. */
export type Cell = readonly [column: number, row: number];

/** A named rectangle of cells, one per layer of the repo. */
export interface Neighborhood {
  id: string;
  name: string;
  description: string;
  /** The cell at the neighborhood's lowest column and row. */
  origin: Cell;
  /** Width in columns and depth in rows. */
  size: readonly [width: number, depth: number];
  /** CSS color for the plate and its label. */
  color: string;
}

/** A named cell inside a neighborhood, standing for a file or folder. */
export interface Module {
  id: string;
  name: string;
  neighborhood: string;
  cell: Cell;
  /** Repo-relative path to the file or folder this module stands for. */
  path: string;
  summary: string;
}

/** One hop of the payload, from one module to another. */
export interface Step {
  from: string;
  to: string;
  caption: string;
  /** Repo-relative files the step touches, listed in the panel as links. */
  files: readonly string[];
  /** Seconds for this hop. Falls back to the timeline default. */
  duration?: number;
}

/** A named story the payload plays through the map. */
export interface Flow {
  id: string;
  title: string;
  payload: { name: string; description: string };
  whatItDoes: readonly string[];
  howItsBuilt: readonly string[];
  steps: readonly Step[];
}
