import { Scene, OrthographicCamera, Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3, mix, uv } from 'three/tsl'
import { createRenderer } from '@lovo/matter'

const canvas = document.getElementById('c') as HTMLCanvasElement
if (!canvas) throw new Error('canvas#c not found')

const matter = await createRenderer(canvas)
console.log(`[playground/2-gradient] backend: ${matter.backend}`)

const scene = new Scene()
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
camera.position.z = 1

// A two-color horizontal gradient.
//   `uv()` returns the per-pixel UV coordinate (vec2 from 0..1)
//   `uv().x` is the horizontal component (0 on the left, 1 on the right)
//   `mix(a, b, t)` linearly interpolates from `a` (when t=0) to `b` (when t=1)
const colorA = vec3(1, 0.48, 0.45) // warm coral (#ff7b72)
const colorB = vec3(0.48, 0.61, 1) // cool periwinkle (#7b9cff)

const material = new MeshBasicNodeMaterial()
material.colorNode = mix(colorA, colorB, uv().x)

const mesh = new Mesh(new PlaneGeometry(2, 2), material)
scene.add(mesh)

const tick = () => {
  matter.three.render(scene, camera)
  requestAnimationFrame(tick)
}
tick()

window.addEventListener('resize', matter.resize)
