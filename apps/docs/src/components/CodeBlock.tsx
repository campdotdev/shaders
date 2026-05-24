import { getHighlighter, type CodeLang } from '@/lib/shiki'

interface CodeBlockProps {
  source: string
  lang?: CodeLang
}

// Server Component — shiki runs at build/request time on the server. We emit
// two pre-rendered HTML blocks (one per theme) and let CSS reveal the right
// one based on `[data-theme]` on <html>. This avoids a client-side highlight
// flash on theme cycle. Source is trusted (from our own registry), so the
// dangerouslySetInnerHTML usage is safe.
export async function CodeBlock({ source, lang = 'tsx' }: CodeBlockProps) {
  const highlighter = await getHighlighter()
  const lightHtml = highlighter.codeToHtml(source, { lang, theme: 'github-light' })
  const darkHtml = highlighter.codeToHtml(source, { lang, theme: 'github-dark' })

  return (
    <div className="codeblock">
      <div className="codeblock-light" dangerouslySetInnerHTML={{ __html: lightHtml }} />
      <div className="codeblock-dark" dangerouslySetInnerHTML={{ __html: darkHtml }} />
    </div>
  )
}
