export interface PaletteMapParams {
  colors: string[];
  pixelSize: number;
  spread: number;
}

export const MIN_COLORS = 2;
export const MAX_COLORS = 8;

// Keep in sync with the PaletteMap defaults.
export const INITIAL: PaletteMapParams = {
  colors: [
    'oklch(0.25 0.06 280)',
    'oklch(0.45 0.16 320)',
    'oklch(0.68 0.18 40)',
    'oklch(0.90 0.12 90)',
  ],
  pixelSize: 2,
  spread: 0.5,
};
