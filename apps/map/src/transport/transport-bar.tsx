// The controls along the bottom of the map: flow picker, step back, play or
// pause, step forward, speed, and one clickable segment per step. Subscribes
// to the snapshot, so it re-renders once per hop and once per control change.
import type { ChangeEvent } from 'react';

import { FLOWS } from '@/data/flows';
import { playback, type Speed, SPEEDS } from '@/timeline/store';
import { usePlayback } from '@/timeline/use-playback';

import { useTransportKeys } from './use-transport-keys';

function nextSpeed(current: Speed): Speed {
  const index = SPEEDS.indexOf(current);

  return SPEEDS[(index + 1) % SPEEDS.length] ?? 1;
}

export function TransportBar() {
  const { flow, playing, speed, stepIndex } = usePlayback();

  useTransportKeys();

  function onFlowChange(event: ChangeEvent<HTMLSelectElement>): void {
    playback.selectFlow(event.target.value);
  }

  function onSpeedClick(): void {
    playback.setSpeed(nextSpeed(speed));
  }

  return (
    <div className="transport">
      <select aria-label="Flow" onChange={onFlowChange} value={flow.id}>
        {FLOWS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
      <button onClick={playback.stepBack} type="button">
        Back
      </button>
      <button onClick={playback.toggle} type="button">
        {playing ? 'Pause' : 'Play'}
      </button>
      <button onClick={playback.stepForward} type="button">
        Next
      </button>
      <button aria-label="Speed" onClick={onSpeedClick} type="button">
        {speed}x
      </button>
      <ol className="segments">
        {flow.steps.map((step, index) => (
          <li key={step.caption}>
            <button
              aria-current={index === stepIndex ? 'step' : undefined}
              aria-label={`Step ${index + 1}`}
              onClick={() => {
                playback.seekToStep(index);
              }}
              title={step.caption}
              type="button"
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
