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

/**
 * Bind an AnimatableProp<T> to a TSL uniform. Plain values create a
 * static uniform that updates only when the prop changes (React render
 * path). Signals subscribe via .on('change') and write into the uniform
 * imperatively without re-rendering.
 *
 * Returns a chainable TSL node with `.value: T` exposed for callers that
 * need to read the current uniform value imperatively (e.g., to compute
 * derived JS-side math). The runtime object is a UniformNode<T>; we
 * present it as `ShaderNodeObject<Node> & { value: T }` because TSL's
 * generic invariance blocks the more precise type from flowing through
 * downstream consumers like OverlayTransform.
 */
export function useAnimatableUniform<T>(
  value: AnimatableProp<T>,
): ShaderNodeObject<Node> & { value: T } {
  // Create the uniform once with the initial value; subsequent updates flow
  // through the effect below (either via signal subscription or direct write).
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

  // TSL's ShaderNodeObject<UniformNode<T>> isn't structurally assignable to
  // ShaderNodeObject<Node> because the ShaderNodeObject proxy has invariant
  // generic methods (label/etc.). Consumers chain `.mul()`/`.add()` which
  // work on either at runtime; the narrower return type is fine to widen.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return uniformNode as unknown as ShaderNodeObject<Node> & { value: T }
}
