# The cursor ripple water simulation uses fragment-shader ping-pong, not a compute shader

Status: Accepted. The simulation runtime shipped under SHA-157 and the CursorRipple Effect under SHA-161.

CursorRipple simulates a water surface as a height field that persists between frames. WebGPU offers a compute shader for this, but the renderer falls back to WebGL2 when WebGPU device initialization fails. Headless Chromium takes that fallback path, so every Playwright visual test and CI run must support WebGL2. Because WebGL2 has no compute, the simulation uses a full-screen fragment pass. The pass reads the previous frame's height-and-velocity texture, writes the next state to a second render target, and swaps the targets after each pass. Both backends use the same math.

## Consequences

- The field lives in a framework-free runtime module next to the output stage, `src/runtime/wave-field`. It uses render targets with half-float textures and is the first feedback loop in the codebase.
- The WebGL2 path needs the float-render-target extension. If the extension or graphics device is unavailable, CursorRipple renders as identity rather than throw or substitute a different effect.
- A compute path can be added later behind a backend check if a heavier simulation ever needs it, without changing the Effect's public props.
