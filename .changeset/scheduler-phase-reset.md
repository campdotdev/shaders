---
'@lovo/matter': minor
'@lovo/matter-react': patch
---

Add a phase-reset channel to `FrameScheduler`: accumulators register a listener with `onPhaseReset()`, and `resetPhases()` rewinds them all to zero. Accumulated phase is wall-clock history, so a harness that needs a reproducible frame (like the docs visual tests) has to rewind it together with the renderer clock. `useAnimatableSpeed` registers its phase uniform on the channel, which is what keeps a quantized shader like grain rendering the same seed on every machine.
