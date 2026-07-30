---
'@lovo/matter-react': patch
---

Fix animatable props doing nothing on a scene that has stopped rendering. `useAnimatableUniform` wrote the new value into its uniform but never told the frame scheduler to draw, so any component that had voted itself static — a gradient at `speed={0}`, say — would accept a prop change or a MotionValue tick and show none of it. On the docs SimplexNoise page this meant Scale, Contrast, Balance and Softness all went dead the moment speed reached 0. Every write now pokes the scheduler, which is a no-op unless the scene is genuinely idle.
