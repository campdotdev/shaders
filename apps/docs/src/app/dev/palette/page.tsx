'use client'

import { useState } from 'react'

// ───────────────────────── Brand foundation ─────────────────────────
const BRAND_BLACK = '#0B0F0D'
const BRAND_WHITE = '#E7E9E7'

const BRAND_GRAY: string[] = [
  '#0B0F0D',
  '#131614',
  '#202421',
  '#2B302D',
  '#363B38',
  '#424844',
  '#535A55',
  '#6D736E',
  '#8B918C',
  '#A1A6A1',
  '#D0D3CF',
  '#E7E9E7',
]

const BRAND_LIME: string[] = [
  '#111505',
  '#171C04',
  '#242E00',
  '#2F3C00',
  '#3A4A00',
  '#465900',
  '#576E00',
  '#6E8A00',
  '#91AF00',
  '#A3C100', // step 10 — brand lime
  '#CCE288',
  '#E3F0BD',
]

// ───────────────────────── Accent palette (dark / mid / light per hue) ─────────────────────────
// 4 non-lime hues. Each exposed at 3 steps from the OKLCH master:
//   dark  = step 4   (L≈0.33, deep)
//   mid   = step 10  (L≈0.69, brand-lime equivalence — most vibrant)
//   light = step 11  (L≈0.85, light tint)
type Accent = { name: string; angle: number; dark: string; mid: string; light: string }

const ACCENTS: Accent[] = [
  {
    name: 'amber',
    angle: 75,
    dark: 'oklch(0.338 0.100 75)',
    mid: 'oklch(0.788 0.177 75)',
    light: 'oklch(0.894 0.110 75)',
  },
  {
    name: 'blue',
    angle: 252,
    dark: 'oklch(0.328 0.107 252)',
    mid: 'oklch(0.682 0.176 252)',
    light: 'oklch(0.849 0.107 252)',
  },
  {
    name: 'violet',
    angle: 295,
    dark: 'oklch(0.330 0.105 295)',
    mid: 'oklch(0.690 0.174 295)',
    light: 'oklch(0.853 0.107 295)',
  },
  {
    name: 'pink',
    angle: 343,
    dark: 'oklch(0.333 0.103 343)',
    mid: 'oklch(0.694 0.174 343)',
    light: 'oklch(0.857 0.107 343)',
  },
]

const BRAND_LIME_MID = BRAND_LIME[9]! // step 10 (zero-indexed 9)

