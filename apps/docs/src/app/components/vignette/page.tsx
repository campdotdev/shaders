'use client'

import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'
import dynamic from 'next/dynamic'
import { VisualTestPause } from '@/lib/visualTestHooks'

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
const Vignette = dynamic(() => import('@matter/registry/vignette').then((m) => m.Vignette), {
  ssr: false,
})

interface VignetteParams {
  intensity: number
  softness: number
  centerX: number
  centerY: number
  radius: number
  color: string
  grainOrderFirst: boolean
  grainIntensity: number
}

const INITIAL: VignetteParams = {
  intensity: 0.7,
  softness: 0.5,
  centerX: 0.5,
  centerY: 0.5,
  radius: 0.6,
  color: '#000000',
  grainOrderFirst: true,
  // Default grain is intentionally prominent so the stacking-order
  // toggle is visibly different: at low grain (~0.06) the difference
  // between vignette-attenuated grain and full-amplitude grain is
  // real but imperceptible.
  grainIntensity: 0.3,
}

// Round to 4 decimals so slider noise (e.g. 0.30000000000000004) doesn't
// leak into the copied snippet.
const fmtNum = (n: number) => String(Math.round(n * 10000) / 10000)

const fmtJsx = (p: VignetteParams) => {
  const grain = `<FilmGrain intensity={${fmtNum(p.grainIntensity)}} />`
  const vignette = `<Vignette
    intensity={${fmtNum(p.intensity)}}
    softness={${fmtNum(p.softness)}}
    center={[${fmtNum(p.centerX)}, ${fmtNum(p.centerY)}]}
    radius={${fmtNum(p.radius)}}
    color="${p.color}"
  />`
  return p.grainOrderFirst
    ? `<MatterScene>
  <LinearGradient />
  ${grain}
  ${vignette}
</MatterScene>`
    : `<MatterScene>
  <LinearGradient />
  ${vignette}
  ${grain}
</MatterScene>`
}

const fmtParams = (p: VignetteParams) =>
  `{
  intensity: ${fmtNum(p.intensity)},
  softness: ${fmtNum(p.softness)},
  center: [${fmtNum(p.centerX)}, ${fmtNum(p.centerY)}],
  radius: ${fmtNum(p.radius)},
  color: '${p.color}',
}`

export default function VignettePage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<VignetteParams>(INITIAL)

  useEffect(() => {
    const container = paneContainerRef.current
    if (!container) return
    const local: VignetteParams = { ...INITIAL }
    const pane = new Pane({ container, title: '<Vignette>' })
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
    pane.addBinding(local, 'softness', { min: 0, max: 1, step: 0.01 })
    pane.addBinding(local, 'centerX', { min: 0, max: 1, step: 0.01, label: 'center.x' })
    pane.addBinding(local, 'centerY', { min: 0, max: 1, step: 0.01, label: 'center.y' })
    pane.addBinding(local, 'radius', { min: 0, max: 1.5, step: 0.01 })
    pane.addBinding(local, 'color')

    const stackFolder = pane.addFolder({ title: 'Stack with FilmGrain' })
    stackFolder.addBinding(local, 'grainOrderFirst', { label: 'grain first?' })
    stackFolder.addBinding(local, 'grainIntensity', {
      label: 'grain intensity',
      min: 0,
      max: 0.5,
      step: 0.005,
    })

    pane.on('change', () => {
      // Vignette + FilmGrain uniforms are stable — useAnimatableUniform
      // mutates the uniform .value on prop change, no material recompile.
      // `grainOrderFirst` IS structural: it reorders the children inside
      // <MatterScene>, which changes the post-processing pass sequence
      // (grain-then-vignette vs vignette-then-grain). The MatterScene
      // pipeline rebuilds when its overlay set changes order.
      syncToReact()
    })

    return () => {
      pane.dispose()
    }
  }, [])

  const vignetteEl = (
    <Vignette
      intensity={params.intensity}
      softness={params.softness}
      center={[params.centerX, params.centerY]}
      radius={params.radius}
      color={params.color}
    />
  )
  const grainEl = <FilmGrain intensity={params.grainIntensity} />

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <LinearGradient />
          {params.grainOrderFirst ? (
            <>
              {grainEl}
              {vignetteEl}
            </>
          ) : (
            <>
              {vignetteEl}
              {grainEl}
            </>
          )}
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
        <h1 style={{ marginTop: 0 }}>&lt;Vignette /&gt;</h1>
        <p>
          Radial darkening at the canvas edges. Stacks inside any <code>&lt;MatterScene&gt;</code>{' '}
          on top of whatever base component you want and fades the upstream pixels toward an edge
          color along a soft falloff ring. Unlike <code>&lt;FilmGrain /&gt;</code>, which generates
          new noise from <code>uv</code>, Vignette reads the upstream pixel and mixes it toward{' '}
          <code>color</code> — the {`"read-upstream"`} half of the post-processing pipeline.
        </p>
        <p>
          <strong>Stacking order matters.</strong> The {`"grain first?"`} toggle in the panel swaps
          which overlay runs first. With grain first, the vignette darkens the already-grainy output
          — grain dims in the corners along with everything else. With vignette first, the grain is
          added on top of the already-darkened corners, so grain stays bright even where the image
          is dark. Both are useful looks; the choice is a stylistic call.
        </p>
        <p>
          <code>softness</code> controls how gradual the falloff is. At <code>0</code> the ring is a
          hard cutoff; at <code>1</code> the entire canvas is in the falloff (a smooth radial
          gradient from center to edge). <code>radius</code> is the outer edge of the ring;{' '}
          <code>center</code> is the bright spot in normalized UV space.
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
  <Vignette intensity={0.5} radius={0.6} softness={0.5} />
</MatterScene>`}
        </pre>
      </section>
    </main>
  )
}
