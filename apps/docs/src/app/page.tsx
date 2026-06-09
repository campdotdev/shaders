import Link from 'next/link';

const COMPONENTS = [
  { slug: 'linear-gradient', label: '<LinearGradient>' },
  { slug: 'simplex-noise', label: '<SimplexNoise>' },
  { slug: 'dot-field', label: '<DotField>' },
  { slug: 'waves', label: '<Waves>' },
  { slug: 'mesh-gradient', label: '<MeshGradient>' },
  { slug: 'aurora', label: '<Aurora>' },
] as const;

export default function Home() {
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: '60ch', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Matter</h1>
      <p>React shader components powered by WebGPU and Three.js TSL.</p>
      <p style={{ opacity: 0.75 }}>Status: pre-release, M3 complete — six v1 components live.</p>
      <h2 style={{ marginTop: '2rem' }}>Components</h2>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
        {COMPONENTS.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/components/${c.slug}`}
              style={{ color: '#88aaff', textDecoration: 'none' }}
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
