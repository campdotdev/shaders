---
'@camp-dev/shaders': patch
---

Fix DotField marks on tight grids drawing a different pixel pattern at every grid point. The anti-aliasing band across a mark's edge is now measured in device pixels rather than as a fraction of the cell, so a 2px mark on a 6px grid gets the same soft rim a 3px dot on a 30px grid always had.
