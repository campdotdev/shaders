// `shaders-cli init`: one-time setup — writes the starter shaders.config.json
// (components directory, registry URL template, import aliases) into the
// user's project and points them at the fields worth editing.
import {
  configExists,
  configPath,
  DEFAULT_SHADERS_CONFIG,
  writeShadersConfig,
} from '../config/shadersConfig.js';

export interface InitOptions {
  force?: boolean;
}

export interface InitIO {
  cwd: string;
  log: (line: string) => void;
}

export async function runInit(
  opts: InitOptions,
  io: InitIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  const exists = await configExists(io.cwd);

  if (exists && opts.force !== true) {
    throw new Error(`shaders.config.json already exists in ${io.cwd}. Pass --force to overwrite.`);
  }
  await writeShadersConfig(io.cwd, DEFAULT_SHADERS_CONFIG);
  io.log(`Created shaders.config.json at ${configPath(io.cwd)}`);
  io.log(
    'Edit `componentsDir` if your project uses a different layout, ' +
      'and adjust `aliases` to match your tsconfig paths.',
  );
}
