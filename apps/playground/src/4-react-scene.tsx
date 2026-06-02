import { ShaderScene, useShaderContext } from '@lovo/matter-react'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Mesh, PlaneGeometry } from 'three'
import { vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'

function MagentaPlane() {
  const ctx = useShaderContext()

  useEffect(() => {
    if (!ctx) return
    const material = new MeshBasicNodeMaterial()

    material.colorNode = vec3(1, 0, 1)
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)

    ctx.scene.add(mesh)

    return () => {
      ctx.scene.remove(mesh)
      material.dispose()
      mesh.geometry.dispose()
    }
  }, [ctx])

  return null
}

function App() {
  return (
    <ShaderScene
      fallback={<div style={{ color: '#888', padding: '1rem' }}>Initializing renderer…</div>}
    >
      <MagentaPlane />
    </ShaderScene>
  )
}

const rootEl = document.getElementById('root')

if (rootEl === null) throw new Error('div#root not found')
const root = createRoot(rootEl)

root.render(<App />)
