---
'@lovo/matter-react': minor
---

Adds `@lovo/matter-react/gamut`, a second entry point carrying `useDisplayGamut` with no path to three. The root entry re-exports `ShaderScene`, which imports `three/webgpu`, and that reads `self` at module load, so a server-rendered page that only wanted to know whether the display can show P3 had to load the renderer to ask. The hook itself never needed it.

Same idea as `@lovo/matter/color`, and this package already shipped `./poster` on the same reasoning. Both subpaths now have a test that imports them under a bare Node environment, so three creeping back into either one fails there rather than in someone's server render.
