import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface MatterConfig {
  componentsDir: string
  registryUrl: string
  aliases: Record<string, string>
  tsx: boolean
}

/**
 * Defaults align with spec §4.3. componentsDir mirrors shadcn's
 * `src/components/ui` convention but namespaced under `matter` so a project
 * using both shadcn and matter doesn't collide.
 */
export const DEFAULT_MATTER_CONFIG: MatterConfig = {
  componentsDir: 'src/components/matter',
  registryUrl: 'https://raw.githubusercontent.com/lovo-hq/matter/${ref}/registry',
  aliases: { '@/': 'src/' },
  tsx: true,
}

const CONFIG_FILENAME = 'matter.config.json'

export function configPath(projectRoot: string): string {
  return join(projectRoot, CONFIG_FILENAME)
}

export async function configExists(projectRoot: string): Promise<boolean> {
  try {
    await access(configPath(projectRoot))
    return true
  } catch {
    return false
  }
}

export async function readMatterConfig(projectRoot: string): Promise<MatterConfig> {
  const path = configPath(projectRoot)
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `matter.config.json not found in ${projectRoot}. Run \`matter-cli init\` first.`,
      )
    }
    throw err
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${(err as Error).message}`)
  }
  return validateMatterConfig(parsed, path)
}

export async function writeMatterConfig(projectRoot: string, cfg: MatterConfig): Promise<void> {
  const path = configPath(projectRoot)
  const json = `${JSON.stringify(cfg, null, 2)}\n`
  await writeFile(path, json, 'utf-8')
}

function validateMatterConfig(parsed: unknown, path: string): MatterConfig {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${path}: expected an object`)
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.componentsDir !== 'string' || obj.componentsDir === '') {
    throw new Error(`${path}: missing or empty "componentsDir" string`)
  }
  if (typeof obj.registryUrl !== 'string' || obj.registryUrl === '') {
    throw new Error(`${path}: missing or empty "registryUrl" string`)
  }
  if (typeof obj.aliases !== 'object' || obj.aliases === null) {
    throw new Error(`${path}: missing "aliases" object`)
  }
  if (typeof obj.tsx !== 'boolean') {
    throw new Error(`${path}: missing "tsx" boolean`)
  }
  const aliases: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj.aliases as Record<string, unknown>)) {
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
