---
'@camp-dev/shaders': minor
---

`LedWall` gains `variation` and `panelColor`. `variation` sets how unevenly the dots are lit: 0 lights every dot the same, and the default, 0.5, keeps each dot's fixed brightness between half and full, as before. `panelColor` is the color of a panel behind the dots. It fills the gaps, and a dim or flickering dot fades toward it. Left unset, the panel is transparent and the wall draws as before.
