/**
 * Throwaway prototype for SHA-182: the homepage hero pinned while the visitor
 * scrolls, turning into Aurora's demo layout. It exists to answer two
 * questions before the real build (crop or resize the canvas, and whether
 * pinning survives a phone), so none of it is meant to survive.
 */
import { HeroToDemoPrototype } from './prototype';

export default function HeroToDemoPrototypePage() {
  return <HeroToDemoPrototype />;
}
