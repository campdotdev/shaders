// The Tier 1 components and the prop shapes they share. Each component folder
// holds a wrapper (props, uniforms, mesh lifecycle) and a shader.tsx (the TSL).
// Only the wrappers and their public types leave this barrel; the *Shader
// functions and DEFAULT_* constants are implementation detail.
export { Aurora } from './aurora/aurora.js';
export type { AuroraProps } from './aurora/aurora.js';

export { Blobs } from './blobs/blobs.js';
export type { BlobsProps } from './blobs/blobs.js';

export { ConicGradient } from './conic-gradient/conic-gradient.js';
export type { ConicGradientProps } from './conic-gradient/conic-gradient.js';

export { Dither } from './dither/dither.js';
export type { DitherProps } from './dither/dither.js';

export { Dissolve } from './dissolve/dissolve.js';
export type { DissolveProps } from './dissolve/dissolve.js';
export type { DissolveTuning } from './dissolve/shader.js';

export { DotField } from './dot-field/dot-field.js';
export type { DotFieldProps } from './dot-field/dot-field.js';

export { FractalNoise } from './fractal-noise/fractal-noise.js';
export type { FractalNoiseProps } from './fractal-noise/fractal-noise.js';
export type { FractalNoiseStyle } from './fractal-noise/shader.js';
export { STYLE_DIAL_DEFAULTS } from './fractal-noise/style-dial-defaults.js';

export { GodRays } from './god-rays/god-rays.js';
export type { GodRaysProps } from './god-rays/god-rays.js';

export { Grain } from './grain/grain.js';
export type { GrainProps } from './grain/grain.js';
export type { GrainBlend } from './grain/shader.js';

export { LedWall } from './led-wall/led-wall.js';
export type { LedWallProps } from './led-wall/led-wall.js';
export type { LedWallTuning } from './led-wall/shader.js';

export { LinearGradient } from './linear-gradient/linear-gradient.js';
export type { LinearGradientProps } from './linear-gradient/linear-gradient.js';

export { MeshGradient } from './mesh-gradient/mesh-gradient.js';
export type { MeshGradientProps } from './mesh-gradient/mesh-gradient.js';

export { RadialGradient } from './radial-gradient/radial-gradient.js';
export type { RadialGradientProps } from './radial-gradient/radial-gradient.js';

export { RadialWipe } from './radial-wipe/radial-wipe.js';
export type { RadialWipeProps } from './radial-wipe/radial-wipe.js';

export { SimplexNoise } from './simplex-noise/simplex-noise.js';
export type { SimplexNoiseProps } from './simplex-noise/simplex-noise.js';

export { Vignette } from './vignette/vignette.js';
export type { VignetteProps } from './vignette/vignette.js';

export { Voronoi } from './voronoi/voronoi.js';
export type { VoronoiProps } from './voronoi/voronoi.js';

export { WaveLines } from './wave-lines/wave-lines.js';
export type { WaveLine, WaveLinesProps } from './wave-lines/wave-lines.js';

export type { ColorStop, Palette } from './shared/color.js';
