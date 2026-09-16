import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { MDXRemote } from 'next-mdx-remote/rsc';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

import { Breadcrumbs } from '@/components/breadcrumbs/breadcrumbs';
import { PrevNext } from '@/components/docs/PrevNext';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { mdxComponents } from '@/content/mdx';
import { getDocsBreadcrumbs, getDocsPrevNext } from '@/content/nav';
import { getDocsPage, getDocsStaticParams } from '@/content/source';

import styles from './page.module.css';

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateStaticParams() {
  return getDocsStaticParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getDocsPage(slug);

  if (!page) return {};

  return {
    title: page.frontmatter.title,
    description: page.frontmatter.description,
  };
}

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getDocsPage(slug);

  if (!page) notFound();

  const [crumbs, prevNext] = await Promise.all([getDocsBreadcrumbs(page), getDocsPrevNext(page)]);

  return (
    <div className={styles.layout}>
      <article className={`prose ${styles.article}`}>
        <Breadcrumbs className={styles.breadcrumbs} crumbs={crumbs} />
        <MDXRemote
          components={mdxComponents}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [rehypeSlug],
            },
          }}
          source={page.body}
        />
        <PrevNext next={prevNext.next} prev={prevNext.prev} />
      </article>
      <aside className={styles.aside}>
        <TableOfContents headings={page.headings} />
      </aside>
    </div>
  );
}
