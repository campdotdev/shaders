---
'@lovo/matter-cli': minor
---

Rename ambiguous CLI flags and the config key to spelled-out names (BREAKING, pre-1.0):

- `list`/`add`/`update`: `--ref` → `--reference`
- `poster`: `--from` → `--source`, `--out` → `--output`, `--type` → `--format`, `--export` → `--export-name`, `--time` → `--capture-delay`
- `matter.config.json`: the `tsx` boolean key → `useTypeScript`

Kept: `--registry`, `--quality`, `--width`, `--height`, `--force`, and the config keys `componentsDir`, `registryUrl`, `aliases`.

Migration: update any scripts that pass the old flags, and rename `"tsx"` to `"useTypeScript"` in your `matter.config.json`. Re-running `matter-cli init` regenerates a config with the new key.
