/**
 * The Shaders logo mark from the Figma file (component "logo/mark"): five
 * lime bars stacked in a slight twist. The viewBox is the export's own
 * 24 by 25.83 box, so the mark keeps its proportions at any rendered size.
 * Coordinates are the export's data rounded to two decimals, which is exact
 * to a hundredth of a unit and well below anything visible. The fill is
 * currentColor so the link that wraps it decides the color.
 */
import type { SVGProps } from 'react';

export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="26"
      viewBox="0 0 24 25.83"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M7.37 14.73H22.99C21.71 12.56 19.34 11.1 16.63 11.1H1.01C2.29 13.27 4.66 14.73 7.37 14.73Z" />
      <path d="M0 7.37C0 8 0.08 8.6 0.23 9.19H14.51C14.66 8.61 14.73 8 14.73 7.37C14.73 6.74 14.66 6.13 14.51 5.55H0.23C0.08 6.13 0 6.74 0 7.37Z" />
      <path d="M24 18.46C24 17.83 23.92 17.23 23.77 16.64H9.49C9.34 17.23 9.27 17.83 9.27 18.46C9.27 19.09 9.35 19.7 9.49 20.28H23.77C23.92 19.7 24 19.09 24 18.46Z" />
      <path d="M16.59 25.83H16.63C19.25 25.83 21.66 24.45 22.99 22.19H10.28C11.55 24.36 13.9 25.82 16.59 25.83Z" />
      <path d="M7.4 0H7.37C4.75 0 2.34 1.38 1.01 3.64H13.72C12.45 1.47 10.1 0.01 7.4 0Z" />
    </svg>
  );
}
