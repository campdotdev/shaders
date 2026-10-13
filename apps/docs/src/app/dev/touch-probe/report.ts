// The probe's report lines: one line per contact, in the words the tester
// pastes into the ticket. Kept apart from the recorder so its file exports
// only components, which Fast Refresh needs to keep their state on an edit.
import type { PushContactRecord } from './push-recorder';

/** One contact as a line. */
export function formatPushContact(record: PushContactRecord): string {
  const path = record.phases.map(({ phase, at }) => `${phase} ${at} ms`);
  const details = [
    `canvas moved ${Math.round(record.travelDown)} px down, ${Math.round(record.travelFling)} px in the fling`,
    `${record.pushFrames} push frames, longest ${record.maxPush.toFixed(1)} px`,
    `finger drifted ${Math.round(record.fingerDrift)} px across the canvas`,
    record.pointerCancel ? 'pointercancel' : null,
  ].filter((detail) => detail !== null);

  return `#${record.index}: ${path.join(' > ')} | ${details.join(', ')}`;
}
