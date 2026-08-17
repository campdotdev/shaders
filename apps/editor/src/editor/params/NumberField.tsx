'use client';

// A numeric dial you scrub by dragging horizontally, or click to type into.
// Replaces the range sliders the params panel used to carry: a slider needs
// travel room, and that room is what forced a card to widen when it opened.
// A field that reads its own value needs none, so cards can hold one width.
//
// The gesture split: a press starts a scrub, and only becomes a click if the
// pointer never travels past CLICK_SLOP_PX. That's why the field is readOnly
// until it's actually being typed into -- a plain editable input would drop a
// caret on press and start selecting text as you dragged.
//
// The arithmetic lives in number-field.ts so it can be unit tested; this file
// owns pointers, focus, and the undo contract (onChange every tick, onCommit
// once per finished gesture).
import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { formatValue, parseTyped, snapToStep, valueFromScrub } from './number-field';
import type { NumericRange } from './number-field';

/** Pointer travel below which a press counts as a click rather than a scrub. */
const CLICK_SLOP_PX = 3;

/** Which way each arrow key nudges. Up/right raise, down/left lower. */
const ARROW_STEPS: Record<string, number | undefined> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

interface ScrubState {
  pointerId: number;
  startX: number;
  startValue: number;
  /** Most recent scrubbed value, so pointer-up commits without re-deriving it. */
  latest: number;
  moved: boolean;
}

export function NumberField({
  label,
  range,
  value,
  onChange,
  onCommit,
}: {
  /** Accessible name for the field. */
  label: string;
  /** The param's bounds and granularity. */
  range: NumericRange;
  /** The committed value. */
  value: number;
  /** Fires on every scrub tick — the free path that writes the uniform. */
  onChange: (value: number) => void;
  /** Fires once per finished gesture — worth exactly one undo step. */
  onCommit: (value: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrub = useRef<ScrubState | null>(null);

  // The live value mid-scrub. Held locally rather than read back from `value`
  // so an unrelated re-render — the canvas re-renders on any wire drag — can't
  // snap the number back from under the pointer.
  const [dragValue, setDragValue] = useState<number | null>(null);

  // Raw text while the field is focused for typing; null when it isn't. The
  // ref shadows the state because `commitTyped` runs from both Enter and the
  // blur that Enter causes, and the second run has to see the first one's
  // clear — React state wouldn't have flushed by then, so it would commit twice.
  const draftRef = useRef<string | null>(null);
  const [draftText, setDraftText] = useState<string | null>(null);

  const isTyping = draftText !== null;
  const shown = draftText ?? formatValue(dragValue ?? value, range);

  const setDraft = (text: string | null) => {
    draftRef.current = text;
    setDraftText(text);
  };

  const commitTyped = () => {
    const text = draftRef.current;

    if (text === null) return;

    setDraft(null);

    const parsed = parseTyped(text, range);

    // Unparseable input reverts to the committed value; `parsed === value`
    // means nothing changed, and recording it would add an empty undo step.
    if (parsed === null || parsed === value) return;

    onChange(parsed);
    onCommit(parsed);
  };

  // ---------------------------------------------------------------------------
  // Scrubbing
  // ---------------------------------------------------------------------------

  const handlePointerDown = (event: PointerEvent<HTMLInputElement>) => {
    if (isTyping) return;

    // Stop the browser focusing the field and dropping a caret: this press is
    // a scrub until the pointer proves otherwise by not moving.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: value,
      latest: value,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLInputElement>) => {
    const active = scrub.current;

    if (active?.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - active.startX;

    if (!active.moved && Math.abs(deltaX) < CLICK_SLOP_PX) return;

    active.moved = true;

    const next = valueFromScrub(active.startValue, deltaX, range);

    active.latest = next;
    setDragValue(next);
    onChange(next);
  };

  const handlePointerUp = (event: PointerEvent<HTMLInputElement>) => {
    const active = scrub.current;

    if (active?.pointerId !== event.pointerId) return;

    scrub.current = null;
    setDragValue(null);

    // Commit BEFORE touching capture: this handler also runs for
    // pointercancel, where the browser has already dropped both the pointer
    // and its capture — releasePointerCapture can throw there, and the
    // scrubbed value must not be lost to that throw. The hasPointerCapture
    // guard keeps the release itself from throwing.
    if (active.moved) onCommit(active.latest);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (active.moved) return;

    // The pointer never travelled, so this was a click: open for typing.
    setDraft(formatValue(value, range));
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isTyping) {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitTyped();
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setDraft(null);
      }

      return;
    }

    // Enter opens typing mode, mirroring what a stationary click does —
    // without it a keyboard-only user could nudge with arrows but never type
    // a value into the read-only field.
    if (event.key === 'Enter') {
      event.preventDefault();
      setDraft(formatValue(value, range));
      inputRef.current?.select();

      return;
    }

    const direction = ARROW_STEPS[event.key];

    if (direction === undefined) return;

    // Claimed before React Flow can read it as "nudge the selected card".
    event.preventDefault();

    const next = snapToStep(value + direction * range.step, range);

    if (next === value) return;

    onChange(next);
    onCommit(next);
  };

  return (
    <input
      aria-label={label}
      // Keeps the drag moving the value instead of the card.
      className="nodrag"
      inputMode="decimal"
      onBlur={commitTyped}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      readOnly={!isTyping}
      ref={inputRef}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        // Explicit, not derived from font metrics: the color swatch trigger
        // (controls.css) pins itself to this same 1.25rem so the two controls
        // match in any row, with or without the other present.
        height: '1.25rem',
        padding: '3px 6px',
        background: '#14131b',
        border: '1px solid #2c2a38',
        borderRadius: 5,
        color: '#e8e6f2',
        // Stated, not inherited. A param row's <label> sets this font so
        // `inherit` looked right there, but a ramp stop row has no font of
        // its own — the field fell back to the browser default and read as a
        // different control. Carrying it here makes every field identical
        // wherever it's used.
        font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
        textAlign: 'right',
        cursor: isTyping ? 'text' : 'ew-resize',
        userSelect: isTyping ? 'auto' : 'none',
        // Without this a touch drag scrolls the page instead of scrubbing.
        touchAction: 'none',
      }}
      type="text"
      value={shown}
    />
  );
}
