import type { ShaderNodeObject } from 'three/tsl';
import { cbrt, mix, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { ColorSpaceImpl } from './types.js';

/** linear-sRGB -> OKLab (L, a, b). */
export function linearToOklab(rgb: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;

  // Step 1: linear RGB -> LMS (cone response) via matrix M1.
  const longCone = r.mul(0.4122214708).add(g.mul(0.5363325363)).add(b.mul(0.0514459929));
  const mediumCone = r.mul(0.2119034982).add(g.mul(0.6806995451)).add(b.mul(0.1073969566));
  const shortCone = r.mul(0.0883024619).add(g.mul(0.2817188376)).add(b.mul(0.6299787005));

  // Step 2: the perceptual cube-root nonlinearity.
  const longRoot = cbrt(longCone);
  const mediumRoot = cbrt(mediumCone);
  const shortRoot = cbrt(shortCone);

  // Step 3: LMS' -> OKLab via matrix M2.
  const lightness = longRoot
    .mul(0.2104542553)
    .add(mediumRoot.mul(0.793617785))
    .sub(shortRoot.mul(0.0040720468));
  const greenRed = longRoot
    .mul(1.9779984951)
    .sub(mediumRoot.mul(2.428592205))
    .add(shortRoot.mul(0.4505937099));
  const blueYellow = longRoot
    .mul(0.0259040371)
    .add(mediumRoot.mul(0.7827717662))
    .sub(shortRoot.mul(0.808675766));

  return vec3(lightness, greenRed, blueYellow);
}

/** OKLab (L, a, b) -> linear-sRGB. */
export function oklabToLinear(lab: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const lightness = lab.x;
  const greenRed = lab.y;
  const blueYellow = lab.z;

  // Inverse of step 3: OKLab -> LMS'.
  const longRoot = lightness.add(greenRed.mul(0.3963377774)).add(blueYellow.mul(0.2158037573));
  const mediumRoot = lightness.sub(greenRed.mul(0.1055613458)).sub(blueYellow.mul(0.0638541728));
  const shortRoot = lightness.sub(greenRed.mul(0.0894841775)).sub(blueYellow.mul(1.291485548));

  // Inverse of step 2: cube (x^3) to undo the cube root.
  const longCone = longRoot.mul(longRoot).mul(longRoot);
  const mediumCone = mediumRoot.mul(mediumRoot).mul(mediumRoot);
  const shortCone = shortRoot.mul(shortRoot).mul(shortRoot);

  // Inverse of step 1: LMS -> linear RGB.
  const r = longCone
    .mul(4.0767416621)
    .sub(mediumCone.mul(3.3077115913))
    .add(shortCone.mul(0.2309699292));
  const g = longCone
    .mul(-1.2684380046)
    .add(mediumCone.mul(2.6097574011))
    .sub(shortCone.mul(0.3413193965));
  const b = longCone
    .mul(-0.0041960863)
    .sub(mediumCone.mul(0.7034186147))
    .add(shortCone.mul(1.707614701));

  return vec3(r, g, b);
}

export const oklabSpace: ColorSpaceImpl = {
  fromLinear: linearToOklab,
  toLinear: oklabToLinear,
  lerp: (a, b, t) => mix(a, b, t),
};
