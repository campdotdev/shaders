'use client';

// TEMPORARY tuning rig for the Components banner (SHA-144): the banner
// scene at its fixed size with a panel over its feel constants. Dev route:
// invisible to production builds. Goes at the defaults gate with the
// `tuning` prop it drives.
import { BannerProbe } from './probe';

export default function BannerProbePage() {
  return <BannerProbe />;
}
