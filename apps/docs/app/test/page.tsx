import { CodeBlock } from '../_components/CodeBlock'
import { readRegistrySource } from '../_lib/registrySources'
import { LinearGradientDemo } from './LinearGradientDemo'

// Server Component — CodeBlock runs shiki on the server. The shader demo is
// wrapped in a Client Component (LinearGradientDemo) so we can use
// `next/dynamic` with `ssr: false` (Next 15 forbids `ssr: false` in Server
// Components).
export default async function TestPage() {
  const linearGradientSource = await readRegistrySource('linear-gradient')

  return (
    <div style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
      <h1>Phase 4.1 test page</h1>
      <p>
        Throwaway smoke test for the new shared docs infra (LiveDemo,
        CodeBlock, theme toggle). Will be removed in Phase 4.2.a.
      </p>
      <p>
        Toggle the theme in the header — the page chrome (bg, text, code
        block) responds. The shader background inside the demo frame is
        intentionally fixed.
      </p>
      <LinearGradientDemo />
      <h2>Source (registry/linear-gradient.tsx)</h2>
      <CodeBlock source={linearGradientSource} lang="tsx" />
    </div>
  )
}
