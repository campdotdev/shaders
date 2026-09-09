/**
 * Pixel-style check from the Figma icon set (component "icons", name
 * "check"): a short and a long stroke of 2-unit pixels on a 24-unit grid,
 * which is the export's own grid. The path is the export's data on whole
 * units. The fill is swapped for currentColor so the icon takes its color
 * from the surrounding button, and it draws at 16px by default, the size
 * the header's copy button swaps it in at.
 */
import type { SVGProps } from 'react';

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="16"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M10 18H8V16H10V18ZM8 16H6V14H8V16ZM12 14V16H10V14H12ZM6 14H4V12H6V14ZM14 14H12V12H14V14ZM16 12H14V10H16V12ZM18 10H16V8H18V10ZM20 8H18V6H20V8Z" />
    </svg>
  );
}
