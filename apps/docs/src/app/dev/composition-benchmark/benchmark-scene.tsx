'use client';

// Benchmark for any composition and preset with ShaderMonitor's GPU readout,
// at the homepage hero's 1636 by 696 CSS pixels, where every composition must
// hold to the Gallery's GPU budget: 4 ms per frame at most and 2 ms as the
// goal, at 2x on the M1 Max. Read every preset, and keep the most expensive
// under the limit. `?composition=<slug>&preset=<preset>` picks what to draw,
// with the preset as its golden file's name, such as `default`, and `?dpr=2`
// caps the canvas at two pixels per CSS pixel, anything else at one.
import { useState } from 'react';

import { ShaderMonitor, useStaticSceneHint } from '@camp-dev/shaders';

import { COMPOSITIONS } from '@/compositions';
import { CompositionScene } from '@/compositions/composition-scene';
import { kebabCase, presetNames } from '@/compositions/generate';
import { presetProps } from '@/compositions/store';

const WIDTH = 1636;
const HEIGHT = 696;

interface Settings {
  slug: string;
  preset: string;
  pixelRatio: number;
}

const readSettings = (): Settings => {
  const search = new URLSearchParams(window.location.search);

  return {
    slug: search.get('composition') ?? COMPOSITIONS[0]?.slug ?? '',
    preset: search.get('preset') ?? 'default',
    pixelRatio: search.get('dpr') === '2' ? 2 : 1,
  };
};

/**
 * Votes the scene animated, so a still scene keeps drawing frames and the GPU
 * readout averages many frames instead of settling on one.
 */
function KeepDrawing() {
  useStaticSceneHint(false);

  return null;
}

const href = ({ slug, preset, pixelRatio }: Settings) =>
  `?composition=${slug}&preset=${preset}&dpr=${pixelRatio}`;

// Time each reading with no other scene drawing, since a second scene
// inflates it (the skewed-readout gotcha in docs/agents/tsl.md). The links
// are full page loads, so each measurement starts from a fresh renderer.
export default function BenchmarkScene() {
  const [settings] = useState(readSettings);
  const composition = COMPOSITIONS.find(({ slug }) => slug === settings.slug);
  const presetName =
    composition === undefined
      ? undefined
      : presetNames(composition).find((name) => kebabCase(name) === settings.preset);

  return (
    <main style={{ padding: 24, background: '#000', color: '#fff', minHeight: '100vh' }}>
      <div style={{ margin: '0 0 16px', font: '13px ui-monospace, monospace' }}>
        {COMPOSITIONS.map((candidate) => (
          <p key={candidate.slug} style={{ margin: '0 0 4px' }}>
            {candidate.title}:{' '}
            {presetNames(candidate).map((name) => (
              <span key={name}>
                <a href={href({ ...settings, slug: candidate.slug, preset: kebabCase(name) })}>
                  {name}
                </a>{' '}
              </span>
            ))}
          </p>
        ))}
        <p style={{ margin: 0 }}>
          {composition?.title ?? settings.slug} · {presetName ?? settings.preset} at {WIDTH} ×{' '}
          {HEIGHT} CSS px, pixel ratio capped at {settings.pixelRatio}x.{' '}
          <a href={href({ ...settings, pixelRatio: 1 })}>1x</a> ·{' '}
          <a href={href({ ...settings, pixelRatio: 2 })}>2x</a>
        </p>
      </div>
      {composition === undefined || presetName === undefined ? (
        <p>No composition or preset by that name.</p>
      ) : (
        <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
          {/* No library defaults here: the document's props and the
              preset's override are what the copied file sets, and the
              components fill in the rest themselves. */}
          <CompositionScene
            composition={composition}
            maxDPR={settings.pixelRatio}
            props={presetProps(composition, {}, presetName)}
          >
            <KeepDrawing />
            <ShaderMonitor anchor="top-left" />
          </CompositionScene>
        </div>
      )}
    </main>
  );
}
