'use client';

/**
 * Every public Source and Effect, keyed by export name, which CompositionScene
 * draws each stack entry's component from. Documents reach it only through
 * `import type` (define.ts), because it loads three/webgpu. A test keeps its
 * keys in step with COMPONENTS in content/components.ts.
 */
import {
  Aurora,
  Blobs,
  ConicGradient,
  CursorRipple,
  CursorSmudge,
  CursorSpotlight,
  Dissolve,
  Dither,
  DotField,
  FlutedGlass,
  FractalNoise,
  GodRays,
  Grain,
  LedWall,
  LinearGradient,
  LiquidGradient,
  MeshGradient,
  RadialGradient,
  RadialWipe,
  SimplexNoise,
  Vignette,
  Voronoi,
  WaveLines,
} from '@camp-dev/shaders';

export const COMPONENT_MAP = {
  Aurora,
  Blobs,
  ConicGradient,
  CursorRipple,
  CursorSmudge,
  CursorSpotlight,
  Dissolve,
  Dither,
  DotField,
  FlutedGlass,
  FractalNoise,
  GodRays,
  Grain,
  LedWall,
  LinearGradient,
  LiquidGradient,
  MeshGradient,
  RadialGradient,
  RadialWipe,
  SimplexNoise,
  Vignette,
  Voronoi,
  WaveLines,
};
