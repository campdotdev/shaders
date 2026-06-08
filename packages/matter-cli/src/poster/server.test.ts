import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createPosterServer, type PosterServer } from './server.js'

const bundle = {
  html: '<!doctype html><html><body>ok</body></html>',
  js: 'console.log("bundle")',
}

let server: PosterServer

beforeEach(async () => {
  server = await createPosterServer({ bundle, config: { width: 1280, height: 720 } })
})

afterEach(async () => {
  await server.close()
})

describe('createPosterServer', () => {
  it('listens on a random localhost port', () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it('serves the harness HTML at /', async () => {
    const res = await fetch(`${server.url}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(await res.text()).toContain('ok')
  })

  it('serves the harness JS at /harness.js', async () => {
    const res = await fetch(`${server.url}/harness.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/javascript/)
    expect(await res.text()).toContain('bundle')
  })

  it('serves the render config as JSON at /config.json', async () => {
    const res = await fetch(`${server.url}/config.json`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { width: number; height: number }
    expect(json.width).toBe(1280)
    expect(json.height).toBe(720)
  })

  it('404s unknown paths', async () => {
    const res = await fetch(`${server.url}/nope`)
    expect(res.status).toBe(404)
  })
})
