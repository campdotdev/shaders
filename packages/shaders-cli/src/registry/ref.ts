/**
 * Which git ref the registry is fetched at. An explicit --reference wins;
 * otherwise the CLI pins to its own version tag (v1.2.3), so the code you
 * copy always matches the CLI you installed. The 0.0.0 dev build has no tag
 * and tracks main.
 */
export function resolveRef(ref: string | undefined, cliVersion: string): string {
  if (ref !== undefined && ref !== '') return ref;
  if (cliVersion === '0.0.0') return 'main';

  return `v${cliVersion}`;
}
