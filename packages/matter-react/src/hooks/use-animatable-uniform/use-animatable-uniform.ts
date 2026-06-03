'use client'

import { useEffect, useMemo } from 'react'
import { uniform } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export interface AnimatableSignal<T> {
  get(): T
  on(event: 'change', cb: (value: T) => void): () => void
}

export type AnimatableProp<T> = T | AnimatableSignal<T>

const isSignal = <T>(value: AnimatableProp<T>): value is AnimatableSignal<T> => {
  if (typeof value !== 'object' || value === null) return false

  return (
    'get' in value &&
    typeof value.get === 'function' &&
    'on' in value &&
    typeof value.on === 'function'
  )
}

export function useAnimatableUniform<T>(
  value: AnimatableProp<T>,
): ShaderNodeObject<Node> & { value: T } {
  const uniformNode = useMemo(() => {
    const initial = isSignal(value) ? value.get() : value

    return uniform(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isSignal(value)) {
      const unsub = value.on('change', (next) => {
        uniformNode.value = next
      })

      return unsub
    }
    uniformNode.value = value

    return undefined
  }, [value, uniformNode])

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return uniformNode as unknown as ShaderNodeObject<Node> & { value: T }
}
