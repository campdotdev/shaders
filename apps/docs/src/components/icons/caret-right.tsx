/**
 * Pixel-style filled triangle pointing right, from the Figma icon set
 * (component "icons"). The mock draws it as the breadcrumb separator at
 * 20px, so the viewBox is the 20-unit grid the export uses, unlike the
 * 16-unit chevron. The path is the export's data with its coordinates
 * rounded to two decimals, which is exact to a hundredth of a unit and well
 * below anything visible. The fill is swapped for currentColor so the icon
 * takes its color from the surrounding text.
 */
import type { SVGProps } from 'react';

export function CaretRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="20"
      viewBox="0 0 20 20"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M7.5 14.17H9.17V12.5H10.83V10.83H12.5V9.17H10.83V7.5H9.17V5.83H7.5V14.17Z" />
    </svg>
  );
}
