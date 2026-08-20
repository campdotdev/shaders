// @mattermix/shaders-react/gamut — display-gamut detection, SSR-safe.
//
// Deliberately shipped as its own entry point, for the same reason as
// ./poster: the main barrel re-exports ShaderScene, which imports
// three/webgpu, which reads `self` at module load and crashes SSR. This hook
// needs none of that — it asks matchMedia what the display can show — so a
// server-rendered page can call it without pulling the renderer in behind it.
//
// The import below reaches the hook's own module rather than ./hooks/index.js
// on purpose. That barrel also carries useShaderMaterial and
// useAnimatableUniform, both of which import three, so routing through it
// would quietly undo the split. gamut.test.ts is what catches it if someone
// does.
export { useDisplayGamut } from './hooks/use-display-gamut/use-display-gamut.js';
export type { GamutPreference } from './hooks/use-display-gamut/use-display-gamut.js';
