'use client'

import { useState } from 'react'
import { palette, paletteOklch } from '@/lib/palette'

const { black, white, gray, lime } = palette
const {
  lime: limeOklch,
  crimson: crimsonOklch,
  red: redOklch,
  orange: orangeOklch,
  amber: amberOklch,
  gold: goldOklch,
  green: greenOklch,
  emerald: emeraldOklch,
  teal: tealOklch,
  sky: skyOklch,
  blue: blueOklch,
  indigo: indigoOklch,
  violet: violetOklch,
  pink: pinkOklch,
} = paletteOklch

// ───────────────────────── Accent data ─────────────────────────

type AccentSteps = { dark: string; mid: string; light: string }
type AccentEntry = { name: string; angle: number; steps: AccentSteps; oklch: AccentSteps }

const ACCENTS: AccentEntry[] = [
  { name: 'crimson', angle: 17,  steps: palette.crimson, oklch: crimsonOklch },
  { name: 'red',     angle: 25,  steps: palette.red,     oklch: redOklch },
  { name: 'orange',  angle: 55,  steps: palette.orange,  oklch: orangeOklch },
  { name: 'amber',   angle: 75,  steps: palette.amber,   oklch: amberOklch },
  { name: 'gold',    angle: 91,  steps: palette.gold,    oklch: goldOklch },
  { name: 'green',   angle: 145, steps: palette.green,   oklch: greenOklch },
  { name: 'emerald', angle: 165, steps: palette.emerald, oklch: emeraldOklch },
  { name: 'teal',    angle: 180, steps: palette.teal,    oklch: tealOklch },
  { name: 'sky',     angle: 210, steps: palette.sky,     oklch: skyOklch },
  { name: 'blue',    angle: 252, steps: palette.blue,    oklch: blueOklch },
  { name: 'indigo',  angle: 275, steps: palette.indigo,  oklch: indigoOklch },
  { name: 'violet',  angle: 295, steps: palette.violet,  oklch: violetOklch },
  { name: 'pink',    angle: 343, steps: palette.pink,    oklch: pinkOklch },
]

// ───────────────────────── Aurora old → new (with-depth / "new defaults") ─────────────────────────

type AuroraEntry = { name: string; oldHex: string; newRef: string; newColor: string }

const AURORA: AuroraEntry[] = [
  { name: 'green',  oldHex: '#09E24B', newRef: 'lime[9]',     newColor: limeOklch[9] },
  { name: 'blue',   oldHex: '#1837E6', newRef: 'blue.dark',   newColor: blueOklch.dark },
  { name: 'violet', oldHex: '#661ACC', newRef: 'violet.dark', newColor: violetOklch.dark },
  { name: 'pink',   oldHex: '#CC1A99', newRef: 'pink.mid',    newColor: pinkOklch.mid },
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
      {subtitle ? (
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
        {sub ? (
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
              title={`${name} / ${stepNum} · ${color}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
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
      {sub ? (
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
            { label: 'dark',  color: accent.oklch.dark },
            { label: 'mid',   color: accent.oklch.mid },
            { label: 'light', color: accent.oklch.light },
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

  // Grab OKLCH lime[9] for sample compositions (brand step)
  const limeMid = limeOklch[9]

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
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
              Matter palette
            </h1>
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
          title="Brand foundation"
          subtitle="Brand lime and brand gray keep their full 12-step scales because they're used broadly across the site (chrome, type, panels, accents). Brand black/white are the page anchors."
          bg={bg}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ScaleRow name="gray" sub="brand" hexes={gray} bg={bg} />
            <ScaleRow
              name="lime"
              sub="brand · h=120"
              hexes={limeOklch}
              bg={bg}
              brandStep={10}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginTop: 24 }}>
            <ColorBlock color={black} label="black" sub={black} bg={bg} />
            <ColorBlock color={white} label="white" sub={white} bg={bg} />
          </div>
        </Section>

        {/* ── Accent palette ── */}
        <Section
          title="Accent palette — 13 hues × 3 steps"
          subtitle="Sampled from the OKLCH system at dark (step 4), mid (step 10, most vibrant), and light (step 11). All 13 accent hues from the OKLCH color system, in hue-angle order."
          bg={bg}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
            {ACCENTS.map((a) => (
              <AccentTriad key={a.name} accent={a} bg={bg} />
            ))}
          </div>
        </Section>

        {/* ── Aurora comparison ── */}
        <Section
          title="Aurora — old vs new defaults"
          subtitle="The with-depth variant: dark-step picks for blue and violet preserve Aurora's bright-top / deep-bottoms feel."
          bg={bg}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {AURORA.map((a) => (
                <div key={a.name} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <ColorBlock color={a.oldHex} label={`${a.name} (old)`} sub={a.oldHex} bg={bg} />
                  <ColorBlock
                    color={a.newColor}
                    label="new defaults"
                    sub={a.newRef}
                    bg={bg}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <GradientBlock colors={auroraOld} label="Aurora stack (old)" bg={bg} />
              <GradientBlock colors={auroraNew} label="Aurora stack (new defaults)" bg={bg} />
            </div>
          </div>
        </Section>

        {/* ── Sample compositions ── */}
        <Section
          title="Sample compositions"
          subtitle="A few useful gradients drawn from the palette."
          bg={bg}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <GradientBlock
              colors={[black, limeMid, white]}
              label="Brand identity: ink → lime → paper"
              bg={bg}
            />
            <GradientBlock
              colors={[violetOklch.dark, blueOklch.mid, limeMid]}
              label="Cool ramp: violet/dark → blue/mid → lime/mid"
              bg={bg}
            />
            <GradientBlock
              colors={[pinkOklch.dark, pinkOklch.mid, amberOklch.mid]}
              label="Warm ramp: pink/dark → pink/mid → amber/mid"
              bg={bg}
            />
            <GradientBlock
              colors={[blueOklch.light, violetOklch.light, pinkOklch.light]}
              label="Soft pastel: blue/light → violet/light → pink/light"
              bg={bg}
            />
            <GradientBlock
              colors={[limeOklch[3], limeOklch[6], limeOklch[9]]}
              label="Brand lime ramp (full scale, steps 4 → 7 → 10)"
              bg={bg}
            />
            <GradientBlock
              colors={[
                crimsonOklch.mid, orangeOklch.mid, amberOklch.mid, limeMid,
                tealOklch.mid, blueOklch.mid, violetOklch.mid, pinkOklch.mid,
              ]}
              label="All mids around the wheel"
              bg={bg}
            />
          </div>
        </Section>

        {/* ── Stress test ── */}
        <Section
          title="Mids on ink + paper"
          subtitle="Stress test — do all 13 mid accents and brand lime read on both brand backgrounds?"
          bg={bg}
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
                  { name: 'lime',    color: limeMid },
                  ...ACCENTS.map((a) => ({ name: a.name, color: a.oklch.mid })),
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
