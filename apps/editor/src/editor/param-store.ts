// Per-node uniform store: the bridge that lets sliders, animation speed, and
// live ramp edits glide without recompiling a shader. A uniform is a value
// the CPU can rewrite every frame; this store creates one per (node, param)
// key on first use and hands the SAME object back on every later call, so a
// material rebuild (rewiring the graph) picks up whatever value was last
// written, and a slider drag or color edit writes straight to the GPU
// without touching React or the compiler at all.
//
// Phase integration re-implements `useAnimatableSpeed`'s contract (MAT-66)
// in plain code rather than calling the hook: the editor's node count varies
// at runtime, and hooks can't be called a variable number of times per
// render. `phaseFor` registers a node's phase/speed pair; `advancePhases` is
// the scheduler tick that walks every registered pair and integrates speed
// into phase, capping the per-tick delta the same way the hook does — a
// parked tab or hidden canvas can hand back a huge wall-clock gap on its
// next tick, and accumulating that whole gap would snap every pattern
// forward instead of resuming smoothly. `resetPhases` rewinds every phase to
// 0, mirroring the hook's scheduler reset channel, so visual tests stay
// reproducible.
import { uniform } from 'three/tsl';
import { Vector3 } from 'three/webgpu';

type NumberUniform = ReturnType<typeof uniform<number>>;
type Vector3Uniform = ReturnType<typeof uniform<Vector3>>;

// Longest slice of time one scheduler tick may contribute to a phase, in
// seconds. Mirrors `useAnimatableSpeed`'s MAX_DELTA: normal frames (16-33ms)
// never come near it, but the first tick after a parked scene carries the
// whole gap, so it gets clamped instead of integrated whole.
export const MAX_PHASE_DELTA = 0.1;

interface PhaseEntry {
  phase: NumberUniform;
  speed: NumberUniform;
}

export class ParamStore {
  private uniforms = new Map<string, NumberUniform>();
  private phases = new Map<string, PhaseEntry>();
  private stopPositions = new Map<string, NumberUniform>();
  private stopColors = new Map<string, Vector3Uniform>();

  // ---------------------------------------------------------------------------
  // Slider params — plain numeric dials (waviness, speed, radius, ...): one
  // uniform per (node, param), created at `initial` on first use.
  // ---------------------------------------------------------------------------

  /** The stable uniform for a node's param, created at `initial` on first use. */
  uniformFor(nodeId: string, paramId: string, initial: number): NumberUniform {
    const key = `${nodeId}/${paramId}`;
    let existing = this.uniforms.get(key);

    if (!existing) {
      existing = uniform(initial);
      this.uniforms.set(key, existing);
    }

    return existing;
  }

  /** Slider fast path: write the value the GPU reads next frame. */
  set(nodeId: string, paramId: string, value: number): void {
    this.uniformFor(nodeId, paramId, value).value = value;
  }

  // ---------------------------------------------------------------------------
  // Animation phase — a node's phase is the CPU-integrated stand-in for
  // elapsed-time-times-speed (see the file-top comment for why it's
  // integrated rather than multiplied). `phaseFor` registers the node with
  // the ticker; the speed uniform passed in is the SAME object the node's
  // speed dial rides, so a slider drag changes tomorrow's integration rate
  // without this store needing to know it happened.
  // ---------------------------------------------------------------------------

  /** Per-node animation phase, registered with the integrator on first use.
      `speed` is the node's speed uniform, read fresh every tick. */
  phaseFor(nodeId: string, speed: NumberUniform): NumberUniform {
    let existing = this.phases.get(nodeId);

    if (!existing) {
      existing = { phase: uniform(0), speed };
      this.phases.set(nodeId, existing);
    }

    return existing.phase;
  }

  /** One scheduler tick: every registered phase advances by
      speed * min(delta, MAX_PHASE_DELTA) * timeScale. `timeScale` carries
      the prefers-reduced-motion multiplier so a policy flip changes tempo
      smoothly instead of snapping the pattern. */
  advancePhases(deltaSeconds: number, timeScale: number): void {
    const clampedDelta = Math.min(deltaSeconds, MAX_PHASE_DELTA);

    for (const { phase, speed } of this.phases.values()) {
      phase.value += speed.value * clampedDelta * timeScale;
    }
  }

  /** Rewinds every phase to 0 — wired to the scheduler's reset channel so
      visual tests stay reproducible (same contract as useAnimatableSpeed). */
  resetPhases(): void {
    for (const { phase } of this.phases.values()) {
      phase.value = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Ramp stops — MAT-86 live-ramp path: a ramp param's stop positions and
  // colors ride uniforms too, so dragging a stop or repicking its color
  // doesn't rebuild the material (only adding/removing a stop does, since
  // that changes the mix chain's arity). Keyed on `${nodeId}/stops/${index}`
  // so each stop gets its own stable pair of uniforms.
  // ---------------------------------------------------------------------------

  /** The stable uniform for a ramp stop's position (0-1), created at
      `initial` on first use. */
  stopPositionFor(nodeId: string, index: number, initial: number): NumberUniform {
    const key = `${nodeId}/stops/${index}`;
    let existing = this.stopPositions.get(key);

    if (!existing) {
      existing = uniform(initial);
      this.stopPositions.set(key, existing);
    }

    return existing;
  }

  /** The stable uniform for a ramp stop's color, created at `initial` on
      first use. Wraps a Vector3 (not vec3(...)) so later writes can go
      through its `.set()` mutator instead of replacing the uniform. */
  stopColorFor(
    nodeId: string,
    index: number,
    initial: readonly [number, number, number],
  ): Vector3Uniform {
    const key = `${nodeId}/stops/${index}`;
    let existing = this.stopColors.get(key);

    if (!existing) {
      existing = uniform(new Vector3(...initial));
      this.stopColors.set(key, existing);
    }

    return existing;
  }

  /** Ramp-stop position fast path: write the value the GPU reads next frame. */
  setStopPosition(nodeId: string, index: number, value: number): void {
    this.stopPositionFor(nodeId, index, value).value = value;
  }

  /** Ramp-stop color fast path: mutate the Vector3 in place (linear-rgb
      triple) rather than replacing the uniform, so the material keeps
      reading the same object it compiled against. */
  setStopColor(nodeId: string, index: number, rgb: readonly [number, number, number]): void {
    const [red, green, blue] = rgb;

    this.stopColorFor(nodeId, index, rgb).value.set(red, green, blue);
  }
}
