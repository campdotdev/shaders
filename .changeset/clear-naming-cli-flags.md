---
'@lovo/matter-cli': minor
---

Rename ambiguous CLI flags and the config key to spelled-out names (BREAKING, pre-1.0):

- `list`/`add`/`update`: `--ref` → `--reference`
- `poster`: `--from` → `--source`, `--out` → `--output`, `--type` → `--format`, `--export` → `--export-name`, `--time` → `--capture-delay`
- `matter.config.json`: removed the `tsx` boolean key (it was validated but never read by any command)

Kept: `--registry`, `--quality`, `--width`, `--height`, `--force`, and the config keys `componentsDir`, `registryUrl`, `aliases`.

Migration: update any scripts that pass the old flags. You can delete the `tsx` key from your `matter.config.json` if present — it is no longer used (unknown keys are ignored). Re-running `matter-cli init` regenerates a config without it.
