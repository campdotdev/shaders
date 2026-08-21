'use client';

/**
 * The popover's contents: one slider per OKLCH channel, and a text field that
 * accepts any color string the engine parses. ColorInput mounts this only while
 * the popover is open, so this component's own unmount is exactly "the popover
 * just closed."
 *
 * Ported from apps/docs/src/components/controls/ColorPopoverContents.tsx (the
 * docs demo panels), with one deliberate behavior change: this component takes
 * plain `value`/`onChange`/`onCommit` props instead of a store path, and it
 * calls `onChange` on every channel-slider preview, not just on release. The
 * docs version waits for release because LinearGradient/SimplexNoise/WaveLines
 * bake color literals into the compiled shader, so a continuous drag would
 * recompile every frame (see AGENTS.md "colors commit on release"). A ramp
 * stop's color rides a uniform instead (MAT-86), so a continuous write there
 * is a cheap GPU upload, not a rebuild — that's what lets it glide. `onCommit`
 * still fires only once a gesture settles, which is what the caller mirrors
 * into node data.
 */
import { type ChangeEvent, useEffect, useRef, useState } from 'react';

import { useDisplayGamut } from '@camp-dev/shaders-react/gamut';
import { oklchInGamut, oklchToGamut } from '@camp-dev/shaders/color';

import { ChannelSlider } from './color/ChannelSlider';
import { formatOklch, type OklchColor, parseToOklch } from './color/oklch';

export function ColorPopoverContents({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  /** The committed color, as an oklch() string. */
  value: string;
  /** Fires on every channel-slider preview tick — writes straight to the ramp-stop uniform (glide, no rebuild). */
  onChange: (value: string) => void;
  /** Fires once a gesture settles (slider release, typed Enter/blur, or popover close mid-drag) — mirrors into node data. */
  onCommit: (value: string) => void;
}) {
  // Non-null only while a gesture is in flight. Everything renders from
  // `color`, so the popup tracks the drag while `value` stays still.
  const [draft, setDraft] = useState<OklchColor | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [typedIsInvalid, setTypedIsInvalid] = useState(false);

  // Mirrors of the three fields above — and of the two callbacks, which the
  // caller recreates per render closing over its CURRENT stops array —
  // refreshed after every committed render, so the unmount effect further down
  // can read their latest values instead of the stale ones its closure would
  // otherwise have captured at mount time (a mount-time onCommit would replay
  // the stops as they were when the popover opened, reverting edits since).
  // Written in an effect, not during render: a render React discards (Strict
  // Mode, concurrent interruptions) must not leave its values in the refs.
  const draftRef = useRef(draft);
  const typedRef = useRef(typed);
  const typedIsInvalidRef = useRef(typedIsInvalid);
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    draftRef.current = draft;
    typedRef.current = typed;
    typedIsInvalidRef.current = typedIsInvalid;
    onChangeRef.current = onChange;
    onCommitRef.current = onCommit;
  });

  const color = draft ?? parseToOklch(value);
  const cssColor = formatOklch(color);

  // A channel-slider preview tick updates the popup's own draft AND writes
  // straight through to the ramp-stop uniform, so the shader tracks the
  // pointer live.
  const preview = (next: OklchColor) => {
    setDraft(next);
    onChange(formatOklch(next));
  };

  // The drag settling (or a key press committing) is the only place the
  // caller's node-data mirror gets touched — `commit` and `commitTyped` are
  // the two gesture-settled paths, plus the unmount flush below for a
  // gesture abandoned mid-drag.
  const commit = () => {
    if (draft === null) return;

    onCommit(formatOklch(draft));
    setDraft(null);
    // A drag is a more recent gesture than any un-submitted typed value, so
    // it should win outright rather than have the unmount flush re-apply a
    // stale typed string over it later.
    setTyped(null);
    setTypedIsInvalid(false);
  };

  const commitTyped = () => {
    if (typed === null) return;

    try {
      const formatted = formatOklch(parseToOklch(typed));

      onChange(formatted);
      onCommit(formatted);
      setTyped(null);
      setTypedIsInvalid(false);
    } catch {
      setTypedIsInvalid(true);
    }
  };

  const handleTyping = (event: ChangeEvent<HTMLInputElement>) => {
    setTyped(event.target.value);
    setTypedIsInvalid(false);
  };

  // Closing the popover (Escape, outside press) unmounts this component
  // without necessarily running a pointerup/blur first, so a drag or typed
  // edit that never released here would otherwise vanish with no commit.
  // Flush whichever is pending on the way out, drag first: it is the later
  // gesture of the two, so it wins outright rather than having a typed string
  // from before it land on top. A pending typed value commits only if it is
  // valid — an invalid, abandoned entry is deliberately discarded rather than
  // written to the store as-is.
  useEffect(() => {
    return () => {
      if (draftRef.current !== null) {
        const formatted = formatOklch(draftRef.current);

        onChangeRef.current(formatted);
        onCommitRef.current(formatted);
      } else if (typedRef.current !== null && !typedIsInvalidRef.current) {
        try {
          const formatted = formatOklch(parseToOklch(typedRef.current));

          onChangeRef.current(formatted);
          onCommitRef.current(formatted);
        } catch {
          // typedIsInvalidRef guards this in practice; kept defensive rather
          // than assuming parseToOklch can't still throw here.
        }
      }
    };
    // Deliberately empty deps: must run exactly once, on unmount, reading the
    // refs above rather than depending on the state and callbacks they mirror
    // (which would re-run this on every keystroke instead of at close).
  }, []);

  return (
    <>
      <GamutPreview color={color} />
      <ChannelSlider channel="lightness" color={color} onCommit={commit} onPreview={preview} />
      <ChannelSlider channel="chroma" color={color} onCommit={commit} onPreview={preview} />
      <ChannelSlider channel="hue" color={color} onCommit={commit} onPreview={preview} />
      <input
        aria-invalid={typedIsInvalid}
        aria-label={`${label} value`}
        className="color-text-input"
        onBlur={commitTyped}
        onChange={handleTyping}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitTyped();
        }}
        spellCheck={false}
        value={typed ?? cssColor}
      />
    </>
  );
}

