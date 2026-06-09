import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { validateMatterConfig } from './validate.js';

export interface MatterConfig {
  componentsDir: string;
  registryUrl: string;
  aliases: Record<string, string>;
  tsx: boolean;
}

export const DEFAULT_MATTER_CONFIG: MatterConfig = {
  componentsDir: 'src/components/matter',
  registryUrl: 'https://raw.githubusercontent.com/lovo-hq/matter/${ref}/registry',
  aliases: { '@/': 'src/' },
  tsx: true,
};

const CONFIG_FILENAME = 'matter.config.json';

export function configPath(projectRoot: string): string {
  return join(projectRoot, CONFIG_FILENAME);
}

export async function configExists(projectRoot: string): Promise<boolean> {
  try {
    await access(configPath(projectRoot));

    return true;
  } catch {
    return false;
  }
}

export async function readMatterConfig(projectRoot: string): Promise<MatterConfig> {
  const path = configPath(projectRoot);
  let raw: string;

  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      throw new Error(
        `matter.config.json not found in ${projectRoot}. Run \`matter-cli init\` first.`,
      );
    }
    throw err;
  }
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return validateMatterConfig(parsed, path);
}

export function resolveRegistryUrl(
  cfg: MatterConfig,
  opts: { registry?: string; ref: string },
): string {
  const baseUrl = opts.registry ?? cfg.registryUrl;

  return baseUrl.replace('${ref}', opts.ref);
}

export async function writeMatterConfig(projectRoot: string, cfg: MatterConfig): Promise<void> {
  const path = configPath(projectRoot);
  const json = `${JSON.stringify(cfg, null, 2)}\n`;

  await writeFile(path, json, 'utf-8');
}
