import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ShaderContext, type ShaderContextValue, type Slot } from '../../context/shader-context.js';
import { useSceneRegistration } from './use-scene-registration.js';

afterEach(cleanup);

// The hook hands the context to `register` and reads nothing from it, so an
// empty object stands in for a mounted scene.
const context = {} as ShaderContextValue;

function Wrapper({ children }: { children: ReactNode }) {
  return <ShaderContext.Provider value={context}>{children}</ShaderContext.Provider>;
}

function makeProbe() {
  const slots: Slot[] = [];

  function Probe({ mode = 'a' }: { mode?: 'a' | 'b' }) {
    useSceneRegistration(
      (_shaderContext, slot) => {
        slots.push(slot);

        return () => undefined;
      },
      [mode],
    );

    return null;
  }

  return { Probe, slots };
}

describe('useSceneRegistration', () => {
  // The scene puts a registration under a slot it has seen back in that
  // slot's place, so an Effect whose deps change keeps its place in the
  // stack.
  it('registers again under the same slot when a value in deps changes', () => {
    const { Probe, slots } = makeProbe();
    const { rerender } = render(<Probe mode="a" />, { wrapper: Wrapper });

    rerender(<Probe mode="b" />);

    expect(slots).toHaveLength(2);
    expect(slots[0]).toBeDefined();
    expect(slots[1]).toBe(slots[0]);
  });

  it('gives each mounted Effect its own slot', () => {
    const { Probe, slots } = makeProbe();

    render(
      <>
        <Probe />
        <Probe />
      </>,
      { wrapper: Wrapper },
    );

    expect(slots).toHaveLength(2);
    expect(slots[1]).not.toBe(slots[0]);
  });
});
