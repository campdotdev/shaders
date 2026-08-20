// The CPU half of sRGB gamma conversion. Screens don't store brightness
// linearly: sRGB channels are gamma-encoded so more precision goes to dark
// tones, where eyes are most sensitive. Color MATH only works right on linear
// values (where 0.5 really is half the light of 1.0), so these convert each way.
// This file imports nothing on purpose — it is the reason `@mattermix/shaders/color`
// can be imported during a server render. The TSL node versions of the same two
// curves live next door in transfer.ts, behind a three import.

/**
 * sRGB-encoded channel in [0,1] -> linear-sRGB. Standard sRGB EOTF ("decode").
 * Mirrors three's `convertSRGBToLinear` (e.g. 0.5 -> 0.21404114).
 */
export function srgbChannelToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * Linear-sRGB channel -> sRGB-encoded. The inverse of `srgbChannelToLinear`
 * (standard sRGB OETF, "encode"). Values outside [0,1] pass through the same
 * curve rather than being clamped, so callers that need displayable bytes clamp
 * at their end.
 */
export function linearChannelToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}
