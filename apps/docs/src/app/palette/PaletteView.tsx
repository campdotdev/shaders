'use client'

import { useState } from 'react'

import { palette, paletteOklch } from '@/lib/palette'

const { black, white, gray } = palette
const {
  limeScale: limeScaleOklch,
  lime: limeOklch,
  red: redOklch,
  orange: orangeOklch,
  amber: amberOklch,
  green: greenOklch,
  teal: tealOklch,
  cyan: cyanOklch,
  sky: skyOklch,
  blue: blueOklch,
  violet: violetOklch,
  purple: purpleOklch,
  magenta: magentaOklch,
} = paletteOklch

// ───────────────────────── Accent data ─────────────────────────

interface AccentSteps {
  light: string
  base: string
  dark: string
}
interface AccentEntry {
  name: string
  angle: number
  steps: AccentSteps
  oklch: AccentSteps
}

const ACCENTS: AccentEntry[] = [
  { name: 'red', angle: 25, steps: palette.red, oklch: redOklch },
  { name: 'orange', angle: 55, steps: palette.orange, oklch: orangeOklch },
  { name: 'amber', angle: 85, steps: palette.amber, oklch: amberOklch },
  { name: 'lime', angle: 120, steps: palette.lime, oklch: limeOklch },
  { name: 'green', angle: 145.897, steps: palette.green, oklch: greenOklch },
  { name: 'teal', angle: 175, steps: palette.teal, oklch: tealOklch },
  { name: 'cyan', angle: 205, steps: palette.cyan, oklch: cyanOklch },
  { name: 'sky', angle: 235, steps: palette.sky, oklch: skyOklch },
  { name: 'blue', angle: 265.847, steps: palette.blue, oklch: blueOklch },
  { name: 'violet', angle: 293.328, steps: palette.violet, oklch: violetOklch },
  { name: 'purple', angle: 320, steps: palette.purple, oklch: purpleOklch },
  { name: 'magenta', angle: 343.895, steps: palette.magenta, oklch: magentaOklch },
]

// ───────────────────────── Aurora old → new ─────────────────────────

interface AuroraEntry {
  name: string
  oldHex: string
  newRef: string
  newColor: string
}

const AURORA: AuroraEntry[] = [
  { name: 'green', oldHex: '#09E24B', newRef: 'green.base', newColor: greenOklch.base },
  { name: 'blue', oldHex: '#1837E6', newRef: 'blue.base', newColor: blueOklch.base },
  { name: 'violet', oldHex: '#661ACC', newRef: 'violet.base', newColor: violetOklch.base },
  { name: 'magenta', oldHex: '#CC1A99', newRef: 'magenta.base', newColor: magentaOklch.base },
]

// ───────────────────────── Components ─────────────────────────

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
  const fg = bg === 'dark' ? white : black
  const subFg = bg === 'dark' ? gray[7] : gray[6]

  return (
    <section style={{ marginBottom: 56 }}>
      <h2 style={{ color: fg, fontSize: 18, fontWeight: 600, margin: '0 0 4px 0' }}>{title}</h2>
      {subtitle !== undefined && subtitle !== '' ? (
        <p style={{ color: subFg, fontSize: 13, margin: '0 0 20px 0' }}>{subtitle}</p>
      ) : (
        <div style={{ height: 16 }} />
      )}
      {children}
    </section>
  )
}

