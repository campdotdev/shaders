import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3 } from 'three/tsl'
import { MatterScene, useMatterContext } from '@lovo/matter-react'

function MagentaPlane() {
  const ctx = useMatterContext()

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
    <MatterScene
      fallback={<div style={{ color: '#888', padding: '1rem' }}>Initializing renderer…</div>}
    >
      <MagentaPlane />
    </MatterScene>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