/**
 * The colour as it will actually land, in a box that is always the same height
 * so the panel never resizes under the pointer mid-drag. Three shapes:
 *
 * - fits sRGB: one wide swatch, nothing to compare it against
 * - needs P3 and this monitor has P3: the colour beside its sRGB fallback
 * - needs more than this monitor can show: a dashed placeholder saying so,
 *   beside the fallback, because painting a swatch there would be a lie — the
 *   browser would clamp it and it would look identical to the fallback
 *
 * The fallback comes from the engine's `oklchToGamut`, which sheds chroma while
 * holding lightness and hue. That is not what happens today if the shader is
 * asked for sRGB output — a narrow framebuffer clamps each channel on its own,
 * which shifts lightness and hue as well. So this previews the better of the two
 * behaviours, and the gap between them is its own piece of work.
 */
function GamutPreview({ color }: { color: OklchColor }) {
  // Resolved the same way <ShaderScene gamut="auto"> resolves it, so the panel
  // and the shader never disagree about what this screen can do.
  const displayGamut = useDisplayGamut('auto');
  const { lightness, chroma, hue } = color;
  const exact = formatOklch(color);

  if (oklchInGamut(lightness, chroma, hue, 'srgb')) {
    return (
      <div className="gamut-preview">
        <span className="gamut-preview-swatch" style={{ background: exact }} />
      </div>
    );
  }

  const [, fallbackChroma] = oklchToGamut(lightness, chroma, hue, 'srgb');
  const fallback = formatOklch({ chroma: fallbackChroma, hue, lightness });
  const withinP3 = oklchInGamut(lightness, chroma, hue, 'p3');

  return (
    <div className="gamut-preview gamut-preview-split">
      {withinP3 && displayGamut === 'p3' ? (
        <span className="gamut-preview-swatch" style={{ background: exact }}>
          <span className="gamut-preview-label">P3</span>
        </span>
      ) : (
        <span className="gamut-preview-swatch gamut-preview-empty">
          <span className="gamut-preview-note">
            {withinP3 ? 'Needs a P3 display' : 'No display shows this'}
          </span>
        </span>
      )}
      <span className="gamut-preview-swatch" style={{ background: fallback }}>
        <span className="gamut-preview-label">Fallback</span>
      </span>
    </div>
  );
}
