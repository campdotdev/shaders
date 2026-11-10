/**
 * Pixel-style filled triangle pointing down, from the Figma icon set
 * (component "icons"). It is the open state of a collapsible list row, whose
 * closed state is `CaretRightIcon`. The viewBox is the 24-unit grid the export
 * uses, drawn at 16px. The fill is swapped for currentColor so the icon takes
 * its color from the surrounding text.
 */
import type { SVGProps } from 'react';

export function CaretDownIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M17 9V11H15V13H13V15H11V13H9V11H7V9H17Z" />
    </svg>
  );
}
