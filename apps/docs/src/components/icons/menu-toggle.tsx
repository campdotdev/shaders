/**
 * The hamburger that folds into an X: the Figma Motion export reduced to
 * positions and deltas. 24 squares of 2 by 2 on the 24-unit grid, three
 * rows of eight, which at rest are the three bars of the icon set's
 * pixel-style hamburger. Each square carries how far it travels to its cell
 * in the X as --dx and --dy, in user units, and data-menu-square names its
 * row's timing: "snap" for the middle row, "fold" for the outer two. The
 * motion itself lives in site-nav.module.css, on the trigger's
 * data-popup-open. The end state is the icon set's X: the 24 squares land on
 * its 13 cells, twelve of them stacked on the centre cell and the other
 * twelve one to a cell.
 */
import type { CSSProperties, SVGProps } from 'react';

// Rows at y 6, 11, 16 and columns at x = 4 + 2i, the hamburger. Each delta
// is [dx, dy], the export's end position less that rest position, one per
// column from the left.
const ROWS = [
  {
    y: 6,
    timing: 'fold',
    deltas: [
      [1, -1],
      [1, 1],
      [1, 3],
      [1, 5],
      [-1, 5],
      [-1, 3],
      [-1, 1],
      [-1, -1],
    ],
  },
  {
    y: 11,
    timing: 'snap',
    deltas: [
      [7, 0],
      [5, 0],
      [3, 0],
      [1, 0],
      [-1, 0],
      [-3, 0],
      [-5, 0],
      [-7, 0],
    ],
  },
  {
    y: 16,
    timing: 'fold',
    deltas: [
      [1, 1],
      [1, -1],
      [1, -3],
      [1, -5],
      [-1, -5],
      [-1, -3],
      [-1, -1],
      [-1, 1],
    ],
  },
] as const;

// React's CSSProperties has no slot for custom properties, so the two the
// stylesheet reads are declared alongside it.
type SquareStyle = CSSProperties & { '--dx': number; '--dy': number };

export function MenuToggleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {ROWS.map((row) =>
        row.deltas.map(([dx, dy], i) => {
          const style: SquareStyle = { '--dx': dx, '--dy': dy };

          return (
            <rect
              data-menu-square={row.timing}
              height="2"
              key={`${row.y}-${i}`}
              style={style}
              width="2"
              x={4 + 2 * i}
              y={row.y}
            />
          );
        }),
      )}
    </svg>
  );
}
