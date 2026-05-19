import { vec3 } from 'three/tsl'

/**
 * Parse a CSS hex color string ('#rrggbb') into a [r, g, b] tuple with
 * components in the [0, 1] range. Use this when you need raw numbers for
 * a uniform / Vector3 / Color instance — i.e. for animatable color props
 * that need to update without rebuilding the material.
 *
 * Note on color space: this does NOT convert sRGB → linear. Matches the
 * registry convention; a proper `colorSpace` prop is backlogged.
 */
export const parseHex = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ]
}

/**
 * Parse a CSS hex color string ('#rrggbb') into a TSL `vec3` with components
 * in the [0, 1] range, ready to use as `material.colorNode` input or as part
 * of a TSL expression. Use this for static colors baked into the graph at
 * build time; use `parseHex` + a `Vector3` uniform for colors that need to
 * update reactively.
 */
export const color = (hex: string) => {
  const [r, g, b] = parseHex(hex)
  return vec3(r, g, b)
}
