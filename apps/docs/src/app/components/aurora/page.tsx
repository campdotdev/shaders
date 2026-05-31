// apps/docs/app/components/aurora/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'
import { palette } from '@/lib/palette'
import type { AuroraDirection } from '@matter/registry/aurora'

// Plain (non-signal) per-layer state for tweakpane. Numbers are assignable
// to AnimatableProp<number> at the prop boundary so we hand this straight
// to <Aurora> without conversion.
interface PlainAuroraLayer {
  hex: string
  speed: number
  intensity: number
  variation: number
}

// Both MatterScene and Aurora pull in three/webgpu (via createRenderer),
// which references `self` at module load time and breaks Next's SSR. Load
// both client-only.
const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const Aurora = dynamic(() => import('@matter/registry/aurora').then((m) => m.Aurora), {
  ssr: false,
})

interface AuroraParams {
  intensity: number
  speed: number
  densityX: number
  densityY: number
  falloff: number
  driftX: number
  driftY: number
  turbulence: number
  direction: AuroraDirection
  horizonColor: string
  skyColor: string
  layers: [PlainAuroraLayer, PlainAuroraLayer, PlainAuroraLayer, PlainAuroraLayer]
}

const INITIAL: AuroraParams = {
  intensity: 1,
  speed: 0.6,
  densityX: 1.35,
  densityY: 5.35,
  falloff: 1.1,
  driftX: 0.2,
  driftY: -3.15,
  turbulence: 1.3,
  direction: 'top',
  horizonColor: '#040009',
  skyColor: '#146389',
  layers: [
    { hex: palette.green.base, speed: 0.07, intensity: 0.6, variation: 0 },
    { hex: palette.blue.base, speed: 0.1, intensity: 0, variation: 5 },
    { hex: palette.violet.base, speed: 0.15, intensity: 0.3, variation: 11 },
    { hex: palette.magenta.base, speed: 0.07, intensity: 0, variation: 17 },
  ],
}

const LAYER_TITLES = ['Layer 0 (back)', 'Layer 1', 'Layer 2', 'Layer 3 (front)']

// Round to 4 decimals so slider noise (e.g. 0.30000000000000004) doesn't
// leak into the copied snippet, but stop short of losing precision the
// user actually cares about.
const fmtNum = (n: number) => {
  const r = Math.round(n * 10000) / 10000
  return String(r)
}

const fmtLayer = (l: PlainAuroraLayer) =>
  `{ hex: '${l.hex}', speed: ${fmtNum(l.speed)}, intensity: ${fmtNum(l.intensity)}, variation: ${fmtNum(l.variation)} }`

const fmtJsx = (p: AuroraParams) =>
  `<MatterScene>
  <Aurora
    intensity={${fmtNum(p.intensity)}}
    speed={${fmtNum(p.speed)}}
    densityX={${fmtNum(p.densityX)}}
    densityY={${fmtNum(p.densityY)}}
    falloff={${fmtNum(p.falloff)}}
    driftX={${fmtNum(p.driftX)}}
    driftY={${fmtNum(p.driftY)}}
    turbulence={${fmtNum(p.turbulence)}}
    direction="${p.direction}"
    horizonColor="${p.horizonColor}"
    skyColor="${p.skyColor}"
    layers={[
      ${fmtLayer(p.layers[0])},
      ${fmtLayer(p.layers[1])},
      ${fmtLayer(p.layers[2])},
      ${fmtLayer(p.layers[3])},
    ]}
  />
</MatterScene>`

const fmtParams = (p: AuroraParams) =>
  `{
  intensity: ${fmtNum(p.intensity)},
  speed: ${fmtNum(p.speed)},
  densityX: ${fmtNum(p.densityX)},
  densityY: ${fmtNum(p.densityY)},
  falloff: ${fmtNum(p.falloff)},
  driftX: ${fmtNum(p.driftX)},
  driftY: ${fmtNum(p.driftY)},
  turbulence: ${fmtNum(p.turbulence)},
  direction: '${p.direction}',
  horizonColor: '${p.horizonColor}',
  skyColor: '${p.skyColor}',
  layers: [
    ${fmtLayer(p.layers[0])},
    ${fmtLayer(p.layers[1])},
    ${fmtLayer(p.layers[2])},
    ${fmtLayer(p.layers[3])},
  ],
}`

