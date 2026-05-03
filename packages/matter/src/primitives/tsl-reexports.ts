// Stable surface for TSL primitives matter consumers reach for constantly.
// Re-exporting through @lovo/matter means user code has one import path
// and we can absorb three.js TSL renames without breaking downstream code.

export {
  uniform,
  vec2,
  vec3,
  vec4,
  mix,
  smoothstep,
  mod,
  sin,
  cos,
  length,
  dot,
  normalize,
  time,
  uv,
} from 'three/tsl'
