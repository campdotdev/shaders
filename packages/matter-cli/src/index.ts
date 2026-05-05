import { Command } from 'commander'

declare const __VERSION__: string

const program = new Command()

program
  .name('matter-cli')
  .description('CLI for Matter — copy-paste components from the registry into your project')
  .version(__VERSION__)

program
  .command('init')
  .description('one-time project setup — writes matter.config.json')
  .option('--force', 'overwrite an existing matter.config.json')
  .action(() => {
    console.log('init: not implemented yet (Phase 2.4)')
  })

program
  .command('list')
  .description('show available components in the registry')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .action(() => {
    console.log('list: not implemented yet (Phase 2.3)')
  })

program
  .command('add')
  .description('copy one or more components from the registry into componentsDir')
  .argument('<components...>', 'component slugs (e.g. "linear-gradient")')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite existing files in componentsDir')
  .action(() => {
    console.log('add: not implemented yet (Phase 2.5)')
  })

program
  .command('update')
  .description('re-fetch a previously-added component (or all, if no name given)')
  .argument('[components...]', 'component slugs; omit to update every component in componentsDir')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite files even if they have local edits')
  .action(() => {
    console.log('update: not implemented yet (Phase 2.8)')
  })

await program.parseAsync(process.argv)
