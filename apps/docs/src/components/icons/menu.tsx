/**
 * Pixel-style hamburger from the Figma icon set (component "icons"): three
 * 2-unit bars on the 24-unit grid the site header draws its icons at. The
 * path is the export's data, already on whole units, with the fill swapped
 * for currentColor so the button that wraps it decides the color.
 */
import type { SVGProps } from 'react';

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M20 18H4V16H20V18ZM20 13H4V11H20V13ZM20 8H4V6H20V8Z" />
    </svg>
  );
}
