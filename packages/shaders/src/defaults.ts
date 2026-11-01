// @camp-dev/shaders/defaults — component defaults that UI code reads without
// the renderer, published as their own entry point. A controls panel that
// shows a default needs the number, not the shader, and the root barrel
// reaches three/webgpu, which reads `self` at module load. Nothing here
// imports three, so a server render or a Node test can load it.
// defaults.test.ts proves that. The root barrel re-exports the same values.
//
// Each export comes straight from its leaf module, never through
// ./components/index.js, which re-exports the components themselves and
// would bring three back.

export type { FractalNoiseStyle } from './components/fractal-noise/shader.js';
export { STYLE_DIAL_DEFAULTS } from './components/fractal-noise/style-dial-defaults.js';
