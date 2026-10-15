'use client';

/**
 * The Reactive card's live scene: its LiquidGradient, held still.
 * reactive-illustration.tsx loads this module with import() from an effect,
 * which keeps three out of the server render (the SSR gotcha in
 * docs/agents/docs-site.md).
 */
import { LiquidGradient, ShaderScene } from '@camp-dev/shaders';

import { REACTIVE_GRADIENT, type ReactiveGradient } from './reactive-gradient';

export interface ReactiveSceneProps {
  /** Fires on the frame after the scene's first frame is on screen. */
  onFirstPaint: () => void;
  /** Settings in place of the card's, from the /dev/reactive-card tuning route. */
  gradient?: ReactiveGradient;
}

export default function ReactiveScene({
  onFirstPaint,
  gradient = REACTIVE_GRADIENT,
}: ReactiveSceneProps) {
  return (
    <ShaderScene onFirstPaint={onFirstPaint}>
      {/* A literal 0 holds the flow still, so the scene parks after its
          first frame. */}
      <LiquidGradient {...gradient} speed={0} />
    </ShaderScene>
  );
}
