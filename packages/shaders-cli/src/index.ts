// The CLI's entry point: just the command table. Each action lazy-imports
// its implementation so `shaders-cli --help` stays instant and poster's heavy
// dependencies (esbuild, the user's playwright) load only when actually
// used. Real logic lives in ./commands/*; each run* function takes an
// injectable IO (cwd + log) so tests can run commands against a temp
// directory and capture output.
import { Command } from 'commander';

// Stamped with the package version by tsup at build time.
declare const __VERSION__: string;

function fail(caughtError: unknown): never {
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError);

  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

const program = new Command();

program
  .name('shaders-cli')
  .description('CLI for Shaders — copy-paste components from the registry into your project')
  .version(__VERSION__);

program
  .command('init')
  .description('one-time project setup — writes shaders.config.json')
  .option('--force', 'overwrite an existing shaders.config.json')
  .action(async (opts: { force?: boolean }) => {
    try {
      const { runInit } = await import('./commands/init.js');

      await runInit(opts);
    } catch (caughtError) {
      fail(caughtError);
    }
  });

program
  .command('list')
  .description('show available components in the registry')
  .option('--registry <url>', 'override the registryUrl from shaders.config.json')
  .option('--reference <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .action(async (opts: { registry?: string; reference?: string }) => {
    try {
      const { runList } = await import('./commands/list.js');

      await runList({ registry: opts.registry, ref: opts.reference, cliVersion: __VERSION__ });
    } catch (caughtError) {
      fail(caughtError);
    }
  });

program
  .command('add')
  .description('copy one or more components from the registry into componentsDir')
  .argument('<components...>', 'component slugs (e.g. "linear-gradient")')
  .option('--registry <url>', 'override the registryUrl from shaders.config.json')
  .option('--reference <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite existing files in componentsDir')
  .action(
    async (
      components: string[],
      opts: { registry?: string; reference?: string; force?: boolean },
    ) => {
      try {
        const { runAdd } = await import('./commands/add.js');

        await runAdd(components, {
          registry: opts.registry,
          ref: opts.reference,
          force: opts.force,
          cliVersion: __VERSION__,
        });
      } catch (caughtError) {
        fail(caughtError);
      }
    },
  );

program
  .command('update')
  .description('re-fetch a previously-added component (or all, if no name given)')
  .argument('[components...]', 'component slugs; omit to update every component in componentsDir')
  .option('--registry <url>', 'override the registryUrl from shaders.config.json')
  .option('--reference <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite files even if they have local edits')
  .action(
    async (
      components: string[],
      opts: { registry?: string; reference?: string; force?: boolean },
    ) => {
      try {
        const { runUpdate } = await import('./commands/update.js');

        await runUpdate(components, {
          registry: opts.registry,
          ref: opts.reference,
          force: opts.force,
          cliVersion: __VERSION__,
        });
      } catch (caughtError) {
        fail(caughtError);
      }
    },
  );

program
  .command('poster')
  .description(
    'render a Shaders component tree to a static image for use as a <ShaderPoster> poster',
  )
  .requiredOption('--source <file>', 'path to a .tsx/.ts file exporting the component to render')
  .requiredOption('--output <path>', 'where to write the image (extension optional; --format wins)')
  .option('--format <format>', 'output format: png or jpg', 'jpg')
  .option('--quality <n>', 'JPEG quality 1–100 (default 80, ignored for PNG)')
  .option('--export-name <name>', 'named export to render', 'default')
  .option('--capture-delay <seconds>', 'wait this long after first non-blank frame', '0')
  .option('--width <px>', 'render width', '1280')
  .option('--height <px>', 'render height', '720')
  .option('--device-scale-factor <n>', 'capture DPR; defaults to 2 to match the live renderer', '2')
  .option(
    '--background <color>',
    'CSS color to composite behind the shader before capture (default: harness background)',
  )
  .action(
    async (opts: {
      source: string;
      output: string;
      format: string;
      quality?: string;
      exportName: string;
      captureDelay: string;
      width: string;
      height: string;
      deviceScaleFactor: string;
      background?: string;
    }) => {
      try {
        const { runPoster } = await import('./commands/poster.js');

        await runPoster({
          from: opts.source,
          out: opts.output,
          type: opts.format,
          quality: opts.quality === undefined ? undefined : Number.parseInt(opts.quality, 10),
          exportName: opts.exportName,
          timeSeconds: Number.parseFloat(opts.captureDelay),
          width: Number.parseInt(opts.width, 10),
          height: Number.parseInt(opts.height, 10),
          deviceScaleFactor: Number.parseFloat(opts.deviceScaleFactor),
          background: opts.background,
        });
      } catch (caughtError) {
        fail(caughtError);
      }
    },
  );

await program.parseAsync(process.argv);
