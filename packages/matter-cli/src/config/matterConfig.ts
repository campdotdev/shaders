// matter.config.json: the one file the CLI reads from a user's project.
// Where copied components land (componentsDir), where they come from
// (registryUrl — a template whose ${ref} slot is filled with a git tag,
// branch, or commit at fetch time), and how import specifiers get rewritten
// (aliases). This module owns the schema, defaults, read/write, and the
// ${ref} substitution.
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { validateMatterConfig } from './validate.js';

export interface MatterConfig {
  componentsDir: string;
  registryUrl: string;
  aliases: Record<string, string>;
}

export const DEFAULT_MATTER_CONFIG: MatterConfig = {
  componentsDir: 'src/components/matter',
  registryUrl: 'https://raw.githubusercontent.com/lovo-hq/matter/${ref}/registry',
  aliases: { '@/': 'src/' },
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
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT') {
      throw new Error(
        `matter.config.json not found in ${projectRoot}. Run \`matter-cli init\` first.`,
      );
    }
    throw caughtError;
  }
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (caughtError) {
    throw new Error(
      `${path} is not valid JSON: ${caughtError instanceof Error ? caughtError.message : String(caughtError)}`,
    );
  }

  return validateMatterConfig(parsed, path);
}

export function resolveRegistryUrl(
  matterConfig: MatterConfig,
  opts: { registry?: string; ref: string },
): string {
  const baseUrl = opts.registry ?? matterConfig.registryUrl;

  return baseUrl.replace('${ref}', opts.ref);
}

export async function writeMatterConfig(
  projectRoot: string,
  matterConfig: MatterConfig,
): Promise<void> {
  const path = configPath(projectRoot);
  const json = `${JSON.stringify(matterConfig, null, 2)}\n`;

  await writeFile(path, json, 'utf-8');
}
