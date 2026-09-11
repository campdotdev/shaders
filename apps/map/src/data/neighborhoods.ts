// The nine neighborhoods, one per layer the dependency rule already separates.
// Positions are hand-placed: the engine's three districts sit in the middle
// row because the prop-to-pixel flow walks through them, and the tools sit
// in the back row. Change a rectangle here and every plate and label follows.
import type { Neighborhood } from './types';

export const NEIGHBORHOODS = [
  {
    id: 'components',
    name: 'Components',
    description: 'Tier 1 wrappers: props, uniforms, and the mesh lifecycle.',
    origin: [0, 0],
    size: [6, 3],
    color: '#7c9cf5',
  },
  {
    id: 'react',
    name: 'React binding',
    description: 'ShaderScene, useShaderMaterial, and the hooks that drive uniforms.',
    origin: [7, 0],
    size: [5, 3],
    color: '#5fc7c2',
  },
  {
    id: 'docs',
    name: 'Docs site',
    description: 'The Next.js docs app and its Playwright suite.',
    origin: [13, 0],
    size: [5, 3],
    color: '#c78bf5',
  },
  {
    id: 'primitives',
    name: 'Primitives',
    description: 'Tier 2 TSL building blocks: noise, ramps, dither, voronoi.',
    origin: [0, 4],
    size: [6, 3],
    color: '#f5a35f',
  },
  {
    id: 'runtime',
    name: 'Runtime',
    description: 'The renderer, the frame scheduler, the clock, and the visibility gates.',
    origin: [7, 4],
    size: [5, 3],
    color: '#f5d35f',
  },
  {
    id: 'inputs',
    name: 'Inputs',
    description: 'Pointer tracking that feeds cursor-driven props.',
    origin: [13, 4],
    size: [3, 3],
    color: '#f57c9c',
  },
  {
    id: 'color',
    name: 'Color',
    description: 'CPU color math and gamut detection, importable without three.',
    origin: [0, 8],
    size: [3, 3],
    color: '#8bd66b',
  },
  {
    id: 'cli',
    name: 'CLI',
    description: 'The poster command: one frame rendered to an image file.',
    origin: [4, 8],
    size: [3, 3],
    color: '#9aa3b5',
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'The node editor: registry, graph model, live compiler, and emitter.',
    origin: [8, 8],
    size: [6, 3],
    color: '#6bb8f5',
  },
] as const satisfies readonly Neighborhood[];
