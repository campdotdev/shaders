// The line under the map that says where the payload is. Subscribes to the
// step index, so it re-renders once per hop.
import { usePlayback } from '@/timeline/use-playback';

export function Caption() {
  const { flow, stepIndex } = usePlayback();
  const step = flow.steps[stepIndex];

  return (
    <p aria-live="polite" className="caption">
      {step?.caption ?? ''}
    </p>
  );
}
