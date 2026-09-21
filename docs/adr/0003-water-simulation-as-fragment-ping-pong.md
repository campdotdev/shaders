# The planned cursor ripple water simulation uses fragment-shader ping-pong, not a compute shader

Status: Planned under SHA-138. Neither the simulation runtime nor the CursorRipple Effect is implemented.

CursorRipple will simulate a water surface as a height field that persists between frames. WebGPU offers a compute shader for this, but the renderer falls back to WebGL2 when WebGPU device initialization fails. Headless Chromium takes that fallback path, so every Playwright visual test and CI run must support WebGL2. Because WebGL2 has no compute, the simulation will use a full-screen fragment pass. The pass will read the previous frame's height-and-velocity texture, write the next state to a second render target, and swap the targets after each frame. Both backends will use the same math. SHA-138 must measure the cost of the quarter-resolution 2D field during implementation.

## Planned consequences

- The field will live in a framework-free runtime module next to the output stage. It will use render targets with half-float textures and become the first feedback loop in the codebase.
- The WebGL2 path will need the float-render-target extension. If the extension or graphics device is unavailable, CursorRipple will render as identity rather than throw or substitute a different effect.
- A compute path can be added later behind a backend check if a heavier simulation ever needs it, without changing the Effect's public props.
