'use client';

/**
 * The popover's contents: the chroma/lightness plane, hue slider, keyboard
 * lightness/chroma sliders, and a text field that accepts any color string
 * the engine parses. ColorInput mounts this only while the popover is open,
 * so this component's own unmount is exactly "the popover just closed."
 */
import { type ChangeEvent, useEffect, useRef, useState } from 'react';

import { Slider } from '@base-ui/react/slider';

import { ColorArea } from './color/ColorArea';
import { HueSlider } from './color/HueSlider';
import { formatOklch, MAX_CHROMA, type OklchColor, parseToOklch } from './color/oklch';
import type { PathInput } from './store';
import { usePropValue, useSetProp } from './useControl';

export function ColorPopoverContents({ path, label }: { path: PathInput; label: string }) {
  const stored = usePropValue<string>(path);
  const setProp = useSetProp();

  // Non-null only while a gesture is in flight. Everything renders from
  // `color`, so the popup tracks the drag while the store stays still.
  const [draft, setDraft] = useState<OklchColor | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [typedIsInvalid, setTypedIsInvalid] = useState(false);

  // Mirrors of the three fields above, kept current on every render, so the
  // unmount effect further down can read their latest values instead of the
  // stale ones its closure would otherwise have captured at mount time.
  const draftRef = useRef(draft);
  const typedRef = useRef(typed);
  const typedIsInvalidRef = useRef(typedIsInvalid);

  draftRef.current = draft;
  typedRef.current = typed;
  typedIsInvalidRef.current = typedIsInvalid;

  const color = draft ?? parseToOklch(stored);
  const cssColor = formatOklch(color);

  // Colors commit on release, not continuously. LinearGradient, SimplexNoise,
  // and WaveLines rebuild their NodeMaterial whenever colors change, because
  // colorRamp bakes color literals into the compiled shader — a continuous
  // drag would recompile the shader every frame. `commit` and `commitTyped`
  // are the only two places that write to the store.
  const commit = () => {
    if (draft === null) return;

    setProp(path, formatOklch(draft));
    setDraft(null);
  };

  const commitTyped = () => {
    if (typed === null) return;

    try {
      const parsed = parseToOklch(typed);

      setProp(path, formatOklch(parsed));
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
  // Flush both on the way out: a pending drag always wins, and a pending
  // typed value commits only if it's valid — an invalid, abandoned entry is
  // deliberately discarded rather than written to the store as-is.
  useEffect(() => {
    return () => {
      if (draftRef.current !== null) setProp(path, formatOklch(draftRef.current));

      if (typedRef.current !== null && !typedIsInvalidRef.current) {
        try {
          setProp(path, formatOklch(parseToOklch(typedRef.current)));
        } catch {
          // typedIsInvalidRef guards this in practice; kept defensive rather
          // than assuming parseToOklch can't still throw here.
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately empty: must run exactly once, on unmount, reading the refs above rather than depending on the state they mirror (which would re-run this on every keystroke instead of at close)
  }, []);

  return (
    <>
      <ColorArea color={color} onCommit={commit} onPreview={setDraft} />
      <HueSlider color={color} onCommit={commit} onPreview={setDraft} />
      <PopoverSlider
        label="Lightness"
        max={1}
        onCommit={commit}
        onPreview={(next) => setDraft({ ...color, lightness: next })}
        step={0.01}
        value={color.lightness}
      />
      <PopoverSlider
        label="Chroma"
        max={MAX_CHROMA}
        onCommit={commit}
        onPreview={(next) => setDraft({ ...color, chroma: next })}
        step={0.005}
        value={color.chroma}
      />
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

function PopoverSlider({
  label,
  value,
  max,
  step,
  onPreview,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  onPreview: (next: number) => void;
  onCommit: () => void;
}) {
  return (
    <Slider.Root
      max={max}
      min={0}
      onValueChange={(next) => onPreview(next)}
      onValueCommitted={onCommit}
      step={step}
      value={value}
    >
      <Slider.Label className="controls-field-label">{label}</Slider.Label>
      <Slider.Control className="slider-control">
        <Slider.Track className="slider-track">
          <Slider.Indicator className="slider-indicator" />
          <Slider.Thumb className="slider-thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
