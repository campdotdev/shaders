---
'@lovo/matter-react': patch
---

Reset the CPU-side phase accumulators at the scene's first painted frame, alongside the existing renderer-clock rewind. The accumulators integrate wall-clock deltas from mount, so the renderer's init latency used to carry into the first visible pose. A poster captured at t=0 never quite matched the frame that replaced it, and the slower the device, the bigger the jump. Sharp-geometry shaders made the drift obvious; now the first frame anyone sees is genuinely t=0.
