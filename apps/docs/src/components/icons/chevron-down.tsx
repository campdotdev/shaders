/**
 * Pixel-style chevron from the Figma icon set (component "icons"). The path
 * is the export's data with its coordinates rounded to two decimals, which is
 * exact to a hundredth of a unit on the 16-unit grid and well below anything
 * visible. The fill is swapped for currentColor so the icon takes its color
 * from the surrounding text. Rotate it 180 degrees for the "up" state rather
 * than shipping a second glyph.
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
      <path d="M8.67 10.67H7.33V9.33H8.67V10.67ZM7.33 9.33H6V8H7.33V9.33ZM10 9.33H8.67V8H10V9.33ZM6 8H4.67V6.67H6V8ZM11.33 8H10V6.67H11.33V8ZM4.67 6.67H3.33V5.33H4.67V6.67ZM12.67 6.67H11.33V5.33H12.67V6.67Z" />
    </svg>
  );
}
