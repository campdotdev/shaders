import type { WebGPURenderer } from 'three/webgpu';

/**
 * Internal shape of three's per-renderer frame clock. `nodeFrame` is not part
 * of three's public types — it lives at `renderer._nodes.nodeFrame` — so we
 * reach it through guarded `unknown` traversal rather than a typed access.
 */
interface NodeFrameClock {
  time?: number;
  deltaTime?: number;
  lastTime?: number;
}

function getNodeFrame(renderer: WebGPURenderer): NodeFrameClock | undefined {
  const candidate: unknown = renderer;

  if (!(typeof candidate === 'object' && candidate !== null && '_nodes' in candidate)) {
    return undefined;
  }
  // After the `'_nodes' in candidate` guard, TS narrows to `{ _nodes: unknown }`.
  const nodes: unknown = candidate._nodes;

  if (!(typeof nodes === 'object' && nodes !== null && 'nodeFrame' in nodes)) {
    return undefined;
  }
  // After the `'nodeFrame' in nodes` guard, TS narrows to `{ nodeFrame: unknown }`.
  const frame: unknown = nodes.nodeFrame;

  if (typeof frame !== 'object' || frame === null) return undefined;

  // `frame` is narrowed to a non-null object; all NodeFrameClock fields are
  // optional so the narrowed type is directly assignable.
  return frame;
}

/**
 * Zero the renderer's animation clock so the next rendered frame is t=0.
 *
 * `elapsedTime` (and three's built-in `time`) accumulate real frame deltas from
 * the moment the renderer starts, which includes a nondeterministic WebGPU
 * init + shader-compile warmup. Resetting the per-renderer `nodeFrame` clock
 * makes every shader start from a fixed phase, so the first visible frame
 * matches the deterministic poster/snapshot frame.
 *
 * Per-renderer by construction: each ShaderScene owns one renderer, so resetting
 * here isolates scenes from one another. No-ops safely if three's internal
 * shape ever changes.
 */
export function resetRendererClock(renderer: WebGPURenderer): void {
  const nodeFrame = getNodeFrame(renderer);

  if (!nodeFrame) return;
  nodeFrame.time = 0;
  nodeFrame.deltaTime = 0;
  nodeFrame.lastTime = undefined;
}

/**
 * Hold the renderer's clock at its current time, for a paused scene. three
 * runs its own animation loop, which advances the clock on every animation
 * frame whether the scene renders or not, so a paused scene's time keeps
 * running and its first frame after a resume would jump ahead by the whole
 * pause. The returned function puts the clock back to the held time, and
 * clears `lastTime` so three's next tick adds nothing: that loop stops while
 * the tab is hidden, and its stale `lastTime` would otherwise carry the
 * whole hidden gap. Call it before every frame the paused scene draws and
 * once as it resumes. It can run any number of times. No-ops safely if
 * three's internal shape ever changes.
 */
export function holdRendererClock(renderer: WebGPURenderer): () => void {
  const nodeFrame = getNodeFrame(renderer);
  const heldTime = nodeFrame?.time;

  return () => {
    if (!nodeFrame || heldTime === undefined) return;
    nodeFrame.time = heldTime;
    nodeFrame.deltaTime = 0;
    nodeFrame.lastTime = undefined;
  };
}
