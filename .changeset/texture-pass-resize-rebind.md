---
'@camp-dev/shaders': patch
---

On WebGPU, resizing a canvas that holds a smudge from `CursorSmudge` no longer logs three's `Bindings._update: binding should be available` error. `createTexturePass` now marks its texture for update when a resize changes the texture's size. A shader that samples the texture before the next draw into it then binds the new allocation.
