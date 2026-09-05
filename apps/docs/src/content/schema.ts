import { z } from 'zod';

import { CATEGORY_SLUGS } from './taxonomy';
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

const registryComponentSchema = z.object({
  description: z.string().min(1),
  tier: z.number().int(),
  category: z.enum(CATEGORY_SLUGS),
  file: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  uses_primitives: z.array(z.string()).optional(),
});

const registrySchema = z.object({
  version: z.string().min(1),
  components: z.record(z.string(), registryComponentSchema),
});

export type RegistryFile = z.infer<typeof registrySchema>;

export function parseRegistry(data: unknown, sourcePath: string): RegistryFile {
  const result = registrySchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid registry file at ${sourcePath}:\n${formatZodError(result.error)}`);
  }

  return result.data;
}
