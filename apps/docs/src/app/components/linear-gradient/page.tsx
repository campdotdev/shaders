'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { Pane } from 'tweakpane'

import { palette } from '@/lib/palette'
import { addCopyButtons } from '@/lib/paneUtils'
import { VisualTestPause } from '@/lib/visualTestHooks'

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
})
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)

interface Stop {
  color: string
}

interface Params {
  angle: number
  speed: number
  focalX: number
  focalY: number
  stops: Stop[]
}

const MIN_STOPS = 1
const MAX_STOPS = 6

const INITIAL: Params = {
  angle: 90,
  speed: 0,
  focalX: 0.5,
  focalY: 0.5,
  stops: [
    { color: palette.violet.base },
    { color: palette.purple.base },
    { color: palette.magenta.dark },
  ],
}

const fmtNum = (n: number) => String(Math.round(n * 10000) / 10000)

const fmtColors = (stops: Stop[]) => stops.map((s) => `'${s.color}'`).join(', ')

const fmtJsx = (p: Params) =>
  `<ShaderScene>
  <LinearGradient
    colors={[${fmtColors(p.stops)}]}
    angle={${fmtNum(p.angle)}}
    speed={${fmtNum(p.speed)}}
    focalPoint={[${fmtNum(p.focalX)}, ${fmtNum(p.focalY)}]}
  />
</ShaderScene>`

const fmtParams = (p: Params) =>
  `{
  colors: [${fmtColors(p.stops)}],
  angle: ${fmtNum(p.angle)},
  speed: ${fmtNum(p.speed)},
  focalPoint: [${fmtNum(p.focalX)}, ${fmtNum(p.focalY)}],
}`

export default function LinearGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useState<Params>(() => structuredClone(INITIAL))

  useEffect(() => {
    const container = paneContainerRef.current

    if (!container) return

    const local: Params = structuredClone(INITIAL)
    const pane = new Pane({ container, title: '<LinearGradient>' })
    const sync = () => setParams(structuredClone(local))

    pane.addButton({ title: 'Reset all' }).on('click', () => {
      Object.assign(local, structuredClone(INITIAL))
      // local.stops bindings reference the previous stop objects; rebuild the
      // dynamic folder so new bindings point at the fresh ones.
      rebuildStops()
      pane.refresh()
      sync()
    })

    addCopyButtons(
      pane,
      () => fmtJsx(local),
      () => fmtParams(local),
    )

    pane.addBinding(local, 'angle', { min: 0, max: 360, step: 1 })
    pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 })
    pane.addBinding(local, 'focalX', { label: 'focal x', min: 0, max: 1, step: 0.01 })
    pane.addBinding(local, 'focalY', { label: 'focal y', min: 0, max: 1, step: 0.01 })
    pane.addBlade({ view: 'separator' })

    const stopsFolder = pane.addFolder({ title: 'Color stops' })

    // Tweakpane folders are static; to render variable-length lists we
    // dispose every child of the stops folder and rebuild on each mutation.
    const rebuildStops = () => {
      for (const child of [...stopsFolder.children]) child.dispose()

      local.stops.forEach((stop, i) => {
        const row = stopsFolder.addFolder({ title: `Stop ${i}`, expanded: true })

        row.addBinding(stop, 'color', { label: 'color' })

        const removeBtn = row.addButton({ title: 'Remove stop' })

        if (local.stops.length <= MIN_STOPS) removeBtn.disabled = true
        removeBtn.on('click', () => {
          local.stops.splice(i, 1)
          rebuildStops()
          sync()
        })
      })

      const addBtn = stopsFolder.addButton({ title: '+ Add stop' })

      if (local.stops.length >= MAX_STOPS) addBtn.disabled = true
      addBtn.on('click', () => {
        const last = local.stops[local.stops.length - 1]?.color ?? '#888888'

        local.stops.push({ color: last })
        rebuildStops()
        sync()
      })
    }

    rebuildStops()

    pane.on('change', sync)

    return () => {
      pane.dispose()
    }
  }, [])

  const colors = params.stops.map((s) => s.color)
  // angle and the colors array are baked into the TSL graph at material-build
  // time today, so changing them requires a remount. Phase 4 will switch angle
  // to a live uniform; for now this key forces the gradient to rebuild.
  const remountKey = `${params.angle}|${colors.join('|')}`

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <ShaderScene>
          <LinearGradient
            angle={params.angle}
            colors={colors}
            focalPoint={[params.focalX, params.focalY]}
            key={remountKey}
            speed={params.speed}
          />
          <VisualTestPause />
        </ShaderScene>
        <div
          aria-hidden="true"
          data-tweakpane-host
          ref={paneContainerRef}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            width: '320px',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;LinearGradient /&gt;</h1>
        <p>
          Animated linear gradient with optional cursor parallax. The simplest, foundational Matter
          component.
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
          {`<ShaderScene>
  <LinearGradient />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  )
}
