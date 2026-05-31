import { createRenderer } from '@lovo/matter'
import { Mesh, OrthographicCamera, PlaneGeometry, Scene } from 'three'
import { vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'

const canvas = document.getElementById('c') as HTMLCanvasElement

if (!canvas) throw new Error('canvas#c not found')

const matter = await createRenderer(canvas)

console.log(`[playground/1-magenta] backend: ${matter.backend}`)

const scene = new Scene()
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)

camera.position.z = 1

const material = new MeshBasicNodeMaterial()

material.colorNode = vec3(1, 0, 1) // magenta — hardcoded TSL fragment

const mesh = new Mesh(new PlaneGeometry(2, 2), material)

scene.add(mesh)

const tick = () => {
  matter.three.render(scene, camera)?.catch((err: unknown) => {
    console.error('[playground/1-magenta] render failed', err)
  })
  requestAnimationFrame(tick)
}

tick()

window.addEventListener('resize', matter.resize)
