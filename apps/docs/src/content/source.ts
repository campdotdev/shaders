import matter from 'gray-matter'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { cache } from 'react'

import { parseFrontmatter } from './schema'
import { extractHeadings } from './toc'
import type { DocsPage } from './types'

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs')

async function walkMdx(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      out.push(...(await walkMdx(full)))
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      out.push(full)
    }
  }

  return out
}

function fileToUrl(absolute: string): { url: string; slugs: string[] } {
  const rel = path.relative(CONTENT_ROOT, absolute).replace(/\.mdx$/, '')
  const cleaned = rel.replace(/\/index$/, '')
  const slugs = cleaned.split(path.sep)

  return { url: '/' + slugs.join('/'), slugs }
}

export const getMdxDocsPages = cache(async (): Promise<DocsPage[]> => {
  let files: string[]

  try {
    files = await walkMdx(CONTENT_ROOT)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }

  const pages: DocsPage[] = []

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf8')
    const { data, content } = matter(raw)
    const frontmatter = parseFrontmatter(data, filePath)
    const { url, slugs } = fileToUrl(filePath)
    const headings = extractHeadings(content)

    pages.push({
      url,
      slugs,
      sourcePath: filePath,
      body: content,
      frontmatter,
      headings,
    })
  }

  pages.sort((a, b) => {
    const s = a.frontmatter.section.localeCompare(b.frontmatter.section)

    if (s !== 0) return s
    const o = a.frontmatter.order - b.frontmatter.order

    if (o !== 0) return o

    return a.frontmatter.title.localeCompare(b.frontmatter.title)
  })

  return pages
})

export const getDocsPage = cache(async (slugs: string[]): Promise<DocsPage | null> => {
  const pages = await getMdxDocsPages()
  const target = '/' + slugs.join('/')

  return pages.find((p) => p.url === target) ?? null
})

export const getDocsStaticParams = cache(async () => {
  const pages = await getMdxDocsPages()

  return pages.filter((p) => !p.frontmatter.hidden).map((p) => ({ slug: p.slugs }))
})
