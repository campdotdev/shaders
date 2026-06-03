import { CodeBlock } from '@/components/CodeBlock'
import type { PropSchema } from '@/components/PropsPlayground'
import { palette } from '@/lib/palette'
import { readRegistrySource } from '@/lib/registrySources'

import { PageBody } from './PageBody'

const SCHEMA: PropSchema = [
  {
    name: 'colors',
    type: 'colors',
    default: [palette.lime.light, palette.green.dark],
  },
  { name: 'angle', type: 'number', default: 90, min: 0, max: 360, step: 1 },
  { name: 'speed', type: 'number', default: 0, min: 0, max: 2, step: 0.01 },
  { name: 'interactive', type: 'boolean', default: false },
  {
    name: 'variant',
    type: 'enum',
    default: 'linear',
    options: ['linear', 'radial'],
  },
]

export default async function LinearGradientPage() {
  const source = await readRegistrySource('linear-gradient')

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>&lt;LinearGradient /&gt;</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Animated linear or radial gradient with optional cursor parallax. The simplest, foundational
        Matter component.
      </p>
      <PageBody code={<CodeBlock lang="tsx" source={source} />} schema={SCHEMA} />
    </div>
  )
}
