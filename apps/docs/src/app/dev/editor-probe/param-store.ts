// Per-node uniform store: the bridge that lets sliders glide. A uniform is a
// value the CPU can rewrite every frame without recompiling the shader; this
// store creates one per (node, param) on first use and hands the SAME object
// back on every later compile, so a material rebuild (rewiring) picks up
// whatever value the slider last wrote, and a slider drag writes straight to
// the GPU without touching React or the compiler at all.
import { uniform } from 'three/tsl';

type NumberUniform = ReturnType<typeof uniform<number>>;

export class ParamStore {
  private uniforms = new Map<string, NumberUniform>();

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
}
