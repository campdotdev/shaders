'use client';

/**
 * Every public Source and Effect, keyed by its export name. A composition
 * document names each stack entry's component as one of these keys, and
 * CompositionScene looks the component up here to draw it. Documents reach
 * this file only through `import type` (define.ts), because the components
 * pull in three/webgpu, which a server render or the docs' Node vitest can't
 * load. A test keeps the keys in step with COMPONENTS in content/components.ts.
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
