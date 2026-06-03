import type { MatterConfig } from './matterConfig.js'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

export function validateMatterConfig(parsed: unknown, path: string): MatterConfig {
  if (!isRecord(parsed)) {
    throw new Error(`${path}: expected an object`)
  }
  const obj = parsed

  if (typeof obj.componentsDir !== 'string' || obj.componentsDir === '') {
    throw new Error(`${path}: missing or empty "componentsDir" string`)
  }
  if (typeof obj.registryUrl !== 'string' || obj.registryUrl === '') {
    throw new Error(`${path}: missing or empty "registryUrl" string`)
  }
  if (!isRecord(obj.aliases)) {
    throw new Error(`${path}: missing "aliases" object`)
  }
  if (typeof obj.tsx !== 'boolean') {
    throw new Error(`${path}: missing "tsx" boolean`)
  }
  const aliases: Record<string, string> = {}

  for (const [k, v] of Object.entries(obj.aliases)) {
    if (typeof v !== 'string') {
      throw new Error(`${path}: aliases.${k} must be a string`)
    }
    aliases[k] = v
  }

  return {
    componentsDir: obj.componentsDir,
    registryUrl: obj.registryUrl,
    aliases,
    tsx: obj.tsx,
  }
}
