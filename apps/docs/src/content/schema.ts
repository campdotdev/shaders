import { z } from 'zod';

import type { DocsFrontmatter } from './types';

const sectionEnum = z.enum(['overview', 'guides', 'react.guides', 'react.api', 'reference']);

const rawFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  section: sectionEnum,
  order: z.number(),
  navTitle: z.string().optional(),
  hidden: z.boolean().optional(),
  status: z.enum(['draft', 'ready']).optional(),
  tags: z.array(z.string()).optional(),
});

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');

      return `  - ${path === '' ? '<root>' : path}: ${issue.message}`;
    })
    .join('\n');
}

export function parseFrontmatter(data: unknown, sourcePath: string): DocsFrontmatter {
  const result = rawFrontmatterSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid frontmatter in ${sourcePath}:\n${formatZodError(result.error)}`);
  }
  const frontmatterData = result.data;

  return {
    title: frontmatterData.title,
    description: frontmatterData.description,
    section: frontmatterData.section,
    order: frontmatterData.order,
    navTitle: frontmatterData.navTitle ?? frontmatterData.title,
    hidden: frontmatterData.hidden ?? false,
    status: frontmatterData.status ?? 'ready',
    tags: frontmatterData.tags ?? [],
  };
}
