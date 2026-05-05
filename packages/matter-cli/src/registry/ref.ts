/**
 * Resolve which git ref the CLI should fetch from.
 *
 * - If `ref` is supplied, use it verbatim.
 * - If the CLI version is `0.0.0`, default to `main` (development build —
 *   no published v0.0.0 tag exists).
 * - Otherwise, default to `v<version>` (e.g. `0.1.0` → `v0.1.0`).
 *
 * This matches the shadcn pattern: the published CLI's default ref is the
 * version it was published at, so users aren't blindly tracking `main`.
 */
export function resolveRef(ref: string | undefined, cliVersion: string): string {
  if (ref !== undefined && ref !== '') return ref
  if (cliVersion === '0.0.0') return 'main'
  return `v${cliVersion}`
}
