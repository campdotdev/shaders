/**
 * The camp.dev mark from the Figma file (frame "tilted-open-vessel"): an
 * ivory vessel tipped on its side, open at the top, with a scalloped
 * red-brown base. The paths and gradients are the export's data with their
 * coordinates rounded to two decimals, which is exact to a hundredth of a
 * unit and well below anything visible. The mock draws the mark mirrored,
 * so the group flips it about its vertical center rather than the caller
 * applying a transform. The colors are the mark's own, not
 * currentColor, because it is a logo. The gradient ids are prefixed so they
 * cannot collide with another SVG's on the same page.
 */
import type { SVGProps } from 'react';

export function CampMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="36.43"
      viewBox="0 0 32 36.43"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="matrix(-1 0 0 1 32 0)">
        <path
          d="M0.29 13.39C-0.36 11.23 0.12 9.51 1.28 7.82C3.06 5.23 6.38 3.29 10.05 1.91C13.72 0.53 17.78 -0.21 20.59 0.05C22.57 0.18 24.04 0.66 25.25 1.91C26.29 2.99 26.93 4.28 27.37 5.79L31.51 18.23C32.07 19.78 32.16 21.04 31.55 22.37C30.99 23.63 30.04 24.45 28.66 25.09C27.37 25.7 26.67 26.56 26.11 27.77C25.68 28.72 25.51 29.58 25.38 30.75C25.21 32.52 24.65 34.16 23.61 35.24C22.7 36.15 21.75 36.49 20.59 36.41C19.38 36.36 18.43 35.8 17.65 34.85C16.74 33.73 16.14 32.95 15.15 32.56C14.33 32.17 13.63 32.13 12.68 32.3C11.09 32.61 9.96 32.78 8.63 32.3C7.07 31.79 6.16 30.84 5.47 29.33C5.04 28.33 4.83 27.12 4.39 25.91L0.29 13.39Z"
          fill="url(#camp-mark-body)"
        />
        <path
          d="M4.52 26.28C5.03 27.66 5.95 28.5 7.2 28.89C8.28 29.24 9.27 29.02 10.22 28.63C11.26 28.25 12.17 27.64 13.25 27.43C14.84 26.99 16.1 27.51 17.18 28.63C17.95 29.5 18.64 30.28 19.72 30.45C20.8 30.66 21.75 30.23 22.36 29.5C23.13 28.5 23.26 27.6 23.35 26.35C23.44 24.4 24.04 22.63 25.08 21.16C26.11 19.74 27.32 18.75 28.62 18.1C29.48 17.67 30.62 17.36 30.96 16.58L31.26 17.47L31.55 18.36C32.17 19.87 32.13 21.2 31.56 22.46C31.04 23.67 30.11 24.51 28.74 25.14C27.58 25.7 26.74 26.5 26.18 27.71C25.62 28.87 25.51 29.76 25.38 30.79C25.21 32.56 24.65 34.16 23.61 35.24C22.81 36.14 21.75 36.54 20.59 36.41C19.31 36.37 18.37 35.94 17.57 34.85C16.71 33.82 16.18 33 15.15 32.56C14.28 32.22 13.63 32.13 12.68 32.3C11.17 32.61 9.92 32.78 8.63 32.3C7.16 31.83 6.16 30.88 5.52 29.41C5.06 28.43 4.78 27.48 4.52 26.28Z"
          fill="url(#camp-mark-base)"
        />
        <path
          d="M2.49 8.6C2.75 7.43 4.09 6.14 5.9 4.89C7.8 3.64 10.05 2.6 12.38 1.78C14.93 0.92 17.43 0.48 19.64 0.48C21.67 0.48 23.18 0.87 23.87 1.74C24.69 2.81 24.04 4.11 22.92 5.28C21.49 6.74 19.33 7.91 16.83 8.9C14.11 9.98 11.26 10.67 8.67 10.98C6.21 11.23 4.18 11.02 3.18 10.41C2.45 9.98 2.28 9.42 2.49 8.6Z"
          fill="url(#camp-mark-recess)"
        />
      </g>
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="camp-mark-body"
          x1="1.11"
          x2="29.01"
          y1="12.14"
          y2="19.44"
        >
          <stop stopColor="#FEF6F2" />
          <stop offset="1" stopColor="#FDEDE4" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="camp-mark-base"
          x1="6.9"
          x2="30.3"
          y1="28.94"
          y2="25.27"
        >
          <stop stopColor="#741F11" />
          <stop offset="1" stopColor="#4A130B" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="camp-mark-recess"
          x1="9.36"
          x2="16.27"
          y1="1.17"
          y2="11.67"
        >
          <stop stopColor="#741F11" />
          <stop offset="1" stopColor="#4A130B" />
        </linearGradient>
      </defs>
    </svg>
  );
}
