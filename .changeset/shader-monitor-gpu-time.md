---
'@camp-dev/shaders': minor
---

`ShaderMonitor` shows the scene's GPU time per frame under its frame rate, averaged over the same half-second window. Mounting the monitor turns on GPU timing for its scene, and unmounting it turns the timing off. The readout shows a dash on the WebGL2 fallback, and on an adapter without timestamp queries. The time covers the scene pass and the output quad. Where the GPU runs the two passes at once, as Apple silicon does, the overlap counts once. A pass that a component draws on its own, such as `CursorRipple`'s wave field, is not counted.

`ShaderContextValue` gains `timeGpu`, which turns the timing on and returns the off switch. A hand-built context, such as a fake one in a test, needs the field too, and `() => () => undefined` reports nothing.
