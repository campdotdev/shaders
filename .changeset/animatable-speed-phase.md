---
'@lovo/matter-react': minor
---

Add `useAnimatableSpeed`, which turns a `speed` prop into a phase uniform accumulated on the CPU (`phase += speed * min(delta, 0.1)` each frame; the cap keeps the first frame after a hidden tab from replaying the whole gap). The shaders previously computed motion as elapsed time multiplied by speed, so any speed change (a slider drag or an animation signal) re-evaluated the whole elapsed history at the new rate and snapped the pattern; after 15 seconds on screen, the smallest slider step moved the canvas 41x more than a frame of steady motion. All eight animated registry components now read the accumulated phase instead. The reduced-motion time scale is applied inside the accumulator, so a mid-session `prefers-reduced-motion` change also shifts tempo smoothly instead of jumping.
