import { type CodeLang, getHighlighter } from '@/lib/shiki';

interface CodeBlockProps {
  source: string;
  lang?: CodeLang;
}

export async function CodeBlock({ source, lang = 'tsx' }: CodeBlockProps) {
  const highlighter = await getHighlighter();
  const lightHtml = highlighter.codeToHtml(source, {
    lang,
    theme: 'github-light',
  });
  const darkHtml = highlighter.codeToHtml(source, {
    lang,
    theme: 'github-dark',
  });

  return (
    <div className="codeblock">
      <div className="codeblock-light" dangerouslySetInnerHTML={{ __html: lightHtml }} />
      <div className="codeblock-dark" dangerouslySetInnerHTML={{ __html: darkHtml }} />
    </div>
  );
}
