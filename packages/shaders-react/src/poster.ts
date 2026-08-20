// @mattermix/shaders-react/poster — SSR-safe poster boundary.
//
// Deliberately shipped as its own entry point: the main barrel imports
// three/webgpu, which references `self` at module load and crashes SSR. This
// entry imports no three module at all, so a server-rendered page can put the
// poster in the initial HTML while the shader scene loads behind a dynamic
// import.
export { ShaderPoster } from './components/shader-poster/shader-poster.js';
export type { ShaderPosterProps } from './components/shader-poster/shader-poster.js';
