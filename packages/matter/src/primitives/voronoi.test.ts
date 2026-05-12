import { describe, it, expect } from 'vite-plus/test'
import { uv } from 'three/tsl'
import { voronoi } from './voronoi.js'

describe('voronoi', () => {
  it('returns a TSL node when sampled at uv()', () => {
    expect(voronoi(uv())).toBeDefined()
  })
})
