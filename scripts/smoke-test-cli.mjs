import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(__dirname, '..')
const cliDir = join(repoRoot, 'packages/matter-cli')
const registryFileUrl = `file://${join(repoRoot, 'registry')}/`

function step(label) {
  console.log(`\n→ ${label}`)
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

function runQuiet(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).toString()
}

const smokeDir = mkdtempSync(join(tmpdir(), 'matter-cli-smoke-'))
let exitCode = 0

try {
  step('Build the CLI')
  run('pnpm --filter @lovo/matter-cli build', { cwd: repoRoot })

  step(`Pack the CLI from ${cliDir}`)
  const packOutput = runQuiet(`pnpm pack --pack-destination "${smokeDir}"`, {
    cwd: cliDir,
  })
  console.log(packOutput)
  const tarball = runQuiet(`ls "${smokeDir}"/*.tgz | head -1`).trim()
  if (!tarball) throw new Error('No tarball produced by pnpm pack')
  console.log(`  tarball: ${tarball}`)

  step(`Initialize a fresh project in ${smokeDir}`)
  writeFileSync(
    join(smokeDir, 'package.json'),
    JSON.stringify({ name: 'matter-cli-smoke', version: '0.0.0', private: true }, null, 2) + '\n',
  )

  step(`Install the packed CLI`)
  run(`npm install --no-save "${tarball}"`, { cwd: smokeDir })

  step(`Run \`matter-cli init\``)
  run(`node node_modules/@lovo/matter-cli/dist/index.js init`, {
    cwd: smokeDir,
  })

  step(`Point matter.config.json at the local registry (no GitHub remote yet)`)
  const cfgPath = join(smokeDir, 'matter.config.json')
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'))
  cfg.registryUrl = registryFileUrl
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')

  step(`Run \`matter-cli list\``)
  run(`node node_modules/@lovo/matter-cli/dist/index.js list`, {
    cwd: smokeDir,
  })

  step(`Run \`matter-cli add linear-gradient\``)
  run(`node node_modules/@lovo/matter-cli/dist/index.js add linear-gradient`, {
    cwd: smokeDir,
  })

  step(`Verify the copied file matches the registry source`)
  const expected = readFileSync(
    join(repoRoot, 'registry/linear-gradient/linear-gradient.tsx'),
    'utf-8',
  )
  const actual = readFileSync(
    join(smokeDir, 'src/components/matter/linear-gradient/linear-gradient.tsx'),
    'utf-8',
  )
  if (expected !== actual) {
    throw new Error('Copied component does not match registry source')
  }
  console.log('  ✓ files are byte-identical')

  step(`Edit the copied component and run \`matter-cli update --force\``)
  writeFileSync(
    join(smokeDir, 'src/components/matter/linear-gradient/linear-gradient.tsx'),
    'export const stale = true\n',
  )
  run(`node node_modules/@lovo/matter-cli/dist/index.js update linear-gradient --force`, {
    cwd: smokeDir,
  })
  const refreshed = readFileSync(
    join(smokeDir, 'src/components/matter/linear-gradient/linear-gradient.tsx'),
    'utf-8',
  )
  if (refreshed !== expected) {
    throw new Error('Component was not refreshed by update --force')
  }
  console.log('  ✓ update --force restored the registry source')

  step('All smoke-test assertions passed ✅')
} catch (err) {
  console.error(`\n✗ Smoke test failed: ${err instanceof Error ? err.message : String(err)}`)
  exitCode = 1
} finally {
  rmSync(smokeDir, { recursive: true, force: true })
  process.exit(exitCode)
}
