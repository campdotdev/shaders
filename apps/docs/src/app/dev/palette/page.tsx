'use client'

import { useState } from 'react'

type Swatch = { name: string; hex: string; note?: string }

const VIBRANT: Swatch[] = [
  { name: 'lime', hex: '#09e24b', note: 'Aurora' },
  { name: 'cyan', hex: '#06b6d4' },
  { name: 'cobalt', hex: '#1837e6', note: 'Aurora' },
  { name: 'violet', hex: '#661acc', note: 'Aurora' },
  { name: 'magenta', hex: '#cc1a99', note: 'Aurora' },
  { name: 'coral', hex: '#f43f5e' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'yellow', hex: '#fbbf24' },
]

const MUTED: Swatch[] = [
  { name: 'lime', hex: '#4a8f5a' },
  { name: 'cyan', hex: '#456f80' },
  { name: 'cobalt', hex: '#5466b8' },
  { name: 'violet', hex: '#724a9b' },
  { name: 'magenta', hex: '#9c4889' },
  { name: 'coral', hex: '#b56872' },
  { name: 'amber', hex: '#bb8a3a' },
  { name: 'yellow', hex: '#c7a73f' },
]

const NEUTRAL: Swatch[] = [
  { name: 'ink', hex: '#0a0a14', note: 'page bg (dark)' },
  { name: 'deep', hex: '#1a1a26', note: 'panel / card' },
  { name: 'mid', hex: '#4a4a5a', note: 'borders / hint' },
  { name: 'paper', hex: '#f5f5f7', note: 'page bg (light)' },
  { name: 'cream', hex: '#fafaf7', note: 'warm paper alt' },
]

const PAIRS: [string, string][] = [
  ['#09e24b', '#06b6d4'],
  ['#06b6d4', '#1837e6'],
  ['#1837e6', '#661acc'],
  ['#661acc', '#cc1a99'],
  ['#cc1a99', '#f43f5e'],
  ['#f43f5e', '#f59e0b'],
  ['#f59e0b', '#fbbf24'],
  ['#fbbf24', '#09e24b'],
]

const AURORA_STACK = ['#09e24b', '#1837e6', '#661acc', '#cc1a99']
const WARM_STACK = ['#cc1a99', '#f43f5e', '#f59e0b', '#fbbf24']
const FULL_WHEEL = [
  '#09e24b',
  '#06b6d4',
  '#1837e6',
  '#661acc',
  '#cc1a99',
  '#f43f5e',
  '#f59e0b',
  '#fbbf24',
]

function SwatchBlock({ swatch, bg }: { swatch: Swatch; bg: string }) {
  const fg = bg === 'dark' ? '#e8e8f0' : '#14141a'
  const subFg = bg === 'dark' ? '#9a9aaa' : '#5a5a66'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          background: swatch.hex,
          height: 96,
          borderRadius: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 600, color: fg }}>{swatch.name}</div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: subFg }}>
        {swatch.hex}
        {swatch.note ? `  ·  ${swatch.note}` : ''}
      </div>
    </div>
  )
}

function GradientStrip({ from, to }: { from: string; to: string }) {
  return (
    <div
      style={{
        height: 56,
        borderRadius: 8,
        background: `linear-gradient(90deg, ${from}, ${to})`,
      }}
      title={`${from} → ${to}`}
    />
  )
}

