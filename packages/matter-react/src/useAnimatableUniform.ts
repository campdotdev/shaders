'use client'

import { useEffect, useMemo } from 'react'
import { uniform } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export interface MatterSignal<T> {
  get(): T
  on(event: 'change', cb: (value: T) => void): () => void
}

export type AnimatableProp<T> = T | MatterSignal<T>

const isSignal = <T>(value: AnimatableProp<T>): value is MatterSignal<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MatterSignal<T>).get === 'function' &&
    typeof (value as MatterSignal<T>).on === 'function'
  )
}

/**
 * Bind an AnimatableProp<T> to a TSL uniform. Plain values create a
 * static uniform that updates only when the prop changes (React render
 * path). Signals subscribe via .on('change') and write into the uniform
 * imperatively without re-rendering.
 */
export function useAnimatableUniform<T>(value: AnimatableProp<T>): ShaderNodeObject<Node> {
  // Create the uniform once with the initial value; subsequent updates flow
  // through the effect below (either via signal subscription or direct write).
  const uniformNode = useMemo(() => {
    const initial = isSignal(value) ? value.get() : value

    return uniform(initial) as unknown as ShaderNodeObject<Node>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isSignal(value)) {
      const unsub = value.on('change', (next) => {
        ;(uniformNode as unknown as { value: T }).value = next
      })

      return unsub
    }
    ;(uniformNode as unknown as { value: T }).value = value

    return undefined
  }, [value, uniformNode])

  return uniformNode
}
