---
'@lovo/matter-cli': patch
---

Fix `matter add` installing components that don't compile. Every component is split across a wrapper and a shader, and all but `grain` also import helpers from `utils/color.ts`, but a registry entry only ever named one file — so `matter add radial-gradient` wrote a wrapper importing `./shader` and `../utils/color` and left both behind. Every component has been broken this way since the first one shipped. Registry entries now carry a `files` list covering the whole set, and `add` writes all of it. A file already on disk holding exactly what would be written is skipped rather than treated as a conflict, so adding a second component that shares `utils/color.ts` no longer fails on a file the CLI wrote itself; one that has diverged still stops the install and asks for `--force`.
