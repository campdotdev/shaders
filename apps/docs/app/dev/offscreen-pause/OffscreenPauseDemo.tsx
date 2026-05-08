'use client'

import { LinearGradient } from '@matter/registry/linear-gradient'

const Spacer = ({ label }: { label: string }) => (
  <div
    style={{
      height: '120vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem',
      color: '#666',
      borderTop: '1px solid #333',
      borderBottom: '1px solid #333',
    }}
  >
    {label}
  </div>
)

export function OffscreenPauseDemo() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1>Offscreen pause</h1>
      <p>
        Open Chrome DevTools &rarr; Performance Monitor and watch <strong>CPU usage</strong>. Scroll
        until the gradient is fully off the top or bottom of the viewport &mdash; CPU should drop to
        ~0%. Scroll it back into view &mdash; CPU returns to a few percent.
      </p>
      <Spacer label="Scroll down…" />
      <div style={{ position: 'relative', width: '100%', height: 360, margin: '2rem 0' }}>
        <LinearGradient
          colors={['#ff7b72', '#7b9cff', '#7bff9c']}
          angle={45}
          speed={1}
          style={{ borderRadius: 8 }}
        />
      </div>
      <Spacer label="Keep scrolling — gradient should be off-screen above by now." />
    </main>
  )
}