export default function AuroraPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<AuroraParams>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    // Tweakpane mutates `local` in place; we sync to React state on `change`.
    const local: AuroraParams = JSON.parse(JSON.stringify(INITIAL))

    const pane = new Pane({ container, title: '<Aurora>' })
    const syncToReact = () => setParams(JSON.parse(JSON.stringify(local)))

    // Remembered pre-mute intensity per layer, so Unmute can restore.
    const savedIntensities: number[] = INITIAL.layers.map((l) => l.intensity)
    const muteBtns: Array<{ title: string } | null> = [null, null, null, null]

    const resetGlobals = () => {
      local.intensity = INITIAL.intensity
      local.speed = INITIAL.speed
      local.densityX = INITIAL.densityX
      local.densityY = INITIAL.densityY
      local.falloff = INITIAL.falloff
      local.driftX = INITIAL.driftX
      local.driftY = INITIAL.driftY
      local.turbulence = INITIAL.turbulence
      local.direction = INITIAL.direction
      local.horizonColor = INITIAL.horizonColor
      local.skyColor = INITIAL.skyColor
    }

    const resetLayer = (i: number) => {
      Object.assign(local.layers[i]!, INITIAL.layers[i]!)
      savedIntensities[i] = INITIAL.layers[i]!.intensity
      const btn = muteBtns[i]
      if (btn) btn.title = 'Mute layer'
    }

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      resetGlobals()
      for (let i = 0; i < 4; i++) resetLayer(i)
      pane.refresh()
      syncToReact()
    })

    // Briefly toast "Copied!" on the button itself after a successful copy.
    // Clipboard API works in secure contexts (localhost is secure in dev).
    const flashCopied = (btn: { title: string }, original: string) => {
      btn.title = 'Copied!'
      pane.refresh()
      setTimeout(() => {
        btn.title = original
        pane.refresh()
      }, 1200)
    }
    const jsxBtn = pane.addButton({ title: 'Copy JSX' })
    jsxBtn.on('click', () => {
      void navigator.clipboard.writeText(fmtJsx(local)).then(() => flashCopied(jsxBtn, 'Copy JSX'))
    })
    const paramsBtn = pane.addButton({ title: 'Copy params' })
    paramsBtn.on('click', () => {
      void navigator.clipboard
        .writeText(fmtParams(local))
        .then(() => flashCopied(paramsBtn, 'Copy params'))
    })

    pane.addBlade({ view: 'separator' })

    const globals = pane.addFolder({ title: 'Global' })
    globals.addBinding(local, 'intensity', { min: 0, max: 3, step: 0.01 })
    globals.addBinding(local, 'speed', { min: 0, max: 3, step: 0.01 })
    globals.addBinding(local, 'densityX', { label: 'density X', min: 0.5, max: 10, step: 0.05 })
    globals.addBinding(local, 'densityY', { label: 'density Y', min: 0.5, max: 10, step: 0.05 })
    globals.addBinding(local, 'falloff', { min: 0, max: 2, step: 0.01 })
    globals.addBinding(local, 'driftX', { label: 'drift X', min: -5, max: 5, step: 0.05 })
    globals.addBinding(local, 'driftY', { label: 'drift Y', min: -5, max: 5, step: 0.05 })
    globals.addBinding(local, 'turbulence', { min: 0, max: 3, step: 0.01 })
    globals.addBinding(local, 'direction', {
      label: 'from',
      options: { Bottom: 'bottom', Top: 'top', Left: 'left', Right: 'right' },
    })
    globals.addBinding(local, 'horizonColor', { label: 'horizon' })
    globals.addBinding(local, 'skyColor', { label: 'sky' })

    for (let i = 0; i < 4; i++) {
      const folder = pane.addFolder({
        title: LAYER_TITLES[i]!,
        expanded: i === 0,
      })
      const layer = local.layers[i]!

      const muteBtn = folder.addButton({
        title: layer.intensity > 0 ? 'Mute layer' : 'Unmute layer',
      })
      muteBtns[i] = muteBtn
      muteBtn.on('click', () => {
        if (layer.intensity > 0) {
          savedIntensities[i] = layer.intensity
          layer.intensity = 0
          muteBtn.title = 'Unmute layer'
        } else {
          const restore = savedIntensities[i] ?? INITIAL.layers[i]!.intensity
          layer.intensity = restore > 0 ? restore : INITIAL.layers[i]!.intensity
          muteBtn.title = 'Mute layer'
        }
        pane.refresh()
        syncToReact()
      })

      folder.addBinding(layer, 'hex', { label: 'color' })
      folder.addBinding(layer, 'speed', { min: 0, max: 0.5, step: 0.005 })
      folder.addBinding(layer, 'intensity', { min: 0, max: 1, step: 0.01 })

      folder.addButton({ title: 'Reset layer' }).on('click', () => {
        resetLayer(i)
        pane.refresh()
        syncToReact()
      })
    }

    pane.on('change', () => {
      // Sync to React. Aurora's uniforms are stable across re-renders;
      // useAnimatableUniform mutates the uniform .value when the prop
      // changes, so the material is never rebuilt for a slider tick.
      syncToReact()
    })

    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <MatterScene>
          <Aurora
            intensity={params.intensity}
            speed={params.speed}
            densityX={params.densityX}
            densityY={params.densityY}
            falloff={params.falloff}
            driftX={params.driftX}
            driftY={params.driftY}
            turbulence={params.turbulence}
            direction={params.direction}
            horizonColor={params.horizonColor}
            skyColor={params.skyColor}
            layers={params.layers}
          />
          <VisualTestPause />
        </MatterScene>
        {/* Tweakpane lives inside the preview so it's part of the same
            stacking context — fullscreening the preview takes the panel
            with it. `absolute` positions against the preview's top-right.
            Tweakpane manages its own DOM without ARIA labels. `aria-hidden`
            hides the pane from screen readers; the axe test excludes the
            `.tp-dfwv` subtree so the unlabeled internal controls don't trip
            aria-hidden-focus. The page content in <section> below is the
            accessible surface. (`inert` would have blocked mouse input too —
            regression noted 2026-05-13.) */}
        <div
          ref={paneContainerRef}
          data-tweakpane-host
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            width: '320px',
            maxHeight: 'calc(100% - 2rem)',
            overflowY: 'auto',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;Aurora /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {`<MatterScene>
  <Aurora intensity={1} falloff={0.6} layers={[...]} />
</MatterScene>`}
        </pre>
      </section>
    </main>
  )
}
