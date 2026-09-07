---
'@camp-dev/shaders-cli': minor
---

`shaders-cli` keeps one command, `poster`. `init`, `add`, `list`, and `update` are gone, along with `shaders.config.json` and the registry they copied from: components now ship inside `@camp-dev/shaders`, so there is nothing to copy. Delete `shaders.config.json` if you have one and import components from the package. `poster` is unchanged.
