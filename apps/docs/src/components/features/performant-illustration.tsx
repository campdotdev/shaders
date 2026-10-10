/**
 * The Performant feature card's illustration, after the Figma mock: a CPU
 * chip beside a GPU chip. The still frame (SHA-215) shows both chips idle
 * and gray, with no work flowing to either, so its story can hand the work
 * to the GPU and wind it down there.
 */
import styles from './performant-illustration.module.css';

// The four pins along a chip's top or bottom edge. The bottom row is the
// top row turned over, so its rounded ends point down.
function Pins({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <div className={styles.pins} data-edge={edge}>
      <span className={styles.pin} />
      <span className={styles.pin} />
      <span className={styles.pin} />
      <span className={styles.pin} />
    </div>
  );
}

// A chip: its body, three nested squares that step lighter toward the
// center, with its name in the middle and four pins above and below.
function Chip({ name }: { name: string }) {
  return (
    <div className={styles.chip}>
      <Pins edge="top" />
      <div className={styles.body}>
        <div className={styles.ring}>
          <div className={styles.core}>
            <span className={styles.name}>{name}</span>
          </div>
        </div>
      </div>
      <Pins edge="bottom" />
    </div>
  );
}

// Hidden from screen readers: the card's title and description carry its
// message.
export function PerformantIllustration() {
  return (
    <div aria-hidden className={styles.illustration}>
      <div className={styles.chips}>
        <Chip name="CPU" />
        <Chip name="GPU" />
      </div>
    </div>
  );
}
