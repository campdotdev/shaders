import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { bundlePoster } from './bundle.js'

const FIXTURE_DIR = new URL('../test-fixtures/posters/', import.meta.url).pathname

describe('bundlePoster', () => {
  it('produces an ESM bundle that references the resolved user module', async () => {
    const result = await bundlePoster({
      from: `${FIXTURE_DIR}trivial.tsx`,
      exportName: 'default',
      projectRoot: new URL('../../', import.meta.url).pathname, // matter-cli's own root, has react installed
    })
    expect(result.js).toContain('hello')
    expect(result.js.length).toBeGreaterThan(1000)
  })

  it('surfaces esbuild errors as Error', async () => {
    await expect(
      bundlePoster({
        from: `${FIXTURE_DIR}__does_not_exist__.tsx`,
        exportName: 'default',
        projectRoot: new URL('../../', import.meta.url).pathname,
      }),
    ).rejects.toThrow()
  })
})

describe('bundlePoster — error messages', () => {
  it('surfaces a TS/JSX syntax error with the user file path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'matter-bundle-err-'))
    await writeFile(join(dir, 'package.json'), '{}')
    const bad = join(dir, 'bad.tsx')
    await writeFile(bad, 'export default function Bad() { return <div></span> }')

    await expect(
      bundlePoster({ from: bad, exportName: 'default', projectRoot: dir }),
    ).rejects.toThrow(/bad\.tsx/)
  })
})
