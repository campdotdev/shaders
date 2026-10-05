'use client';

// Benchmark for Aurora at the homepage hero's pinned size, 1636 by 696 CSS
// pixels, with its default props and ShaderMonitor's GPU readout (SHA-204).
// `?dpr=2` caps the canvas at two pixels per CSS pixel, the hero's target,
// and anything else at one, as the pinned hero does today. Below the scene
// it prints Aurora's fragment shader, the per-pixel program three compiled.
import { useEffect, useState } from 'react';

import { Aurora, ShaderMonitor, ShaderScene, useShaderContext } from '@camp-dev/shaders';
import { Vector2 } from 'three/webgpu';

const HERO_WIDTH = 1636;
const HERO_HEIGHT = 696;

// The links between ratios are full page loads, so each measurement starts
// from a fresh renderer.
const readPixelRatio = () =>
  new URLSearchParams(window.location.search).get('dpr') === '2' ? 2 : 1;

interface CompiledAurora {
  /** The renderer's backend, which decides the shader language: WGSL on WebGPU, GLSL on WebGL2. */
  backend: string;
  /** The canvas's drawing buffer, in device pixels: what the GPU shades each frame. */
  drawingBuffer: { width: number; height: number };
  /** Null when the read failed, which logs the error to the console. */
  fragmentShader: string | null;
}

/**
 * Reads the backend, the drawing-buffer size, and Aurora's compiled fragment
 * shader once Aurora's mesh is in the scene, and hands them to `onCompiled`.
 */
function AuroraShaderReader({ onCompiled }: { onCompiled: (compiled: CompiledAurora) => void }) {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    const { renderer, scene, camera } = shaderContext;
    // React runs sibling effects in order, and a component's children's
    // effects before its own. Aurora sits before this component, so its mesh
    // is in the scene by now.
    const auroraMesh = scene.children[0];

    if (!auroraMesh) return;

    let cancelled = false;
    const three = renderer.three;

    // getShaderAsync compiles the scene, then returns the shader three built
    // for this mesh's material. Aurora is transparent, so the compile would
    // throw and blank the canvas without the flag flip (the
    // transparent-compile gotcha in docs/agents/tsl.md). The finally puts
    // back the value it found.
    const wasTransparent = three.transparent;

    three.transparent = false;
    let shaderRead: ReturnType<typeof three.debug.getShaderAsync>;

    try {
      shaderRead = three.debug.getShaderAsync(scene, camera, auroraMesh);
    } finally {
      three.transparent = wasTransparent;
    }

    void shaderRead
      .then(
        ({ fragmentShader }) => fragmentShader,
        (error: unknown) => {
          console.error('[aurora-benchmark] getShaderAsync failed:', error);

          return null;
        },
      )
      .then((fragmentShader) => {
        if (cancelled) return;

        const drawingBuffer = three.getDrawingBufferSize(new Vector2());

        onCompiled({
          backend: renderer.backend,
          drawingBuffer: { width: drawingBuffer.width, height: drawingBuffer.height },
          fragmentShader,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [shaderContext, onCompiled]);

  return null;
}

export default function BenchmarkScene() {
  const [pixelRatio] = useState(readPixelRatio);
  const [compiled, setCompiled] = useState<CompiledAurora | null>(null);

  return (
    <main style={{ padding: 24, background: '#000', color: '#fff', minHeight: '100vh' }}>
      <p style={{ margin: '0 0 16px', font: '13px ui-monospace, monospace' }}>
        Aurora at {HERO_WIDTH} × {HERO_HEIGHT} CSS px, pixel ratio capped at {pixelRatio}x.{' '}
        <a href="?dpr=1">1x</a> · <a href="?dpr=2">2x</a>
        {compiled &&
          ` · ${compiled.backend}, drawing buffer ${compiled.drawingBuffer.width} × ${compiled.drawingBuffer.height}`}
      </p>
      <div style={{ position: 'relative', width: HERO_WIDTH, height: HERO_HEIGHT }}>
        <ShaderScene maxDPR={pixelRatio}>
          <Aurora />
          <AuroraShaderReader onCompiled={setCompiled} />
          <ShaderMonitor anchor="top-left" />
        </ShaderScene>
      </div>
      <details open style={{ marginTop: 16 }}>
        <summary style={{ font: '13px ui-monospace, monospace' }}>
          Aurora&apos;s compiled fragment shader
        </summary>
        <pre style={{ font: '11px/1.4 ui-monospace, monospace', whiteSpace: 'pre-wrap' }}>
          {compiled
            ? (compiled.fragmentShader ?? 'The shader read failed. The console has the error.')
            : 'Compiling…'}
        </pre>
      </details>
    </main>
  );
}
