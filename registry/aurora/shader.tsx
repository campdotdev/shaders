'use client'

import { noise, time } from '@lovo/matter'
import {
  type AnimatableProp,
  useAnimatableUniform,
  useMatterContext,
  useResize,
} from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import { type ShaderNodeObject, smoothstep, sub, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import {
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  Vector2,
  Vector3,
} from 'three/webgpu'

import { parseHex } from '../utils/color'

export interface AuroraLayer {
  hex: string
  speed: AnimatableProp<number>
  intensity: AnimatableProp<number>
  variation: number
}

export type AuroraDirection = 'bottom' | 'top' | 'left' | 'right'

const DIRECTION_VECTORS: Record<AuroraDirection, [number, number, number]> = {
  bottom: [0, 1, 0],
  top: [0, -1, 1],
  left: [1, 0, 0],
  right: [-1, 0, 1],
}

export interface AuroraShaderProps {
  intensity: AnimatableProp<number>
  speed: AnimatableProp<number>
  densityX: AnimatableProp<number>
  densityY: AnimatableProp<number>
  falloff: AnimatableProp<number>
  driftX: AnimatableProp<number>
  driftY: AnimatableProp<number>
  turbulence: AnimatableProp<number>
  direction: AuroraDirection
  horizonColor: string
  skyColor: string
  layers: [AuroraLayer, AuroraLayer, AuroraLayer, AuroraLayer]
}

interface LayerUniforms {
  color: ShaderNodeObject<Node>
  speed: ShaderNodeObject<Node>
  intensity: ShaderNodeObject<Node>
}

function useLayerUniforms(layer: AuroraLayer): LayerUniforms {
  const speedU = useAnimatableUniform<number>(layer.speed)
  const intensityU = useAnimatableUniform<number>(layer.intensity)

  // Stable instance — the useEffect below mutates it via .set() on hex
  // changes, keeping the uniform node identity stable so the material
  // doesn't recompile on every color-picker drag.
  const colorVec = useMemo(
    () => {
      const [r, g, b] = parseHex(layer.hex)

      return new Vector3(r, g, b)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const colorNode = useMemo(
    () => uniform(colorVec) as unknown as ShaderNodeObject<Node>,
    [colorVec],
  )

  useEffect(() => {
    const [r, g, b] = parseHex(layer.hex)

    colorVec.set(r, g, b)
  }, [layer.hex, colorVec])

  return useMemo(
    () => ({ color: colorNode, speed: speedU, intensity: intensityU }),
    [colorNode, speedU, intensityU],
  )
}

function useColorUniform(hex: string) {
  // Stable instance — see colorVec in useLayerUniforms above.
  const vec = useMemo(
    () => {
      const [r, g, b] = parseHex(hex)

      return new Vector3(r, g, b)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const node = useMemo(() => uniform(vec) as unknown as ShaderNodeObject<Node>, [vec])

  useEffect(() => {
    const [r, g, b] = parseHex(hex)

    vec.set(r, g, b)
  }, [hex, vec])

  return node
}

export function AuroraShader(props: AuroraShaderProps) {
  const ctx = useMatterContext()
  const resize = useResize()

  const intensityU = useAnimatableUniform<number>(props.intensity)
  const speedU = useAnimatableUniform<number>(props.speed)
  const densityXU = useAnimatableUniform<number>(props.densityX)
  const densityYU = useAnimatableUniform<number>(props.densityY)
  const falloffU = useAnimatableUniform<number>(props.falloff)
  const driftXU = useAnimatableUniform<number>(props.driftX)
  const driftYU = useAnimatableUniform<number>(props.driftY)
  const turbulenceU = useAnimatableUniform<number>(props.turbulence)

  const resVec = useMemo(() => new Vector2(1920, 1080), [])
  const resNode = useMemo(() => uniform(resVec) as unknown as ShaderNodeObject<Node>, [resVec])

  useEffect(() => {
    const [w, h] = resize.get()

    if (w > 0 && h > 0) resVec.set(w, h)

    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2))
  }, [resize, resVec])

  // Stable instance — the useEffect below mutates it via .set() when the
  // direction prop changes, keeping the uniform node identity stable.
  const dirVec = useMemo(
    () => {
      const [x, y, b] = DIRECTION_VECTORS[props.direction]

      return new Vector3(x, y, b)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const dirNode = useMemo(() => uniform(dirVec) as unknown as ShaderNodeObject<Node>, [dirVec])

  useEffect(() => {
    const [x, y, b] = DIRECTION_VECTORS[props.direction]

    dirVec.set(x, y, b)
  }, [props.direction, dirVec])

  const horizonNode = useColorUniform(props.horizonColor)
  const skyNode = useColorUniform(props.skyColor)

  const layer0 = useLayerUniforms(props.layers[0])
  const layer1 = useLayerUniforms(props.layers[1])
  const layer2 = useLayerUniforms(props.layers[2])
  const layer3 = useLayerUniforms(props.layers[3])

  const layerUniforms = useMemo(
    () => [layer0, layer1, layer2, layer3] as const,
    [layer0, layer1, layer2, layer3],
  )

  const variations = useMemo(
    () =>
      [
        props.layers[0].variation,
        props.layers[1].variation,
        props.layers[2].variation,
        props.layers[3].variation,
      ] as const,
    [props.layers],
  )

  useEffect(() => {
    const material = new MeshBasicNodeMaterial()

    const aspect = resNode.x.div(resNode.y)
    const scaledUv = vec2(uv().x.mul(aspect).mul(densityXU), uv().y.mul(densityYU))

    const fallOff = uv().x.mul(dirNode.x).add(uv().y.mul(dirNode.y)).add(dirNode.z)

    let aurora = vec3(0, 0, 0)

    for (let i = 0; i < 4; i += 1) {
      const lu = layerUniforms[i]!
      const variation = variations[i]!

      const t = time.mul(speedU).mul(lu.speed)

      const p = vec2(scaledUv.x.add(t.mul(driftXU)), scaledUv.y.add(t.mul(driftYU)))

      const warpSeed = vec2(lu.color.x.add(variation), lu.color.y.add(variation + 1))

      const inner = noise(vec2(warpSeed.x.add(p.x).add(t), warpSeed.y.add(p.y).add(t)))
        .mul(0.5)
        .add(0.5)
        .mul(turbulenceU)

      const n = noise(vec2(p.x.add(inner), p.y.add(inner)))
        .mul(0.5)
        .add(0.5)

      const auroraField = n.sub(fallOff.mul(falloffU))

      aurora = aurora.add(lu.color.mul(auroraField).mul(lu.intensity).mul(2))
    }

    const sky = horizonNode
      .mul(sub(1, smoothstep(0, 0.5, fallOff)))
      .add(skyNode.mul(sub(1, smoothstep(0.4, 1, fallOff))))

    const finalColor = sky.add(aurora.mul(intensityU))

    material.colorNode = vec4(finalColor, 1)

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)

    ctx?.scene.add(mesh)

    return () => {
      ctx?.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
    }
  }, [
    ctx,
    layerUniforms,
    variations,
    intensityU,
    speedU,
    densityXU,
    densityYU,
    falloffU,
    driftXU,
    driftYU,
    turbulenceU,
    horizonNode,
    skyNode,
    resNode,
    dirNode,
  ])

  return null
}
