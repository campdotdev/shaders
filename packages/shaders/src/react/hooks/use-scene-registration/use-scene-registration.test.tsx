import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ShaderContext, type ShaderContextValue, type Slot } from '../../context/shader-context.js';
import { useSceneRegistration } from './use-scene-registration.js';

// What happened, in order, so a test can check that a frame request follows
// the registration change it has to draw.
const events: string[] = [];

afterEach(() => {
  cleanup();
  events.length = 0;
});

// The hook hands the context to `register` and asks its scheduler for frames,
// so a scheduler that logs each request stands in for a mounted scene.
const context = {
  scheduler: {
    requestRender: () => {
      events.push('request');

      return true;
    },
  },
} as ShaderContextValue;

function Wrapper({ children }: { children: ReactNode }) {
  return <ShaderContext.Provider value={context}>{children}</ShaderContext.Provider>;
}

function makeProbe() {
  const slots: Slot[] = [];

  function Probe({ mode = 'a' }: { mode?: 'a' | 'b' }) {
    useSceneRegistration(
      (_shaderContext, slot) => {
        slots.push(slot);
        events.push('register');

        return () => {
          events.push('unregister');
        };
      },
      [mode],
    );

    return null;
  }

  return { Probe, slots };
}

describe('useSceneRegistration', () => {
  // A registration rebuilds the output material and draws nothing, so a scene
  // that has parked needs a frame to show it.
  it('asks for a frame after registering', () => {
    const { Probe } = makeProbe();

    render(<Probe />, { wrapper: Wrapper });

    expect(events).toEqual(['register', 'request']);
  });

  // Unregistering rebuilds the material too, and a parked scene would keep
  // showing the Effect's last frame.
  it('asks for a frame after unregistering', () => {
    const { Probe } = makeProbe();
    const { unmount } = render(<Probe />, { wrapper: Wrapper });

    events.length = 0;
    unmount();

    expect(events).toEqual(['unregister', 'request']);
  });

  it('asks for a frame after each half of a swap when deps change', () => {
    const { Probe } = makeProbe();
    const { rerender } = render(<Probe mode="a" />, { wrapper: Wrapper });

    events.length = 0;
    rerender(<Probe mode="b" />);

    expect(events).toEqual(['unregister', 'request', 'register', 'request']);
  });

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