function ScaleRow({
  name,
  sub,
  hexes,
  bg,
  brandStep,
}: {
  name: string
  sub?: string
  hexes: readonly string[]
  bg: string
  brandStep?: number
}) {
  const fg = bg === 'dark' ? white : black
  const subFg = bg === 'dark' ? gray[7] : gray[6]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: 16,
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: fg }}>{name}</div>
        {sub !== undefined && sub !== '' ? (
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: subFg }}>
            {sub}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
        {hexes.map((color, i) => {
          const stepNum = i + 1
          const ringed = brandStep === stepNum

          return (
            <div
              key={`${name}-${stepNum}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              title={`${name} / ${stepNum} · ${color}`}
            >
              <div
                style={{
                  background: color,
                  height: 42,
                  borderRadius: 4,
                  border: ringed ? `1px solid ${fg}` : 'none',
                  outline: ringed ? `2px solid ${color}` : 'none',
                  outlineOffset: 2,
                }}
              />
              <div
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 9,
                  color: subFg,
                  textAlign: 'center',
                }}
              >
                {stepNum}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ColorBlock({
  color,
  label,
  sub,
  bg,
  height = 88,
}: {
  color: string
  label: string
  sub?: string
  bg: string
  height?: number
}) {
  const fg = bg === 'dark' ? white : black
  const subFg = bg === 'dark' ? gray[7] : gray[6]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          background: color,
          height,
          borderRadius: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 600, color: fg }}>{label}</div>
      {sub !== undefined && sub !== '' ? (
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: subFg }}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

function GradientBlock({
  colors,
  label,
  bg,
  height = 110,
}: {
  colors: string[]
  label: string
  bg: string
  height?: number
}) {
  const subFg = bg === 'dark' ? gray[7] : gray[6]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: subFg }}>{label}</div>
      <div
        style={{
          height,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${colors.join(', ')})`,
        }}
      />
    </div>
  )
}

function AccentTriad({ accent, bg }: { accent: AccentEntry; bg: string }) {
  const fg = bg === 'dark' ? white : black
  const subFg = bg === 'dark' ? gray[7] : gray[6]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: fg }}>{accent.name}</div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: subFg }}>
          h={accent.angle}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {(
          [
            { label: 'light', color: accent.oklch.light },
            { label: 'base', color: accent.oklch.base },
            { label: 'dark', color: accent.oklch.dark },
          ] as const
        ).map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                background: color,
                height: 64,
                borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}
              title={color}
            />
            <div style={{ fontSize: 11, color: subFg, textAlign: 'center' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Page ─────────────────────────

export function PaletteView() {
  const [bg, setBg] = useState<'dark' | 'light'>('dark')
  const pageBg = bg === 'dark' ? black : white
  const fg = bg === 'dark' ? white : black
  const subFg = bg === 'dark' ? gray[7] : gray[6]
  const border = bg === 'dark' ? gray[2] : gray[10]

  const auroraOld = AURORA.map((a) => a.oldHex)
  const auroraNew = AURORA.map((a) => a.newColor)

  // Brand lime mid step (index 9 of the 12-step brand scale = #A3C100)
  const brandLimeMid = limeScaleOklch[9]

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
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Matter palette</h1>
            <p style={{ color: subFg, fontSize: 14, margin: '4px 0 0' }}>
              Brand lime + gray keep their full 12-step scales. Other colors get just three steps:
              dark, mid (most vibrant), light.
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
        {/* ── Brand foundation ── */}
        <Section
          bg={bg}
          subtitle="Brand lime and brand gray keep their full 12-step scales because they're used broadly across the site (chrome, type, panels, accents). Brand black/white are the page anchors."
          title="Brand foundation"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ScaleRow bg={bg} hexes={gray} name="gray" sub="brand" />
            <ScaleRow
              bg={bg}
              brandStep={10}
              hexes={limeScaleOklch}
              name="limeScale"
              sub="brand · h=120 · 12 steps"
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 20,
              marginTop: 24,
            }}
          >
            <ColorBlock bg={bg} color={black} label="black" sub={black} />
            <ColorBlock bg={bg} color={white} label="white" sub={white} />
          </div>
        </Section>
        {/* ── Accent palette ── */}
        <Section
          bg={bg}
          subtitle="Hand-tuned in OKLCH so `base` lands at or near Aurora's vibrancy. The four Aurora-anchored hues (green/blue/violet/magenta) match Aurora's original hexes within 1 byte by design."
          title="Accent palette — 12 hues × light / base / dark"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
            {ACCENTS.map((a) => (
              <AccentTriad accent={a} bg={bg} key={a.name} />
            ))}
          </div>
        </Section>
        {/* ── Aurora comparison ── */}
        <Section
          bg={bg}
          subtitle="The with-depth variant: dark-step picks for blue and violet preserve Aurora's bright-top / deep-bottoms feel."
          title="Aurora — old vs new defaults"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {AURORA.map((a) => (
                <div key={a.name} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <ColorBlock bg={bg} color={a.oldHex} label={`${a.name} (old)`} sub={a.oldHex} />
                  <ColorBlock bg={bg} color={a.newColor} label="new defaults" sub={a.newRef} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <GradientBlock bg={bg} colors={auroraOld} label="Aurora stack (old)" />
              <GradientBlock bg={bg} colors={auroraNew} label="Aurora stack (new defaults)" />
            </div>
          </div>
        </Section>
        {/* ── Sample compositions ── */}
        <Section
          bg={bg}
          subtitle="A few useful gradients drawn from the palette."
          title="Sample compositions"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <GradientBlock
              bg={bg}
              colors={[black, brandLimeMid, white]}
              label="Brand identity: ink → lime → paper"
            />
            <GradientBlock
              bg={bg}
              colors={[violetOklch.dark, blueOklch.base, brandLimeMid]}
              label="Cool ramp: violet/dark → blue/base → brand lime"
            />
            <GradientBlock
              bg={bg}
              colors={[magentaOklch.dark, magentaOklch.base, amberOklch.base]}
              label="Warm ramp: magenta/dark → magenta/base → amber/base"
            />
            <GradientBlock
              bg={bg}
              colors={[blueOklch.light, violetOklch.light, magentaOklch.light]}
              label="Soft pastel: blue/light → violet/light → magenta/light"
            />
            <GradientBlock
              bg={bg}
              colors={[limeScaleOklch[3], limeScaleOklch[6], limeScaleOklch[9]]}
              label="Brand lime scale ramp (steps 4 → 7 → 10)"
            />
            <GradientBlock
              bg={bg}
              colors={[
                redOklch.base,
                orangeOklch.base,
                amberOklch.base,
                limeOklch.base,
                brandLimeMid,
                greenOklch.base,
                tealOklch.base,
                cyanOklch.base,
                skyOklch.base,
                blueOklch.base,
                violetOklch.base,
                purpleOklch.base,
                magentaOklch.base,
              ]}
              label="All bases around the wheel"
            />
          </div>
        </Section>
        {/* ── Stress test ── */}
        <Section
          bg={bg}
          subtitle="Stress test — do all 12 base accents and brand lime read on both brand backgrounds?"
          title="Bases on ink + paper"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {([black, white] as const).map((bgColor) => (
              <div
                key={bgColor}
                style={{
                  background: bgColor,
                  borderRadius: 10,
                  padding: 20,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 10,
                }}
              >
                {[
                  { name: 'lime', color: brandLimeMid },
                  ...ACCENTS.map((a) => ({ name: a.name, color: a.oklch.base })),
                ].map(({ name: chipName, color }) => (
                  <div
                    key={chipName}
                    style={{
                      background: color,
                      height: 56,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 10,
                      color: bgColor === black ? black : white,
                      fontWeight: 600,
                    }}
                  >
                    {chipName}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
