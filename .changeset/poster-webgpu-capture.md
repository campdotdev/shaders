---
'@lovo/matter-cli': patch
---

Capture posters on the WebGPU backend. Headless Chromium silently fell back to WebGL2, and hash-driven shaders lay out differently per backend, so posters for components like Voronoi and Blobs never matched what the live shader shows. The poster command now launches Chromium with WebGPU enabled (ANGLE Metal on macOS), falling back to WebGL2 only where WebGPU genuinely can't initialize.
