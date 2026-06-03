export function resolveRef(ref: string | undefined, cliVersion: string): string {
  if (ref !== undefined && ref !== '') return ref
  if (cliVersion === '0.0.0') return 'main'

  return `v${cliVersion}`
}
