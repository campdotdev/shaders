'use client';

/**
 * One OKLCH channel as a slider whose track shows what that channel can do.
 * Sweeping lightness, chroma, or hue while the other two hold still traces a
 * line through the gamut, and the track paints exactly that line: color where a
 * screen can show the result, bare track where it cannot. Move any slider and
 * the other two redraw, so the shape of what is reachable is visible while you
 * work rather than something to be learned.
 *
 * The tracks say nothing about sRGB specifically. What a narrow display would
 * make of the color is a question about the color itself, not about a position
 * on an axis, so ColorPopoverContents answers it with a side-by-side swatch.
 *
 * Three of these replaced a 2D plane. A 2D slice of the gamut is a curved shape
 * that has to be squashed into a rectangle somehow, and every way of doing that
 * makes something drift when the hue moves; a 1D slice is just an interval.
 *
 * Ported unchanged from apps/docs/src/components/controls/color/ChannelSlider.tsx
 * — only the CSS classes it renders now resolve against controls.css (the
 * editor has no design-token globals.css) instead of the docs site's stylesheet.
 */
import { useEffect, useRef } from 'react';

import { Slider } from '@base-ui/react/slider';
import {
  linearChannelToSrgb,
  linearSrgbToLinearDisplayP3,
  oklchInGamut,
  oklchToLinearSrgb,
} from '@mattermix/shaders/color';

import { MAX_CHROMA, type OklchColor } from './oklch';

/** Which of the three numbers this slider edits. Keys match `OklchColor`. */
export type Channel = 'chroma' | 'hue' | 'lightness';

const CHANNELS: Record<Channel, { label: string; max: number; step: number }> = {
  chroma: { label: 'Chroma', max: MAX_CHROMA, step: 0.005 },
  hue: { label: 'Hue', max: 360, step: 1 },
  lightness: { label: 'Lightness', max: 1, step: 0.01 },
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// Display P3 encodes with the same transfer curve as sRGB — only the primaries
// differ — so one encoder serves both canvas kinds.
const toByte = (linearChannel: number) =>
  Math.round(clamp01(linearChannelToSrgb(linearChannel)) * 255);

/**
 * Whether a 2D canvas can hold wide-gamut pixels. Probed against the real API
 * rather than sniffed, because asking for `display-p3` on a browser that lacks
 * it succeeds and silently hands back an sRGB context. Deferred to first paint
 * and cached: this component renders on the server, where `document` is absent.
 */
let wideCanvasSupport: boolean | undefined;

function supportsWideCanvas(): boolean {
  if (wideCanvasSupport === undefined) {
    try {
      const probe = document.createElement('canvas').getContext('2d', {
        colorSpace: 'display-p3',
      });

      wideCanvasSupport = probe?.getContextAttributes().colorSpace === 'display-p3';
    } catch {
      wideCanvasSupport = false;
    }
  }

  return wideCanvasSupport;
}

/**
 * Paint the track. Every column is one candidate value of this channel, so the
 * whole thing is a single left-to-right sweep with the other two numbers held
 * at whatever the color currently says.
 *
 * Unreachable columns are left fully transparent rather than filled with a grey,
 * which lets the track's own CSS background show through — so the "nothing here"
 * region follows the panel's dark theme without this file knowing anything
 * about it.
 *
 * The colored region is always what P3 can show, even on a browser whose canvas
 * is sRGB-only, so the track has the same shape everywhere and only its most
 * saturated sliver renders approximately.
 */
function paintTrack(canvas: HTMLCanvasElement, channel: Channel, color: OklchColor) {
  const wide = supportsWideCanvas();
  const colorSpace: PredefinedColorSpace = wide ? 'display-p3' : 'srgb';
  const scale = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * scale));
  const height = Math.max(1, Math.round(canvas.clientHeight * scale));

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { colorSpace });

  if (context === null) return;

  const pixels = new Uint8ClampedArray(width * height * 4);
  const { max } = CHANNELS[channel];

  for (let column = 0; column < width; column += 1) {
    const swept = { ...color, [channel]: (column / (width - 1)) * max };
    const { lightness, chroma, hue } = swept;

    if (!oklchInGamut(lightness, chroma, hue, 'p3')) continue;

    const [red, green, blue] = oklchToLinearSrgb(lightness, chroma, hue);
    const channels = wide
      ? linearSrgbToLinearDisplayP3(red, green, blue)
      : ([red, green, blue] as const);
    const redByte = toByte(channels[0]);
    const greenByte = toByte(channels[1]);
    const blueByte = toByte(channels[2]);

    for (let row = 0; row < height; row += 1) {
      const offset = (row * width + column) * 4;

      pixels[offset] = redByte;
      pixels[offset + 1] = greenByte;
      pixels[offset + 2] = blueByte;
      pixels[offset + 3] = 255;
    }
  }

  context.putImageData(new ImageData(pixels, width, height, { colorSpace }), 0, 0);
}

export function ChannelSlider({
  channel,
  color,
  onPreview,
  onCommit,
}: {
  /** Which number this slider edits; also what its track sweeps. */
  channel: Channel;
  /** The current color — supplies the two values held still during the sweep. */
  color: OklchColor;
  /** Fires continuously while dragging or arrow-stepping — updates the popup only. */
  onPreview: (next: OklchColor) => void;
  /** Fires once the drag or key press settles — this is what reaches the store. */
  onCommit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { label, max, step } = CHANNELS[channel];

  // The swept channel's own value has no bearing on the track, so it is pinned
  // to 0 here: dragging this slider then leaves the dependencies below
  // untouched and repaints nothing, while a move on either other slider does.
  const held: OklchColor = { ...color, [channel]: 0 };
  const { lightness, chroma, hue } = held;

  // The resize repaint below reads this ref instead of closing over `held`, so
  // it always paints the latest colors without re-arming the observer. Written
  // in an effect, not during render: a render React discards must not leave
  // its value in the ref.
  const heldRef = useRef(held);

  useEffect(() => {
    heldRef.current = held;
  });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas !== null) paintTrack(canvas, channel, { chroma, hue, lightness });
  }, [channel, chroma, hue, lightness]);

  // The backing store is sized from the track's CSS width at paint time, so a
  // resize with no color change would otherwise leave the sweep stretched.
  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => paintTrack(canvas, channel, heldRef.current));

    observer.observe(canvas);

    return () => observer.disconnect();
  }, [channel]);

  return (
    <Slider.Root
      className="slider-root"
      max={max}
      min={0}
      onValueChange={(next) => onPreview({ ...color, [channel]: next })}
      onValueCommitted={onCommit}
      step={step}
      value={color[channel]}
    >
      <Slider.Label className="controls-field-label">{label}</Slider.Label>
      <Slider.Control className="slider-control channel-control">
        <Slider.Track className="slider-track channel-track">
          <canvas aria-hidden="true" className="channel-track-canvas" ref={canvasRef} />
          <Slider.Thumb className="slider-thumb channel-thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
