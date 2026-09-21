# The cursor ripple's water simulation is a fragment-shader ping-pong, not a compute shader

CursorRipple (SHA-138) simulates a water surface as a height field that persists between frames. WebGPU offers a compute shader for this, which is the natural tool for a simulation, but the runtime falls back to WebGL2 whenever WebGPU device init fails, and that is the path headless Chromium takes, so every Playwright visual test and every CI run executes it. WebGL2 has no compute. We run the simulation as a full-screen fragment pass that reads the previous frame's height-and-velocity texture and writes the next one into a second render target, swapping the two each frame. The math is the same on both backends, and for a quarter-resolution 2D field the cost difference is not measurable.

## Consequences

- The field lives in a framework-free runtime module next to the output stage, built on render targets with half-float textures. It is the first feedback loop in the codebase.
- The WebGL2 path needs the float-render-target extension. Where it or the device is missing, CursorRipple renders as identity rather than throwing or substituting a different effect.
- A compute path can be added later behind a backend check if a heavier simulation ever needs it, without changing the Effect's public props.
