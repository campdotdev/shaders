'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'
import type { FilmGrainMode } from '@matter/registry/film-grain'

// MatterScene + the registry components pull in three/webgpu, which
// references `self` at module load time and breaks Next's SSR. Load
// everything client-only.
const MatterScene = dynamic(() => import('@lovo/matter-react').then((m) => m.MatterScene), {
  ssr: false,
})
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)
const FilmGrain = dynamic(() => import('@matter/registry/film-grain').then((m) => m.FilmGrain), {
  ssr: false,
})

interface FilmGrainParams {
  intensity: number
  speed: number
  mode: FilmGrainMode
}

const INITIAL: FilmGrainParams = { intensity: 0.45, speed: 1, mode: 'additive' }

// Round to 4 decimals so slider noise (e.g. 0.30000000000000004) doesn't
// leak into the copied snippet.
const fmtNum = (n: number) => String(Math.round(n * 10000) / 10000)

const fmtJsx = (p: FilmGrainParams) =>
  `<MatterScene>
  <LinearGradient />
  <FilmGrain
    intensity={${fmtNum(p.intensity)}}
    speed={${fmtNum(p.speed)}}
    mode="${p.mode}"
  />
</MatterScene>`

const fmtParams = (p: FilmGrainParams) =>
  `{
  intensity: ${fmtNum(p.intensity)},
  speed: ${fmtNum(p.speed)},
  mode: '${p.mode}',
}`

export default function FilmGrainPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<FilmGrainParams>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local: FilmGrainParams = { ...INITIAL }
    const pane = new Pane({ container, title: '<FilmGrain>' })
    const syncToReact = () => setParams({ ...local })

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(local, INITIAL)
      pane.refresh()
      syncToReact()
    })

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

    pane.addBinding(local, 'intensity', { min: 0, max: 1, step: 0.01 })
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 })
    pane.addBinding(local, 'mode', {
      options: { Additive: 'additive', Subtractive: 'subtractive' },
    })

    pane.on('change', () => {
      // FilmGrain's uniforms are stable across re-renders; useAnimatableUniform
      // mutates the uniform .value when the prop changes, so toggling sliders
      // doesn't rebuild the overlay pass. The `mode` binding is structural —
      // it changes the TSL transform shape and triggers a useOverlayPass
      // re-registration via the deps array.
      syncToReact()
    })

    return () => {
      pane.dispose()
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <LinearGradient />
          <FilmGrain intensity={params.intensity} speed={params.speed} mode={params.mode} />
          <VisualTestPause />
        </MatterScene>
        {/* Tweakpane manages its own DOM without ARIA labels. `aria-hidden`
            hides the pane from screen readers; the axe test excludes the
            `.tp-dfwv` subtree so the unlabeled internal controls don't trip
            aria-hidden-focus. The page content in <section> below is the
            accessible surface. */}
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
        <h1 style={{ marginTop: 0 }}>&lt;FilmGrain /&gt;</h1>
        <p>
          Standalone film grain overlay. Stacks inside any <code>&lt;MatterScene&gt;</code> on top
          of whatever base component you want — gradients, noise fields, mesh gradients — and
          applies a layer of animated grain via the post-processing pipeline.
        </p>
        <p>
          <strong>Additive</strong> (default) adds signed grain so half the pixels brighten and half
          darken, preserving average exposure — pure texture, no exposure shift.{' '}
          <strong>Subtractive</strong> takes the absolute value of the grain and subtracts it, so
          the image only darkens. Subtractive simulates silver-halide film stock physics, where
          exposed grain blocks light.
        </p>
        <p>
          <code>speed</code> controls the shutter cadence: <code>1</code> ≈ 60Hz (continuous shimmer
          at 60fps), <code>0.4</code> ≈ 24Hz (chunky film cadence), <code>0</code> freezes the grain
          pattern.
        </p>
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
  <LinearGradient />
  <FilmGrain intensity={0.45} speed={1} mode="additive" />
</MatterScene>`}
        </pre>
      </section>
    </main>
  )
}
