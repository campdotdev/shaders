---
'@camp-dev/shaders': minor
---

`@camp-dev/shaders/defaults` exports `STYLE_DIAL_DEFAULTS`, FractalNoise's contrast and balance for each style, without loading three. Import it from there where the root entry can't load, such as in a server render or a Node test.
