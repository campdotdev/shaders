'use client';

// Real-device probe for scroll push (SHA-225): two Reactive-card-sized
// scenes of LiquidGradient under CursorRipple in a page that scrolls. The
// top one has `scrollPush` on, and a recorder (./push-recorder.tsx) logs each
// contact for the report; the bottom one keeps today's touch behavior.
import { useCallback, useMemo, useRef, useState } from 'react';

import { CursorRipple, LiquidGradient, ShaderScene } from '@camp-dev/shaders';

import styles from './probe.module.css';
import { type PushContactRecord, type PushPhase, PushRecorder } from './push-recorder';
import { formatPushContact } from './report';

/** Most contacts the report keeps, oldest dropped first. */
const MAX_CONTACTS = 60;

// The renderer picks WebGPU when the page can reach it, which needs a secure
// context, and falls back to WebGL2 otherwise.
const describeDevice = () =>
  [
    navigator.userAgent,
    `${window.innerWidth}x${window.innerHeight} CSS px`,
    `DPR ${window.devicePixelRatio}`,
    `${navigator.maxTouchPoints} touch points`,
    window.isSecureContext ? 'secure context' : 'insecure context',
    'gpu' in navigator ? 'WebGPU available' : 'no WebGPU, so WebGL2',
  ].join(' | ');

export default function ProbeScene() {
  const [phase, setPhase] = useState<PushPhase>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [taps, setTaps] = useState(0);
  const [inputPushes, setInputPushes] = useState({ starts: 0, ends: 0 });
  // Set once the top scene has drawn, so a test knows its input is live.
  const [ready, setReady] = useState(false);
  const [device] = useState(describeDevice);
  const reportRef = useRef<HTMLTextAreaElement>(null);

  const handleContact = useCallback((record: PushContactRecord) => {
    setLines((previous) => [...previous, formatPushContact(record)].slice(-MAX_CONTACTS));
  }, []);

  const handleInputPush = useCallback((event: 'start' | 'end') => {
    setInputPushes((previous) =>
      event === 'start'
        ? { ...previous, starts: previous.starts + 1 }
        : { ...previous, ends: previous.ends + 1 },
    );
  }, []);

  const pushCount = `Input pushes: ${inputPushes.starts} started, ${inputPushes.ends} ended`;
  const report = useMemo(
    () => [`Device: ${device}`, pushCount, '', ...lines].join('\n'),
    [device, pushCount, lines],
  );

  // The page may be served over plain HTTP on the local network, where the
  // clipboard API does not exist, so selecting the text for the system copy
  // menu is the one way that works everywhere.
  const selectReport = () => {
    reportRef.current?.focus();
    reportRef.current?.select();
  };

  return (
    <div className={styles.page}>
      <h1>Touch probe</h1>
      <p>Try these on the top scene, and watch the badge in its corner.</p>
      <ol className={styles.steps}>
        <li>
          Scroll by dragging on the scene, slowly, then fast. The water should stir as you go.
        </li>
        <li>Flick and let go. The water keeps stirring until the page stops.</li>
        <li>Tap, and rest a finger without scrolling. Nothing should stir.</li>
        <li>Drag sideways, and diagonally. The water should follow the finger.</li>
        <li>Pinch on the scene. The page should zoom, and nothing should stir.</li>
        <li>
          Tap the button over the scene, and swipe from it. It should tap and scroll as normal.
        </li>
        <li>
          Touch the lower scene, which keeps today&apos;s behavior. Neither scene should react to a
          finger on the other.
        </li>
        <li>
          Once the page stops, the push count under the scene should show as many ended as started.
        </li>
      </ol>
      <p>Then select the report and paste it into SHA-225.</p>
      <div className={styles.spacer} />
      <h2>Scroll push</h2>
      <div className={styles.frame} data-ready={ready} data-scroll-push-scene="">
        <ShaderScene onFirstPaint={() => setReady(true)} scrollPush>
          <LiquidGradient />
          <CursorRipple />
          <PushRecorder
            onContact={handleContact}
            onInputPush={handleInputPush}
            onPhaseChange={setPhase}
          />
        </ShaderScene>
        <span className={styles.badge} data-phase={phase}>
          {phase}
        </span>
        <button
          className={styles.overlayButton}
          onClick={() => setTaps((count) => count + 1)}
          type="button"
        >
          Taps: {taps}
        </button>
      </div>
      <p data-push-count="">{pushCount}</p>
      <h2>Today&apos;s behavior</h2>
      <div className={styles.frame}>
        <ShaderScene>
          <LiquidGradient />
          <CursorRipple />
        </ShaderScene>
      </div>
      <h2>Report</h2>
      <div className={styles.buttons}>
        <button onClick={selectReport} type="button">
          Select report
        </button>
        <button onClick={() => setLines([])} type="button">
          Clear contacts
        </button>
      </div>
      <textarea
        aria-label="Report"
        className={styles.report}
        readOnly
        ref={reportRef}
        value={report}
      />
      <div className={styles.endSpacer} />
    </div>
  );
}
