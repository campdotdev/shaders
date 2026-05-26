import { z } from 'zod'
import type { DocsFrontmatter } from './types'

const sectionEnum = z.enum(['overview', 'guides', 'react.guides', 'react.api', 'reference'])

export const rawFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  section: sectionEnum,
  order: z.number(),
  navTitle: z.string().optional(),
  hidden: z.boolean().optional(),
  status: z.enum(['draft', 'ready']).optional(),
  tags: z.array(z.string()).optional(),
})

export function parseFrontmatter(data: unknown, sourcePath: string): DocsFrontmatter {
  const result = rawFrontmatterSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid frontmatter in ${sourcePath}:\n${issues}`)
  }
  const v = result.data
  return {
    title: v.title,
    description: v.description,
    section: v.section,
    order: v.order,
    navTitle: v.navTitle ?? v.title,
    hidden: v.hidden ?? false,
    status: v.status ?? 'ready',
    tags: v.tags ?? [],
  }
}

const registryComponentSchema = z.object({
  description: z.string().min(1),
  tier: z.number().int(),
  file: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  uses_primitives: z.array(z.string()).optional(),
})

export const registrySchema = z.object({
  version: z.string().min(1),
  components: z.record(z.string(), registryComponentSchema),
})

export type RegistryFile = z.infer<typeof registrySchema>
export type RegistryComponent = z.infer<typeof registryComponentSchema>

export function parseRegistry(data: unknown, sourcePath: string): RegistryFile {
  const result = registrySchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid registry file at ${sourcePath}:\n${issues}`)
  }
  return result.data
}
