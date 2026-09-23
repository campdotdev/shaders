---
'@camp-dev/shaders': minor
---

Add `CursorRipple`, a water surface over any scene. Drag the pointer across the canvas and it leaves a wake that spreads, catches light, and settles. Mount it inside a `ShaderScene` after the components it should act on. It takes four props, each a static value or an animation signal: `refraction` bends the image beneath, `shine` lights the flanks facing a fixed upper-left light, `radius` sets the wake's width, and `decay` sets how fast the water calms. The ripple is invisible until the first pointer move, and the scene can idle once the water settles. It works in Mode 1 only, and its refraction bends the image the Sources drew, not an Effect mounted before it. Where the renderer cannot draw to a half-float target, it renders as identity and warns once in development.

`CursorRippleShader`, the ripple's GPU half, is exported so a caller can render it over a wave field it drives itself. The wave field gains `tune()`, which changes its brush radius and its height and velocity damping while it runs, and `dampingForLifetime()`, which converts a ring's lifetime in seconds into a per-substep damping. A switch to the paused reduced-motion policy now flattens a moving field and reports it at rest, instead of freezing the water on screen.
