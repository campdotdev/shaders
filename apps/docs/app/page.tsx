import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: '60ch', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Matter</h1>
      <p>React shader components powered by WebGPU and Three.js TSL.</p>
      <p style={{ opacity: 0.75 }}>
        Status: pre-release, M1 in progress.
      </p>
      <p>
        <Link
          href="/components/linear-gradient"
          style={{ color: '#88aaff', textDecoration: 'none' }}
        >
          See the first component →
        </Link>
      </p>
    </main>
  )
}
