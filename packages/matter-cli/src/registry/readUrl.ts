import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * Read a URL and return its contents as a UTF-8 string. Supports `file://`
 * and `http(s)://` schemes. Used internally by registry fetching and
 * component source fetching — the same code path serves dev (`file://`
 * pointing at the local registry) and production (`https://raw.githubusercontent.com/...`).
 */
export async function readUrl(url: string): Promise<string> {
  const parsed = new URL(url)

  if (parsed.protocol === 'file:') {
    const path = fileURLToPath(parsed)
    try {
      return await readFile(path, 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${path}`)
      }
      throw err
    }
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    let res: Response
    try {
      res = await fetch(url)
    } catch (err) {
      throw new Error(`Failed to fetch ${url}: ${(err as Error).message}`)
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
    }
    return await res.text()
  }

  throw new Error(
    `Unsupported protocol: ${parsed.protocol} (only file://, http://, https:// are supported)`,
  )
}
