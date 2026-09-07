'use client';

// @camp-dev/shaders/poster — SSR-safe poster boundary.
//
// Deliberately shipped as its own entry point: the main barrel imports
// three/webgpu, which references `self` at module load and crashes SSR. This
// entry imports no three module at all, so a server-rendered page can put the
// poster in the initial HTML while the shader scene loads behind a dynamic
// import. The directive on line 1 marks the client boundary for consumers
// that read this file as source.
export { ShaderPoster } from './react/components/shader-poster/shader-poster.js';
export type { ShaderPosterProps } from './react/components/shader-poster/shader-poster.js';
