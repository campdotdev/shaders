/**
 * Pixel-style GitHub glyph from the Figma icon set (component "icons"), on
 * the same 24-unit grid the site header draws it at. The path is the
 * export's data, which is already on whole units. The fill is swapped for
 * currentColor so the icon takes its color from the surrounding link.
 */
import type { SVGProps } from 'react';

export function GitHubIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M5 2H9V4H7V6H5V2ZM5 12H3V6H5V12ZM7 14H5V12H7V14ZM9 16V14H7V16H3V14H1V16H3V18H7V22H9V18H11V16H9ZM9 16V18H7V16H9ZM15 4V6H9V4H15ZM19 6H17V4H15V2H19V6ZM19 12V6H21V12H19ZM17 14V12H19V14H17ZM15 16V14H17V16H15ZM15 18H13V16H15V18ZM15 18H17V22H15V18Z" />
    </svg>
  );
}
