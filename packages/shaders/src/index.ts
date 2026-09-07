'use client';

// @camp-dev/shaders root entry. Everything React and everything TSL comes
// through here; the three server-safe subpaths (./color, ./gamut, ./poster)
// are the only other doors. The directive on line 1 marks this module as the
// client boundary: the docs site and the editor consume this file as source,
// not the built dist, so the directive has to live here rather than in a
// build banner. esbuild keeps it on the emitted entry chunk.
export * from './engine.js';
export * from './react/index.js';
export * from './components/index.js';
