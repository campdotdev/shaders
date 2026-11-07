---
'@camp-dev/shaders': patch
---

A parked scene now redraws when an Effect mounts, unmounts, or re-registers on a prop change, such as Dither's `pattern` or Grain's `blend`. Before, the screen kept the old image until something else asked for a frame.
