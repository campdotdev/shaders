---
'@mattermix/shaders': minor
'@mattermix/shaders-react': minor
'@mattermix/shaders-cli': minor
---

The three packages are renamed. `@lovo/matter` is now `@mattermix/shaders`, `@lovo/matter-react` is now `@mattermix/shaders-react`, and `@lovo/matter-cli` is now `@mattermix/shaders-cli`. The repository moved to github.com/mattermix/shaders. Update your dependency names and every import specifier. Apart from the removals below, the exports themselves are unchanged.

The CLI binary is renamed from `matter-cli` to `shaders-cli`, and its config file from `matter.config.json` to `shaders.config.json`. Rename the file and update any script that calls the old binary. Two defaults that `shaders-cli init` writes also change: `componentsDir` goes from `src/components/matter` to `src/components/shaders`, and `registryUrl` now points at `mattermix/shaders` instead of `lovo-hq/matter`. A config you already have keeps the values it records, so edit its `registryUrl` by hand or re-run `init` with `--force`.

`MatterError` and `MatterErrorCode` in `@mattermix/shaders-react` are now `ShadersError` and `ShadersErrorCode`. A `catch` block that tests `instanceof MatterError` has to switch to the new name.

The READMEs drop their migration notes for the `Matter*` aliases that 0.4.0 deprecated, such as `MatterScene` and `MatterScheduler`. The aliases themselves left the source several releases ago.
