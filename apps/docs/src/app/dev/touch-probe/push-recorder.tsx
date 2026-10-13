'use client';

// Records what scroll push did with each touch on the probe's top scene, for
// the device report (SHA-225). It only watches: it reads the scene's shared
// cursor Input once per frame, after the Input has worked out the push, and
// listens passively on the canvas for where each contact starts and lifts.
import { useEffect, useRef } from 'react';

import { useShaderContext } from '@camp-dev/shaders';

/**
 * - `idle`: no contact.
 * - `down`: one finger down on the canvas.
 * - `fling`: the finger lifted and the push runs on until the page stops.
 * - `pinch`: a second finger came down.
 */
export type PushPhase = 'idle' | 'down' | 'fling' | 'pinch';

/** What one contact did, from its first finger down until the push settled. */
export interface PushContactRecord {
  index: number;
  /** Each phase the contact entered, in ms from the first touch. */
  phases: Array<{ phase: PushPhase; at: number }>;
  /** How far the canvas moved on screen while the finger was down, in CSS pixels. */
  travelDown: number;
  /** How far the canvas moved on screen during the fling, in CSS pixels. */
  travelFling: number;
  /** Frames that pushed with the brush on the canvas. */
  pushFrames: number;
  /** The longest push in one frame, in CSS pixels. */
  maxPush: number;
  /** How far the brush moved across the canvas in push frames, summed, in CSS pixels. */
  fingerDrift: number;
  pointerCancel: boolean;
}

interface PushRecorderProps {
  onPhaseChange: (phase: PushPhase) => void;
  onContact: (record: PushContactRecord) => void;
}

const createRecord = (index: number): PushContactRecord => ({
  index,
  phases: [],
  travelDown: 0,
  travelFling: 0,
  pushFrames: 0,
  maxPush: 0,
  fingerDrift: 0,
  pointerCancel: false,
});

export function PushRecorder({ onPhaseChange, onContact }: PushRecorderProps) {
  const shaderContext = useShaderContext();
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onContactRef = useRef(onContact);
  const contactCountRef = useRef(0);

  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
    onContactRef.current = onContact;
  }, [onPhaseChange, onContact]);

  useEffect(() => {
    const canvas = shaderContext?.renderer.three.domElement;

    if (!shaderContext || !(canvas instanceof HTMLCanvasElement)) return undefined;
    // Asking for the Input here creates it if no effect has yet, and with
    // it the scene's tick for it, which then runs ahead of this recorder.
    const input = shaderContext.getCursorInput();
    const { scheduler } = shaderContext;

    let record: PushContactRecord | null = null;
    let phase: PushPhase = 'idle';
    let startTime = 0;
    let previousRect: { left: number; top: number } | null = null;

    const enter = (next: PushPhase) => {
      if (next === phase) return;
      phase = next;
      record?.phases.push({ phase: next, at: Math.round(performance.now() - startTime) });
      onPhaseChangeRef.current(next);
    };

    const close = () => {
      enter('idle');
      if (record) onContactRef.current(record);
      record = null;
    };

    const open = () => {
      contactCountRef.current += 1;
      record = createRecord(contactCountRef.current);
      startTime = performance.now();
    };

    // --- Contact boundaries, from passive touch listeners -------------------
    const handleTouchStart = (event: TouchEvent) => {
      // A lone finger during a fling stops the page and starts a new
      // contact, as it does in the Input.
      if (event.touches.length === 1 && phase === 'fling') close();
      if (!record) open();
      enter(event.touches.length > 1 ? 'pinch' : 'down');
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length > 0) return;
      if (phase === 'down') enter('fling');
      if (phase === 'pinch') close();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerType === 'touch' && record) record.pointerCancel = true;
    };

    // --- One frame: read the canvas and the Input's push --------------------
    const recordFrame = () => {
      const rect = canvas.getBoundingClientRect();
      const canvasX = previousRect ? rect.left - previousRect.left : 0;
      const canvasY = previousRect ? rect.top - previousRect.top : 0;

      previousRect = { left: rect.left, top: rect.top };
      if (!record) return;
      const travel = Math.hypot(canvasX, canvasY);

      if (phase === 'down') record.travelDown += travel;
      if (phase === 'fling') record.travelFling += travel;

      // The push, split into the canvas's movement and the finger's drift
      // across the canvas. During a plain vertical scroll the finger is
      // pinned to the canvas, so a large drift there is jitter.
      const push = input.getPush();

      if (push && push.presence > 0) {
        const pushX = (push.to[0] - push.from[0]) * rect.width;
        const pushY = (push.to[1] - push.from[1]) * rect.height;

        record.pushFrames += 1;
        record.maxPush = Math.max(record.maxPush, Math.hypot(pushX, pushY));
        record.fingerDrift += Math.hypot(pushX - canvasX, pushY - canvasY);
      }
      if (phase === 'fling' && !input.isPushing()) close();
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    canvas.addEventListener('pointercancel', handlePointerCancel);
    scheduler.add(recordFrame);

    return () => {
      scheduler.remove(recordFrame);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [shaderContext]);

  return null;
}
