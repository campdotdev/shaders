import { palette } from '../../../lib/palette';

export interface Params {
  color: string;
  spacing: number;
  dotSize: number;
  reach: number;
  strength: number;
  interactive: boolean;
}

export const INITIAL: Params = {
  color: palette.gray[8],
  spacing: 30,
  dotSize: 2,
  reach: 100,
  strength: 1,
  interactive: true,
};
