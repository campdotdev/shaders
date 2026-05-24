import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { mdxComponents } from '@/content/mdx'
import { getDocsPage, getDocsStaticParams } from '@/content/source'

export const dynamicParams = false

interface PageProps {
  params: Promise<{ slug: string[] }>
}

export async function generateStaticParams() {
  return getDocsStaticParams()
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const page = await getDocsPage(slug)
  if (!page) return {}
  return {
    title: page.frontmatter.title,
    description: page.frontmatter.description,
  }
}

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params
  const page = await getDocsPage(slug)
  if (!page) notFound()

  return (
    <article>
      <MDXRemote
        source={page.body}
        components={mdxComponents}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeSlug],
          },
        }}
      />
    </article>
  )
}
