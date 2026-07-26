'use client';

/**
 * The chroma-by-lightness plane at one hue, painted pixel by pixel rather than
 * with the usual stacked-CSS-gradient trick — OKLCH has no white/black overlay
 * decomposition the way HSV does, so the plane's shape has to be evaluated
 * pixel by pixel at every hue. Pairs with HueSlider, which picks the hue.
 */
import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';

import { linearChannelToSrgb, oklchToLinearSrgb } from '@lovo/matter';

import { MAX_CHROMA, type OklchColor } from './oklch';

// Painted at a fixed size and scaled up by CSS. The plane is smooth, so
// upscaling is invisible, and a fixed budget keeps a hue drag cheap.
const PLANE_WIDTH = 160;
const PLANE_HEIGHT = 144;
const OUT_OF_GAMUT_ALPHA = 70;

const toByte = (linearChannel: number) =>
  Math.round(Math.min(1, Math.max(0, linearChannelToSrgb(linearChannel))) * 255);

// Pixels outside the sRGB gamut are written semi-transparent, letting the
// checkerboard in .color-area's CSS show through — the visible edge of the
// solid region IS the gamut boundary. The canvas itself is an sRGB surface, so
// it cannot display wide-gamut color accurately; it can only show where the
// boundary falls. The swatch and the shader do render those colors correctly.
function paintPlane(canvas: HTMLCanvasElement, hue: number) {
  const context = canvas.getContext('2d');

  if (context === null) return;

  const image = context.createImageData(PLANE_WIDTH, PLANE_HEIGHT);

  for (let row = 0; row < PLANE_HEIGHT; row += 1) {
    // Top row is the lightest, matching the handle's top-is-light placement.
    const lightness = 1 - row / (PLANE_HEIGHT - 1);

    for (let column = 0; column < PLANE_WIDTH; column += 1) {
      const chroma = (column / (PLANE_WIDTH - 1)) * MAX_CHROMA;
      const [red, green, blue] = oklchToLinearSrgb(lightness, chroma, hue);
      const offset = (row * PLANE_WIDTH + column) * 4;
      const inGamut =
        red >= -1e-4 &&
        red <= 1.0001 &&
        green >= -1e-4 &&
        green <= 1.0001 &&
        blue >= -1e-4 &&
        blue <= 1.0001;

      image.data[offset] = toByte(red);
      image.data[offset + 1] = toByte(green);
      image.data[offset + 2] = toByte(blue);
      image.data[offset + 3] = inGamut ? 255 : OUT_OF_GAMUT_ALPHA;
    }
  }

  context.putImageData(image, 0, 0);
}

export function ColorArea({
  color,
  onPreview,
  onCommit,
}: {
  color: OklchColor;
  /** Fires continuously during a drag — updates the popup only. */
  onPreview: (next: OklchColor) => void;
  /** Fires on pointer release — this is what reaches the store. */
  onCommit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  // Snapshot of `color` from the moment the current drag started, so a
  // cancelled gesture (see handlePointerCancel) has something to revert to.
  const dragStartColorRef = useRef(color);

  // Repaint whenever the hue changes; lightness and chroma only move the handle.
  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas !== null) paintPlane(canvas, color.hue);
  }, [color.hue]);

  const readPosition = (clientX: number, clientY: number) => {
    const area = areaRef.current;

    if (area === null) return;

    const bounds = area.getBoundingClientRect();
    const across = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const down = Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height));

    onPreview({ ...color, chroma: across * MAX_CHROMA, lightness: 1 - down });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartColorRef.current = color;
    areaRef.current?.setPointerCapture(event.pointerId);
    readPosition(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) readPosition(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    areaRef.current?.releasePointerCapture(event.pointerId);
    onCommit();
  };

  // A cancelled gesture (browser takes over for a scroll/system gesture,
  // touch interruption, etc.) never fires pointerup. The browser releases
  // capture on its own, but the dragging flag has to be cleared here too, or
  // a later plain hover with no button held would re-enter readPosition and
  // start firing onPreview. A cancelled drag shouldn't commit, so this reverts
  // the preview to the color the drag started from instead of leaving the
  // popup showing an in-flight value that was never stored.
  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    areaRef.current?.releasePointerCapture(event.pointerId);
    onPreview(dragStartColorRef.current);
  };

  return (
    <div
      aria-hidden="true"
      className="color-area"
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={areaRef}
    >
      <canvas
        className="color-area-canvas"
        height={PLANE_HEIGHT}
        ref={canvasRef}
        width={PLANE_WIDTH}
      />
      <div
        className="color-area-handle"
        style={{
          left: `${(color.chroma / MAX_CHROMA) * 100}%`,
          top: `${(1 - color.lightness) * 100}%`,
        }}
      />
    </div>
  );
}
