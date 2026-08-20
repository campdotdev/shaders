'use client';

// The mesh gradient's GPU half. The pixel's journey: center the coordinates,
// twist them by a slowly-drifting noise angle (different per pixel, which is
// what "melts" the shape), ripple them with sine waves, then blend four
// palette colors across the warped space — two side by side on top, two on
// the bottom, with soft seams. All eight palette colors live in uniforms, so
// changing `palettes` restyles the gradient without recompiling the shader —
// unlike the ramp-based components, which bake colors in.
import { useEffect, useMemo } from 'react';

import {
  type ColorSpace,
  elapsedTime,
  type HueInterpolation,
  mixColor,
  simplexNoise,
} from '@mattermix/shaders';
import {
  type AnimatableProp,
  useAnimatableSpeed,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@mattermix/shaders-react';
import { abs, cos, pow, sign, sin, smoothstep, uniform, uv, vec2, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector3 } from 'three/webgpu';

import { type Palette, parseColor } from '../utils/color';

export interface MeshGradientShaderProps {
  /**
   * Speed of the flowing warp motion. 0 freezes the flow (palette cycling
   * continues). Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * How many warp bends appear across the gradient. Higher values give
   * tighter, more numerous bends. Accepts a static value or an animation
   * signal.
   */
  frequency: AnimatableProp<number>;
  /**
   * Warp subtlety — larger values give a weaker, gentler warp; smaller
   * values distort harder. Accepts a static value or an animation signal.
   */
  amplitude: AnimatableProp<number>;
  /**
   * Speed of the cross-fade between the two `palettes`. 0 freezes the
   * cycle. Accepts a static value or an animation signal.
   */
  cycleSpeed: AnimatableProp<number>;
  /**
   * Easing of the palette cycle. 1 = a smooth sinusoidal ping-pong; below 1
   * holds each palette longer with snappier transitions; above 1 lingers in
   * the blended middle. Accepts a static value or an animation signal.
   */
  cycleEase: AnimatableProp<number>;
  /** Two palettes to cross-fade between as the gradient cycles. */
  palettes: [Palette, Palette];
  /** Color space the palettes are interpolated in. */
  colorSpace: ColorSpace;
  /** Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
}

// Tilt of the left/right color seam, in radians (-5 degrees). A perfectly
// vertical seam reads as two rectangles; the small tilt hides the geometry.
const LAYER_ROT_RAD = (-5 * Math.PI) / 180;

// One palette entry -> one stable color uniform. The Vector3 and uniform are
// created once; when the color string changes, the effect re-decodes it into
// the same vector, so the material never rebuilds for a palette change.
function useColorUniform(hex: string) {
  const vec = useMemo(
    () => {
      const [redChannel, greenChannel, blueChannel] = parseColor(hex);

      return new Vector3(redChannel, greenChannel, blueChannel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const node = useMemo(() => uniform(vec), [vec]);

  useEffect(() => {
    const [redChannel, greenChannel, blueChannel] = parseColor(hex);

    vec.set(redChannel, greenChannel, blueChannel);
  }, [hex, vec]);

  return node;
}

export function MeshGradientShader({
  speed,
  frequency,
  amplitude,
  cycleSpeed,
  cycleEase,
  palettes,
  colorSpace,
  hueInterpolation,
}: MeshGradientShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const [paletteA, paletteB] = palettes;

  const cyclePhaseUniform = useAnimatableSpeed(cycleSpeed);
  const cycleEaseUniform = useAnimatableUniform<number>(cycleEase);

  const paletteAColor0 = useColorUniform(paletteA[0]);
  const paletteAColor1 = useColorUniform(paletteA[1]);
  const paletteAColor2 = useColorUniform(paletteA[2]);
  const paletteAColor3 = useColorUniform(paletteA[3]);
  const paletteBColor0 = useColorUniform(paletteB[0]);
  const paletteBColor1 = useColorUniform(paletteB[1]);
  const paletteBColor2 = useColorUniform(paletteB[2]);
  const paletteBColor3 = useColorUniform(paletteB[3]);

  const phaseUniform = useAnimatableSpeed(speed);
  const frequencyUniform = useAnimatableUniform<number>(frequency);
  const amplitudeUniform = useAnimatableUniform<number>(amplitude);

  // Canvas aspect ratio (width/height), used to un-stretch the rotation
  // below. Starts from the current size (16:9 fallback while the canvas
  // reports 0) and follows every resize.
  const [initialWidth, initialHeight] = resize.get();
  const aspectNode = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectNode.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) aspectNode.value = updatedWidth / updatedHeight;
    });
  }, [resize, aspectNode]);

  useEffect(() => {
    if (!shaderContext) return;

    // ---------------------------------------------
    // Centered coordinates
    // ---------------------------------------------
    // Shift uv (0..1) so the origin sits at the canvas center; the rotation
    // below then pivots around the middle instead of the bottom-left corner.
    const centeredUv = uv().sub(vec2(0.5, 0.5));

    // ---------------------------------------------
    // Noise-driven rotation angle
    // ---------------------------------------------
    // Sample smooth noise at (slow time, x*y) and rescale its -1..1 output
    // to 0..1. Because x*y differs across the canvas, every pixel gets its
    // OWN angle — the "rotation" is really a smooth per-pixel swirl, which
    // is what melts the four-corner layout into organic blobs. The time axis
    // drifts the swirl slowly no matter what `speed` is doing.
    const slowTime = elapsedTime.mul(0.05);
    const noiseInput = vec2(slowTime, centeredUv.x.mul(centeredUv.y));
    const degree01 = simplexNoise(noiseInput).mul(0.5).add(0.5); // [0, 1]
    // angle = (degree01 - 0.5) * (720° in radians) + 180° in radians
    //       = (degree01 - 0.5) * 4π + π
    // i.e. up to two full turns in either direction, biased a half-turn.
    const TWO_TURNS_RAD = Math.PI * 4;
    const ROT_BIAS_RAD = Math.PI;
    const angle = degree01.sub(0.5).mul(TWO_TURNS_RAD).add(ROT_BIAS_RAD);

    // ---------------------------------------------
    // Aspect-corrected rotation
    // ---------------------------------------------
    // A full uv unit spans the whole width on x but the whole height on y,
    // so on a non-square canvas equal uv distances cover unequal pixel
    // distances — rotating in raw uv would shear the picture. Dividing y by
    // the aspect ratio first puts both axes in the same units, the rotation
    // happens in that square space, and multiplying back afterwards returns
    // to uv units.
    const aspect = aspectNode;
    const aspectCorrectedY = centeredUv.y.div(aspect);
    const cosineValue = cos(angle);
    const sineValue = sin(angle);
    // Componentwise rotation: (x', y') = (c*x - s*y, s*x + c*y).
    const rotatedX = centeredUv.x.mul(cosineValue).sub(aspectCorrectedY.mul(sineValue));
    const rotatedYUnit = centeredUv.x.mul(sineValue).add(aspectCorrectedY.mul(cosineValue));
    const rotatedY = rotatedYUnit.mul(aspect);
    const rotatedUv = vec2(rotatedX, rotatedY);

    // ---------------------------------------------
    // Sine domain warp
    // ---------------------------------------------
    // Ripple the coordinates before the colors are looked up: each axis is
    // nudged by a sine of the OTHER axis, so straight color seams come out
    // wavy. `frequency` sets how many bends fit across the canvas; the sine
    // is DIVIDED by `amplitude`, which is why larger amplitude values mean a
    // gentler warp. The y warp runs at 1.5x the frequency and 2x the
    // strength of the x warp — twin asymmetries that keep the ripples from
    // lining up into a visible grid. The accumulated phase (speed x delta
    // summed on the CPU) scrolls both sines, so a speed change shifts the
    // scroll tempo without snapping the ripples.
    const warpX = sin(rotatedUv.y.mul(frequencyUniform).add(phaseUniform)).div(amplitudeUniform);
    const warpY = sin(rotatedUv.x.mul(frequencyUniform).mul(1.5).add(phaseUniform))
      .div(amplitudeUniform)
      .mul(2);
    const warpedUv = vec2(rotatedUv.x.add(warpX), rotatedUv.y.add(warpY));

    // ---------------------------------------------
    // Time-cycling palette
    // ---------------------------------------------
    // sin() ping-pongs -1..1 forever; the sign/pow sandwich applies easing
    // without breaking the symmetry (pow on the absolute value curves the
    // shape, sign restores the direction). cycleEase < 1 flattens the curve
    // near the extremes — each palette holds longer with snappier
    // hand-offs; > 1 does the opposite, lingering in the blended middle.
    // The +1, *0.5 rescale turns the result into the 0..1 mix factor used
    // to cross-fade each of the four corner colors between palette A and B.
    const cycle = sin(cyclePhaseUniform);
    const eased = sign(cycle)
      .mul(pow(abs(cycle), cycleEaseUniform))
      .add(1)
      .mul(0.5);

    const color0 = mixColor(paletteAColor0, paletteBColor0, eased, colorSpace, hueInterpolation);
    const color1 = mixColor(paletteAColor1, paletteBColor1, eased, colorSpace, hueInterpolation);
    const color2 = mixColor(paletteAColor2, paletteBColor2, eased, colorSpace, hueInterpolation);
    const color3 = mixColor(paletteAColor3, paletteBColor3, eased, colorSpace, hueInterpolation);

    // ---------------------------------------------
    // Four corners, two seams
    // ---------------------------------------------
    // Lay the four colors out with two soft seams. The horizontal seam
    // position is measured along a slightly tilted axis (LAYER_ROT_RAD);
    // smoothstep turns position into a 0..1 blend weight, and each
    // a*(1-t) + b*t pair is a plain linear blend written out. Rows first:
    // the top row blends color2 (left) into color1 (right), the bottom row
    // color3 into color0. Then the vertical smoothstep — with its edges
    // reversed, so it's 0 near the top and 1 near the bottom — blends the
    // two rows. The seam bands (-0.3..0.2 and 0.5..-0.3) are deliberately
    // off-center so neither seam cuts the canvas in equal halves. In the
    // un-warped layout that puts color2 top-left, color1 top-right, color3
    // bottom-left, color0 bottom-right; the swirl and warp then smear those
    // anchors into each other.
    const layerCosine = Math.cos(LAYER_ROT_RAD);
    const layerSine = Math.sin(LAYER_ROT_RAD);
    const layerX = warpedUv.x.mul(layerCosine).sub(warpedUv.y.mul(layerSine));

    const horizontalMix = smoothstep(-0.3, 0.2, layerX);
    const layer1 = color2.mul(horizontalMix.oneMinus()).add(color1.mul(horizontalMix));
    const layer2 = color3.mul(horizontalMix.oneMinus()).add(color0.mul(horizontalMix));

    const verticalMix = smoothstep(0.5, -0.3, warpedUv.y);
    const color = layer1.mul(verticalMix.oneMinus()).add(layer2.mul(verticalMix));

    const material = new MeshBasicNodeMaterial();

    material.colorNode = vec4(color, 1);

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
      try {
        mesh.geometry.dispose();
      } catch {
        // same
      }
    };
  }, [
    shaderContext,
    aspectNode,
    phaseUniform,
    frequencyUniform,
    amplitudeUniform,
    cyclePhaseUniform,
    cycleEaseUniform,
    paletteAColor0,
    paletteAColor1,
    paletteAColor2,
    paletteAColor3,
    paletteBColor0,
    paletteBColor1,
    paletteBColor2,
    paletteBColor3,
    colorSpace,
    hueInterpolation,
  ]);

  return null;
}
