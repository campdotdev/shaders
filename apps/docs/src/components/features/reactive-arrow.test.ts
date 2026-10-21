// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  angleForHeading,
  arrowAtPointer,
  arrowTip,
  entryPoint,
  exitDistance,
  headingToward,
  STILL_FRAME_ARROW,
  swoopPose,
} from './reactive-arrow';

describe('the Reactive arrow', () => {
  // The mock's export at 2x draws the arrow's tip at about (548, 148).
  it('puts the still frame tip where the mock draws it', () => {
    const [x, y] = arrowTip(STILL_FRAME_ARROW);

    expect(Math.abs(x - 274)).toBeLessThan(3);
    expect(Math.abs(y - 74)).toBeLessThan(3);
  });

  it('keeps the tip on the pointer at any heading', () => {
    for (const heading of [-150, -40, 0, 90, 200]) {
      const [x, y] = arrowTip(arrowAtPointer([120, 200], angleForHeading(heading)));

      expect(x).toBeCloseTo(120);
      expect(y).toBeCloseTo(200);
    }
  });

  // In the mock the arrow points up and to the right, about 40 degrees
  // above the horizontal, which is a heading of about -40 with y down.
  it('turns the arrow to the mock angle for the still frame heading', () => {
    expect(Math.abs(angleForHeading(-40) - STILL_FRAME_ARROW.angle)).toBeLessThan(2);
  });

  describe('turning toward a move', () => {
    it('heads the way the move goes', () => {
      expect(headingToward(0, 0, 10)).toBeCloseTo(90);
      expect(headingToward(10, -10, 0)).toBeCloseTo(180);
    });

    it('turns the short way round, past a full turn when it has to', () => {
      // At 170 degrees, a move toward -170 is 20 degrees on, not 340 back.
      const [dx, dy] = [Math.cos((-170 * Math.PI) / 180), Math.sin((-170 * Math.PI) / 180)];

      expect(headingToward(170, dx, dy)).toBeCloseTo(190);
      expect(headingToward(-190, dx, dy)).toBeCloseTo(-170);
    });
  });

  // The window is 312 by 309 mock pixels. The arrow starts its flight back
  // in 90 past the edge, out of sight.
  describe('where the arrow flies back in from', () => {
    it('comes in past the edge the pointer came in over', () => {
      expect(entryPoint([100, 340])).toEqual([100, 399]);
      expect(entryPoint([-10, 150])).toEqual([-90, 150]);
      expect(entryPoint([200, -20])).toEqual([200, -90]);
      expect(entryPoint([330, 50])).toEqual([402, 50]);
    });

    it('comes in past the nearest edge for a pointer already inside', () => {
      expect(entryPoint([20, 150])).toEqual([-90, 150]);
      expect(entryPoint([150, 300])).toEqual([150, 399]);
    });

    it('slides along the edge for a pointer that came in past a corner', () => {
      expect(entryPoint([-40, -10])).toEqual([-90, 0]);
    });
  });

  describe('flying off the window', () => {
    // From the middle of the 312 by 309 window, heading right, the arrow
    // clears the right edge and the 90 pixels past it.
    it('flies far enough along its heading to leave the window out of sight', () => {
      expect(exitDistance([156, 150], 0)).toBeCloseTo(312 + 90 - 156);
      expect(exitDistance([156, 150], 90)).toBeCloseTo(309 + 90 - 150);
      expect(exitDistance([156, 150], 180)).toBeCloseTo(156 + 90);
    });

    it('is out of sight already from past the margin', () => {
      expect(exitDistance([500, 150], 0)).toBe(0);
    });
  });

  describe('the swoop back in along the J', () => {
    it('lands exactly on the still frame', () => {
      const pose = swoopPose(1);

      expect(pose.x).toBeCloseTo(STILL_FRAME_ARROW.x);
      expect(pose.y).toBeCloseTo(STILL_FRAME_ARROW.y);
      expect(pose.angle).toBeCloseTo(STILL_FRAME_ARROW.angle);
    });

    it('starts with its tip below the window, out of sight', () => {
      expect(arrowTip(swoopPose(0))[1]).toBeGreaterThan(309);
    });
  });
});