function MultiStop({ colors, label }: { colors: string[]; label: string }) {
  const fg = '#9a9aaa'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: fg }}>{label}</div>
      <div
        style={{
          height: 110,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${colors.join(', ')})`,
        }}
      />
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
  bg,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  bg: string
}) {
  const fg = bg === 'dark' ? '#e8e8f0' : '#14141a'
  const subFg = bg === 'dark' ? '#9a9aaa' : '#5a5a66'
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ color: fg, fontSize: 18, fontWeight: 600, margin: '0 0 4px 0' }}>{title}</h2>
      {subtitle ? (
        <p style={{ color: subFg, fontSize: 13, margin: '0 0 20px 0' }}>{subtitle}</p>
      ) : (
        <div style={{ height: 16 }} />
      )}
      {children}
    </section>
  )
}

export default function PaletteDemoPage() {
  const [bg, setBg] = useState<'dark' | 'light'>('dark')
  const pageBg = bg === 'dark' ? '#0a0a14' : '#f5f5f7'
  const fg = bg === 'dark' ? '#e8e8f0' : '#14141a'
  const subFg = bg === 'dark' ? '#9a9aaa' : '#5a5a66'
  const border = bg === 'dark' ? '#1f1f2c' : '#e3e3e9'

  const grid8 = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 20,
  } as const

  return (
    <div
      style={{
        background: pageBg,
        color: fg,
        minHeight: '100vh',
        padding: '32px 40px 80px',
        transition: 'background 150ms',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Matter palette — draft</h1>
            <p style={{ color: subFg, fontSize: 14, margin: '4px 0 0' }}>
              8 vibrants on a 45°-spaced wheel, with a muted tier and neutrals. Aurora&apos;s 4
              hues are kept exact.
            </p>
          </div>
          <button
            onClick={() => {
              setBg(bg === 'dark' ? 'light' : 'dark')
            }}
            style={{
              background: 'transparent',
              color: fg,
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {bg === 'dark' ? 'Light bg' : 'Dark bg'}
          </button>
        </header>

        <Section
          title="Vibrant tier"
          subtitle="Used when the effect should sing — Aurora, mesh-gradient, hero shaders."
          bg={bg}
        >
          <div style={grid8}>
            {VIBRANT.map((s) => (
              <SwatchBlock key={s.name} swatch={s} bg={bg} />
            ))}
          </div>
        </Section>

        <Section
          title="Muted tier"
          subtitle="Same 8 hues, ~35–45% saturation. Use when vibrant would compete with the effect (waves, noise-field, busy compositions)."
          bg={bg}
        >
          <div style={grid8}>
            {MUTED.map((s) => (
              <SwatchBlock key={s.name} swatch={s} bg={bg} />
            ))}
          </div>
        </Section>

        <Section
          title="Neutrals"
          subtitle="Anchors. ink/deep for dark backgrounds, paper/cream for light, mid for borders."
          bg={bg}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 20,
            }}
          >
            {NEUTRAL.map((s) => (
              <SwatchBlock key={s.name} swatch={s} bg={bg} />
            ))}
          </div>
        </Section>

        <Section
          title="Adjacent pairs"
          subtitle="What two-stop gradients look like between neighbors on the wheel. The last pair (yellow → lime) closes the loop."
          bg={bg}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PAIRS.map(([from, to]) => (
              <div key={`${from}-${to}`}>
                <div
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11,
                    color: subFg,
                    marginBottom: 4,
                  }}
                >
                  {from} → {to}
                </div>
                <GradientStrip from={from} to={to} />
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Multi-stop compositions"
          subtitle="How the palette behaves when stacked in shader-style gradients."
          bg={bg}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            <MultiStop colors={AURORA_STACK} label="Aurora stack (current default)" />
            <MultiStop colors={WARM_STACK} label="Warm stack (new)" />
            <MultiStop colors={FULL_WHEEL} label="Full wheel (8 stops)" />
          </div>
        </Section>

        <Section
          title="Vibrant on each neutral"
          subtitle="Stress-test: does each vibrant read on both ink and paper?"
          bg={bg}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}
          >
            <div
              style={{
                background: '#0a0a14',
                borderRadius: 10,
                padding: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
              }}
            >
              {VIBRANT.map((s) => (
                <div
                  key={s.name}
                  style={{
                    background: s.hex,
                    height: 56,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11,
                    color: '#0a0a14',
                    fontWeight: 600,
                  }}
                >
                  {s.name}
                </div>
              ))}
            </div>
            <div
              style={{
                background: '#f5f5f7',
                borderRadius: 10,
                padding: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
              }}
            >
              {VIBRANT.map((s) => (
                <div
                  key={s.name}
                  style={{
                    background: s.hex,
                    height: 56,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11,
                    color: '#f5f5f7',
                    fontWeight: 600,
                  }}
                >
                  {s.name}
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Muted on each neutral"
          subtitle="Same stress-test for the muted tier."
          bg={bg}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}
          >
            <div
              style={{
                background: '#0a0a14',
                borderRadius: 10,
                padding: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
              }}
            >
              {MUTED.map((s) => (
                <div
                  key={s.name}
                  style={{
                    background: s.hex,
                    height: 56,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11,
                    color: '#e8e8f0',
                    fontWeight: 600,
                  }}
                >
                  {s.name}
                </div>
              ))}
            </div>
            <div
              style={{
                background: '#f5f5f7',
                borderRadius: 10,
                padding: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
              }}
            >
              {MUTED.map((s) => (
                <div
                  key={s.name}
                  style={{
                    background: s.hex,
                    height: 56,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11,
                    color: '#14141a',
                    fontWeight: 600,
                  }}
                >
                  {s.name}
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
