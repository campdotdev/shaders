import { Command } from 'commander'

declare const __VERSION__: string

function fail(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err)

  process.stderr.write(`error: ${message}\n`)
  process.exit(1)
}

const program = new Command()

program
  .name('matter-cli')
  .description('CLI for Matter — copy-paste components from the registry into your project')
  .version(__VERSION__)

program
  .command('init')
  .description('one-time project setup — writes matter.config.json')
  .option('--force', 'overwrite an existing matter.config.json')
  .action(async (opts: { force?: boolean }) => {
    try {
      const { runInit } = await import('./commands/init.js')

      await runInit(opts)
    } catch (err) {
      fail(err)
    }
  })

program
  .command('list')
  .description('show available components in the registry')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .action(async (opts: { registry?: string; ref?: string }) => {
    try {
      const { runList } = await import('./commands/list.js')

      await runList({ ...opts, cliVersion: __VERSION__ })
    } catch (err) {
      fail(err)
    }
  })

program
  .command('add')
  .description('copy one or more components from the registry into componentsDir')
  .argument('<components...>', 'component slugs (e.g. "linear-gradient")')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite existing files in componentsDir')
  .action(
    async (components: string[], opts: { registry?: string; ref?: string; force?: boolean }) => {
      try {
        const { runAdd } = await import('./commands/add.js')

        await runAdd(components, { ...opts, cliVersion: __VERSION__ })
      } catch (err) {
        fail(err)
      }
    },
  )

program
  .command('update')
  .description('re-fetch a previously-added component (or all, if no name given)')
  .argument('[components...]', 'component slugs; omit to update every component in componentsDir')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite files even if they have local edits')
  .action(
    async (components: string[], opts: { registry?: string; ref?: string; force?: boolean }) => {
      try {
        const { runUpdate } = await import('./commands/update.js')

        await runUpdate(components, { ...opts, cliVersion: __VERSION__ })
      } catch (err) {
        fail(err)
      }
    },
  )

program
  .command('poster')
  .description('render a Matter component tree to a static PNG for use as <ShaderScene fallback>')
  .requiredOption('--from <file>', 'path to a .tsx/.ts file exporting the component to render')
  .requiredOption('--out <path>', 'where to write the PNG')
  .option('--export <name>', 'named export to render', 'default')
  .option('--time <seconds>', 'wait this long after first non-blank frame', '0')
  .option('--width <px>', 'render width', '1280')
  .option('--height <px>', 'render height', '720')
  .action(
    async (opts: {
      from: string
      out: string
      export: string
      time: string
      width: string
      height: string
    }) => {
      try {
        const { runPoster } = await import('./commands/poster.js')
        await runPoster({
          from: opts.from,
          out: opts.out,
          exportName: opts.export,
          timeSeconds: Number.parseFloat(opts.time),
          width: Number.parseInt(opts.width, 10),
          height: Number.parseInt(opts.height, 10),
        })
      } catch (err) {
        fail(err)
      }
    },
  )

await program.parseAsync(process.argv)
