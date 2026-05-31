import { MatterScene, useCursor, useMatterContext } from '@lovo/matter-react'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Mesh, PlaneGeometry, Vector2 } from 'three'
import { length, mix, uniform, uv, vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'

function CursorGradient() {
  const ctx = useMatterContext()
  const cursor = useCursor({ smoothing: 0.1 })
  const [smoothing, setSmoothing] = useState(0.1)

  useEffect(() => {
    if (!ctx) return

    // Uniform that the React side mutates whenever cursor.value changes.
    // Use a real Vector2 so we can mutate via .set(); a TSL `vec2(...)` here
    // would lose the Vector2 type and prevent the live update.
    const cursorUniform = uniform(new Vector2(0.5, 0.5))
    const unsub = cursor.on('change', ([x, y]) => {
      // y is inverted: DOM y=0 is top, but uv y=0 is bottom of the geometry.
      cursorUniform.value.set(x, 1 - y)
    })

    const colorA = vec3(1, 0.48, 0.45)
    const colorB = vec3(0.48, 0.61, 1)
    // Gradient angle eases toward the cursor — t = distance from cursor to current uv.
    const t = length(uv().sub(cursorUniform))
    const material = new MeshBasicNodeMaterial()

    material.colorNode = mix(colorA, colorB, t)

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)

    ctx.scene.add(mesh)

    return () => {
      unsub()
      ctx.scene.remove(mesh)
      material.dispose()
      mesh.geometry.dispose()
    }
  }, [ctx, cursor])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        font: '0.85rem ui-sans-serif, system-ui',
      }}
    >
      <label>
        Smoothing: {smoothing.toFixed(2)}{' '}
        <input
          max={0.99}
          min={0}
          onChange={(e) => setSmoothing(Number(e.target.value))}
          step={0.01}
          style={{ width: '200px', marginLeft: '0.5rem' }}
          type="range"
          value={smoothing}
        />
      </label>
      <div style={{ opacity: 0.7, marginTop: '0.25rem' }}>
        Note: smoothing changes require a page refresh in this rough harness.
      </div>
    </div>
  )
}

function App() {
  return (
    <MatterScene>
      <CursorGradient />
    </MatterScene>
  )
}

const root = createRoot(document.getElementById('root')!)

root.render(<App />)
