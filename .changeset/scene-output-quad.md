---
'@camp-dev/shaders': patch
---

Fix two ShaderScenes on one page drawing each other's output. three 0.170's PostProcessing shares a single full-screen quad and material across every instance, so whichever scene updated last was what every canvas drew. Each scene now owns its output quad and material.
