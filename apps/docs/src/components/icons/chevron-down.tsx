/**
 * Pixel-style chevron from the Figma icon set (component "icons"). The path
 * is the export's data verbatim; only the fill is swapped for currentColor so
 * the icon takes its color from the surrounding text. Rotate it 180 degrees
 * for the "up" state rather than shipping a second glyph.
 */
import type { SVGProps } from 'react';

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M8.66667 10.6667H7.33333V9.33333H8.66667V10.6667ZM7.33333 9.33333H6V8H7.33333V9.33333ZM10 9.33333H8.66667V8H10V9.33333ZM6 8H4.66667V6.66667H6V8ZM11.3333 8H10V6.66667H11.3333V8ZM4.66667 6.66667H3.33333V5.33333H4.66667V6.66667ZM12.6667 6.66667H11.3333V5.33333H12.6667V6.66667Z" />
    </svg>
  );
}
