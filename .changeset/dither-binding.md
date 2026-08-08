---
'@lovo/matter-react': minor
---

Add useBasePassUv: post-process overlays can register a transform that changes where the scene texture is sampled. Color passes only see each pixel's finished color, so an effect that needs to resample the scene (like Dither's pixelation, which snaps the sample coordinate to a cell grid) had no way to work. UV transforms compose in mount order, same as usePostProcessPass, and scenes with none registered render exactly as before.
