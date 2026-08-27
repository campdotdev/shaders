import { type CodeLang, getHighlighter } from '@/lib/shiki';

interface CodeBlockProps {
  source: string;
  lang?: CodeLang;
}

export async function CodeBlock({ source, lang = 'tsx' }: CodeBlockProps) {
  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(source, {
    lang,
    theme: 'github-dark',
  });

  return (
    <div className="codeblock">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
