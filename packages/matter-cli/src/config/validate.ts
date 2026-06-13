import type { MatterConfig } from './matterConfig.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validateMatterConfig(parsed: unknown, path: string): MatterConfig {
  if (!isRecord(parsed)) {
    throw new Error(`${path}: expected an object`);
  }
  const obj = parsed;

  if (typeof obj.componentsDir !== 'string' || obj.componentsDir === '') {
    throw new Error(`${path}: missing or empty "componentsDir" string`);
  }
  if (typeof obj.registryUrl !== 'string' || obj.registryUrl === '') {
    throw new Error(`${path}: missing or empty "registryUrl" string`);
  }
  if (!isRecord(obj.aliases)) {
    throw new Error(`${path}: missing "aliases" object`);
  }
  if (typeof obj.tsx !== 'boolean') {
    throw new Error(`${path}: missing "tsx" boolean`);
  }
  const aliases: Record<string, string> = {};

  for (const [aliasKey, aliasValue] of Object.entries(obj.aliases)) {
    if (typeof aliasValue !== 'string') {
      throw new Error(`${path}: aliases.${aliasKey} must be a string`);
    }
    aliases[aliasKey] = aliasValue;
  }

  return {
    componentsDir: obj.componentsDir,
    registryUrl: obj.registryUrl,
    aliases,
    tsx: obj.tsx,
  };
}
