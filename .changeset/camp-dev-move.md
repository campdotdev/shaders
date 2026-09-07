---
'@camp-dev/shaders': minor
'@camp-dev/shaders-cli': minor
---

The packages move to the `@camp-dev` scope. `@lovo/matter` is now `@camp-dev/shaders`, `@lovo/matter-cli` is now `@camp-dev/shaders-cli`, and `@lovo/matter-react` is folded into `@camp-dev/shaders`, which now exports everything it did. The repository moved to github.com/campdotdev/shaders. Update your dependency names and every import specifier. Apart from the removals below, the exports themselves are unchanged.

The CLI binary is renamed from `matter-cli` to `shaders-cli`. Update any script that calls the old binary.

`MatterError` and `MatterErrorCode` in `@camp-dev/shaders` are now `ShadersError` and `ShadersErrorCode`. A `catch` block that tests `instanceof MatterError` has to switch to the new name.

The READMEs drop their migration notes for the `Matter*` aliases that 0.4.0 deprecated, such as `MatterScene` and `MatterScheduler`. The aliases themselves left the source several releases ago.
