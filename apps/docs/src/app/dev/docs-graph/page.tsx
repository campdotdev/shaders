import { getDocsNavTree } from '@/content/nav'
import { getDocsSearchDocuments } from '@/content/search'
import { getMdxDocsPages } from '@/content/source'

export default async function DocsGraphPage() {
  const pages = await getMdxDocsPages()
  const nav = await getDocsNavTree()
  const search = await getDocsSearchDocuments()

  const pageSummary = pages.map((p) => ({
    url: p.url,
    section: p.frontmatter.section,
    order: p.frontmatter.order,
    status: p.frontmatter.status,
    navTitle: p.frontmatter.navTitle,
    headings: p.headings.length,
    sourcePath: p.sourcePath.replace(process.cwd(), '.'),
  }))

  const sectionStyle = { marginBottom: '2rem' } as const
  const preStyle = {
    background: 'color-mix(in oklab, currentColor 6%, transparent)',
    padding: '1rem',
    borderRadius: '0.5rem',
    overflow: 'auto',
    fontSize: '0.8125rem',
  } as const

  return (
    <main
      style={{
        padding: '2rem',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        maxWidth: 960,
        margin: '0 auto',
      }}
    >
      <h1>Docs content graph (diagnostics)</h1>
      <p style={{ opacity: 0.7 }}>
        Phase 8.1 diagnostics — inspect the resolved page graph, nav tree, and search documents.
        Safe to delete once Phase 8.3 ships the real sidebar.
      </p>
      <section style={sectionStyle}>
        <h2>Pages ({pages.length})</h2>
        <pre style={preStyle}>{JSON.stringify(pageSummary, null, 2)}</pre>
      </section>
      <section style={sectionStyle}>
        <h2>Nav tree</h2>
        <pre style={preStyle}>{JSON.stringify(nav, null, 2)}</pre>
      </section>
      <section style={sectionStyle}>
        <h2>Search documents ({search.length})</h2>
        <pre style={preStyle}>{JSON.stringify(search, null, 2)}</pre>
      </section>
    </main>
  )
}
