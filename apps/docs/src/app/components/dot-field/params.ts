export interface Params {
  color: string;
  spacing: number;
  dotSize: number;
  reach: number;
  strength: number;
  interactive: boolean;
}

export const INITIAL: Params = {
  color: 'oklch(0.65 0.01 150)',
  spacing: 30,
  dotSize: 2,
  reach: 100,
  strength: 1,
  interactive: true,
};
