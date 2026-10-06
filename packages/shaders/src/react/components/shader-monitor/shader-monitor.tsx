'use client';

// Debug overlay: a small corner readout of the enclosing scene's frame rate,
// GPU time per frame, and tick count, each averaged over 500ms windows. The
// fps stalls and the tick counter freezes when the scene goes idle, and the
// GPU time settles on the scene's last frames. GPU time can show a nearly
// full GPU while fps still reads 60, and the monitor turns the scene's GPU
// timing on only while it is mounted.
import { type CSSProperties, useContext, useEffect, useRef, useState } from 'react';

import { ShaderContext } from '../../context/shader-context.js';

export type ShaderMonitorAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const anchorStyle: Record<ShaderMonitorAnchor, CSSProperties> = {
  'top-left': { top: 8, left: 8 },
  'top-right': { top: 8, right: 8 },
  'bottom-left': { bottom: 8, left: 8 },
  'bottom-right': { bottom: 8, right: 8 },
};

const baseStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  padding: '6px 8px',
  borderRadius: 6,
  background: 'rgba(0, 0, 0, 0.6)',
  color: '#fff',
  font: '11px ui-monospace, monospace',
  lineHeight: 1.4,
  pointerEvents: 'none',
  whiteSpace: 'pre',
};

// How long each fps and GPU average runs, in milliseconds. Longer reads
// steadier, and shorter shows a spike sooner.
const WINDOW_MILLISECONDS = 500;

export interface ShaderMonitorProps {
  anchor?: ShaderMonitorAnchor;
}

export function ShaderMonitor({ anchor = 'top-right' }: ShaderMonitorProps) {
  const shaderContext = useContext(ShaderContext);
  const [stats, setStats] = useState<{
    fps: number;
    gpuMilliseconds: number | null;
    ticks: number;
    frames: number;
  }>({ fps: 0, gpuMilliseconds: null, ticks: 0, frames: 0 });
  const ticksRef = useRef(0);
  const fpsAccumRef = useRef({ frames: 0, lastSampleAt: 0, fps: 0 });

  useEffect(() => {
    if (!shaderContext) return;
    // GPU frame times arrive a frame or two after their draw, whenever the
    // GPU hands them back, so they collect here and the fps window averages
    // them. The average is null until the first window with a frame time
    // closes.
    const gpuAccumulator: {
      totalMilliseconds: number;
      frames: number;
      milliseconds: number | null;
    } = { totalMilliseconds: 0, frames: 0, milliseconds: null };
    // A window with no frame time keeps the last average.
    const closeGpuWindow = () => {
      if (gpuAccumulator.frames === 0) return;
      gpuAccumulator.milliseconds = gpuAccumulator.totalMilliseconds / gpuAccumulator.frames;
      gpuAccumulator.totalMilliseconds = 0;
      gpuAccumulator.frames = 0;
    };
    // An idle scene stops ticking, so the frame times of its last draws
    // arrive after its last tick, and no tick closes their window. Each frame
    // time pushes this timeout back, so it fires only once a window passes
    // with none arriving, and then it closes the window.
    let quietTimeout: ReturnType<typeof setTimeout> | undefined;
    const stopGpuTiming = shaderContext.timeGpu((frameMilliseconds) => {
      gpuAccumulator.totalMilliseconds += frameMilliseconds;
      gpuAccumulator.frames += 1;
      clearTimeout(quietTimeout);
      quietTimeout = setTimeout(() => {
        closeGpuWindow();
        setStats((current) => ({ ...current, gpuMilliseconds: gpuAccumulator.milliseconds }));
      }, WINDOW_MILLISECONDS);
    });

    const schedulerTickHandler = (tick: { now: number }) => {
      ticksRef.current += 1;
      const fpsAccumulator = fpsAccumRef.current;

      fpsAccumulator.frames += 1;
      if (fpsAccumulator.lastSampleAt === 0) fpsAccumulator.lastSampleAt = tick.now;
      const deltaTimeSinceLastSample = tick.now - fpsAccumulator.lastSampleAt;

      if (deltaTimeSinceLastSample >= WINDOW_MILLISECONDS) {
        fpsAccumulator.fps = Math.round((fpsAccumulator.frames * 1000) / deltaTimeSinceLastSample);
        fpsAccumulator.frames = 0;
        fpsAccumulator.lastSampleAt = tick.now;
        closeGpuWindow();
      }
      setStats({
        fps: fpsAccumulator.fps,
        gpuMilliseconds: gpuAccumulator.milliseconds,
        ticks: ticksRef.current,
        frames: fpsAccumulator.frames,
      });
    };

    shaderContext.scheduler.add(schedulerTickHandler);
    // An idle scene draws nothing until something asks, so ask it for one
    // frame to time. A scene that is still animating ignores the request.
    shaderContext.scheduler.requestRender();

    return () => {
      shaderContext.scheduler.remove(schedulerTickHandler);
      clearTimeout(quietTimeout);
      stopGpuTiming();
    };
  }, [shaderContext]);

  if (!shaderContext) {
    return (
      <div data-testid="shaders-monitor" style={{ ...baseStyle, ...anchorStyle[anchor] }}>
        no scene
      </div>
    );
  }

  return (
    <div data-testid="shaders-monitor" style={{ ...baseStyle, ...anchorStyle[anchor] }}>
      <span data-testid="shaders-monitor-fps">fps: {stats.fps || '—'}</span>
      {'\n'}
      {/* A dash until a frame time arrives, and for good where the scene
        cannot time its passes (its batches of GPU draws): the WebGL2
        fallback, or an adapter without timestamp queries, the GPU feature
        that records when a pass starts and ends. */}
      <span data-testid="shaders-monitor-gpu">
        gpu: {stats.gpuMilliseconds === null ? '—' : `${stats.gpuMilliseconds.toFixed(2)} ms`}
      </span>
      {'\n'}
      <span data-testid="shaders-monitor-ticks">ticks: {stats.ticks}</span>
    </div>
  );
}
