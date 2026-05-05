import {
  DEFAULT_MATTER_CONFIG,
  configExists,
  configPath,
  writeMatterConfig,
} from '../config/matterConfig.js'

export interface InitOptions {
  force?: boolean
}

export interface InitIO {
  cwd: string
  log: (line: string) => void
}

export async function runInit(
  opts: InitOptions,
  io: InitIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  const exists = await configExists(io.cwd)
  if (exists && !opts.force) {
    throw new Error(
      `matter.config.json already exists in ${io.cwd}. Pass --force to overwrite.`,
    )
  }
  await writeMatterConfig(io.cwd, DEFAULT_MATTER_CONFIG)
  io.log(`Created matter.config.json at ${configPath(io.cwd)}`)
  io.log(
    'Edit `componentsDir` if your project uses a different layout, ' +
      'and adjust `aliases` to match your tsconfig paths.',
  )
}
