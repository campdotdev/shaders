// The CLI's entry point: one command, `poster`. The action lazy-imports its
// implementation so `shaders-cli --help` stays instant and poster's heavy
// dependencies (esbuild, the user's playwright) load only when actually used.
// The real logic lives in ./commands/poster.ts, whose runPoster takes an
// injectable IO (cwd + log) so tests can run it against a temp directory and
// capture output.
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
  .description('Dev-time tools for Shaders: render a component tree to a poster image')
  .version(__VERSION__);

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
