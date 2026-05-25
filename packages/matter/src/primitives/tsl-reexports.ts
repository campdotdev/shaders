// Pure pass-throughs of TSL primitives. To be removed in 0.2.0 (M9 Phase 9.4).
// Kept transiently so consumers can migrate before the engine drops them.

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
  uv,
  max,
  min,
} from 'three/tsl';