// ───────────────────────── Aurora old → new mapping ─────────────────────────
type AuroraMap = {
  name: string
  oldHex: string
  uniformRef: string
  uniformColor: string
  depthRef: string
  depthColor: string
}
const AURORA_MAP: AuroraMap[] = [
  {
    name: 'green',
    oldHex: '#09E24B',
    uniformRef: 'lime / 10',
    uniformColor: BRAND_LIME_MID,
    depthRef: 'lime / 10',
    depthColor: BRAND_LIME_MID,
  },
  {
    name: 'blue',
    oldHex: '#1837E6',
    uniformRef: 'blue / mid',
    uniformColor: ACCENTS[1]!.mid,
    depthRef: 'blue / dark',
    depthColor: ACCENTS[1]!.dark,
  },
  {
    name: 'violet',
    oldHex: '#661ACC',
    uniformRef: 'violet / mid',
    uniformColor: ACCENTS[2]!.mid,
    depthRef: 'violet / dark',
    depthColor: ACCENTS[2]!.dark,
  },
  {
    name: 'pink',
    oldHex: '#CC1A99',
    uniformRef: 'pink / mid',
    uniformColor: ACCENTS[3]!.mid,
    depthRef: 'pink / mid',
    depthColor: ACCENTS[3]!.mid,
  },
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
  const fg = bg === 'dark' ? BRAND_WHITE : BRAND_BLACK
  const subFg = bg === 'dark' ? '#8B918C' : '#535A55'
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
  hexes: string[]
  bg: string
  brandStep?: number
}) {
  const fg = bg === 'dark' ? BRAND_WHITE : BRAND_BLACK
  const subFg = bg === 'dark' ? '#8B918C' : '#535A55'
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
  const fg = bg === 'dark' ? BRAND_WHITE : BRAND_BLACK
  const subFg = bg === 'dark' ? '#8B918C' : '#535A55'
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
  const subFg = bg === 'dark' ? '#8B918C' : '#535A55'
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

function AccentTriad({ accent, bg }: { accent: Accent; bg: string }) {
  const fg = bg === 'dark' ? BRAND_WHITE : BRAND_BLACK
  const subFg = bg === 'dark' ? '#8B918C' : '#535A55'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: fg }}>{accent.name}</div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: subFg }}>
          h={accent.angle}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'dark', color: accent.dark },
          { label: 'mid', color: accent.mid },
          { label: 'light', color: accent.light },
        ].map((step) => (
          <div key={step.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                background: step.color,
                height: 64,
                borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}
              title={step.color}
            />
            <div style={{ fontSize: 11, color: subFg, textAlign: 'center' }}>{step.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PaletteDemoPage() {
  const [bg, setBg] = useState<'dark' | 'light'>('dark')
  const pageBg = bg === 'dark' ? BRAND_BLACK : BRAND_WHITE
  const fg = bg === 'dark' ? BRAND_WHITE : BRAND_BLACK
  const subFg = bg === 'dark' ? '#8B918C' : '#535A55'
  const border = bg === 'dark' ? '#202421' : '#D0D3CF'

  const auroraOld = AURORA_MAP.map((a) => a.oldHex)
  const auroraUniform = AURORA_MAP.map((a) => a.uniformColor)
  const auroraDepth = AURORA_MAP.map((a) => a.depthColor)

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
              Matter palette — slim system draft
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

        <Section
          title="Brand foundation"
          subtitle="Brand lime and brand gray keep their full 12-step scales because they're used broadly across the site (chrome, type, panels, accents). Brand black/white are the page anchors."
          bg={bg}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ScaleRow name="gray" sub="brand" hexes={BRAND_GRAY} bg={bg} />
            <ScaleRow name="lime" sub="brand · h=120" hexes={BRAND_LIME} bg={bg} brandStep={10} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginTop: 24 }}>
            <ColorBlock color={BRAND_BLACK} label="black" sub={BRAND_BLACK} bg={bg} />
            <ColorBlock color={BRAND_WHITE} label="white" sub={BRAND_WHITE} bg={bg} />
          </div>
        </Section>

        <Section
          title="Accent palette — 4 hues × 3 steps"
          subtitle="Sampled from the OKLCH system at dark (step 4), mid (step 10, brand-lime equivalence — the most vibrant), and light (step 11). 4 hues feels like the right mix: one warm, two cool, one accent. Easy to drop to 3 if you'd prefer."
          bg={bg}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 28 }}>
            {ACCENTS.map((a) => (
              <AccentTriad key={a.name} accent={a} bg={bg} />
            ))}
          </div>
        </Section>

        <Section
          title="Aurora — old vs two new variants"
          subtitle="Two ways to remap Aurora into the slim palette. Uniform-mid is polished/vibrant; with-depth borrows dark-step picks for blue and violet to preserve Aurora's bright-top / deep-bottoms feel."
          bg={bg}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {AURORA_MAP.map((a) => (
                <div key={a.name} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <ColorBlock color={a.oldHex} label={`${a.name} (old)`} sub={a.oldHex} bg={bg} />
                  <ColorBlock
                    color={a.uniformColor}
                    label="uniform-mid"
                    sub={a.uniformRef}
                    bg={bg}
                  />
                  <ColorBlock
                    color={a.depthColor}
                    label="with-depth"
                    sub={a.depthRef}
                    bg={bg}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <GradientBlock colors={auroraOld} label="Aurora stack (old)" bg={bg} />
              <GradientBlock
                colors={auroraUniform}
                label="Aurora stack (uniform-mid)"
                bg={bg}
              />
              <GradientBlock
                colors={auroraDepth}
                label="Aurora stack (with-depth)"
                bg={bg}
              />
            </div>
          </div>
        </Section>

        <Section
          title="Sample compositions"
          subtitle="A few useful gradients drawn from the slim palette."
          bg={bg}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <GradientBlock
              colors={[BRAND_BLACK, BRAND_LIME_MID, BRAND_WHITE]}
              label="Brand identity: ink → lime → paper"
              bg={bg}
            />
            <GradientBlock
              colors={[ACCENTS[2]!.dark, ACCENTS[1]!.mid, BRAND_LIME_MID]}
              label="Cool ramp: violet/dark → blue/mid → lime/mid"
              bg={bg}
            />
            <GradientBlock
              colors={[ACCENTS[3]!.dark, ACCENTS[3]!.mid, ACCENTS[0]!.mid]}
              label="Warm ramp: pink/dark → pink/mid → amber/mid"
              bg={bg}
            />
            <GradientBlock
              colors={[ACCENTS[1]!.light, ACCENTS[2]!.light, ACCENTS[3]!.light]}
              label="Soft pastel: blue/light → violet/light → pink/light"
              bg={bg}
            />
            <GradientBlock
              colors={[BRAND_LIME[3]!, BRAND_LIME[6]!, BRAND_LIME[9]!]}
              label="Brand lime ramp (full scale, steps 4 → 7 → 10)"
              bg={bg}
            />
            <GradientBlock
              colors={[ACCENTS[0]!.mid, BRAND_LIME_MID, ACCENTS[1]!.mid, ACCENTS[2]!.mid, ACCENTS[3]!.mid]}
              label="All mids: amber → lime → blue → violet → pink"
              bg={bg}
            />
          </div>
        </Section>

        <Section
          title="Mids on ink + paper"
          subtitle="Stress test — do the four mid accents and brand lime read on both brand backgrounds?"
          bg={bg}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[BRAND_BLACK, BRAND_WHITE].map((bgColor) => (
              <div
                key={bgColor}
                style={{
                  background: bgColor,
                  borderRadius: 10,
                  padding: 20,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 10,
                }}
              >
                {[
                  { name: 'lime', color: BRAND_LIME_MID },
                  ...ACCENTS.map((a) => ({ name: a.name, color: a.mid })),
                ].map((s) => (
                  <div
                    key={s.name}
                    style={{
                      background: s.color,
                      height: 56,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 11,
                      color: bgColor === BRAND_BLACK ? BRAND_BLACK : BRAND_WHITE,
                      fontWeight: 600,
                    }}
                  >
                    {s.name}
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
