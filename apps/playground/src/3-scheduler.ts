import { createRenderer, MatterScheduler } from '@lovo/matter'
import { Mesh, OrthographicCamera, PlaneGeometry, Scene } from 'three'
import { mix, sin, uv, vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'

const canvas = document.getElementById('c')
const log = document.getElementById('log')

if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas#c not found')
if (!(log instanceof HTMLDivElement)) throw new Error('log#log not found')

const matter = await createRenderer(canvas)

log.textContent = `backend: ${matter.backend}`

const scene = new Scene()
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)

camera.position.z = 1

const colorA = vec3(1, 0.48, 0.45)
const colorB = vec3(0.48, 0.61, 1)

// Animate by piping the TSL `time` uniform through `sin` to oscillate the mix factor.
const material = new MeshBasicNodeMaterial()

material.colorNode = mix(
  colorA,
  colorB,
  sin(
    uv()
      .x.mul(6.28)
      .add(performance.now() / 1000),
  )
    .mul(0.5)
    .add(0.5),
)

const mesh = new Mesh(new PlaneGeometry(2, 2), material)

scene.add(mesh)

// Use MatterScheduler instead of an inline requestAnimationFrame.
const scheduler = new MatterScheduler()
let frameCount = 0

scheduler.add(({ delta, elapsed }) => {
  matter.three.render(scene, camera)?.catch((err: unknown) => {
    console.error('[playground/3-scheduler] render failed', err)
  })
  frameCount += 1
  if (frameCount % 60 === 0) {
    log.textContent = `backend: ${matter.backend}\nelapsed: ${elapsed.toFixed(1)}s · frame ${frameCount} · last delta: ${(delta * 1000).toFixed(1)}ms`
  }
})
scheduler.start()

window.addEventListener('resize', matter.resize)
