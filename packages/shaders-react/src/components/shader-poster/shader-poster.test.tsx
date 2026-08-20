import { useContext, useEffect } from 'react';

import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PosterContext, type PosterContextValue } from './poster-context.js';
import { ShaderPoster } from './shader-poster.js';

// Stands in for ShaderScene: grabs the poster controls off context so the
// test can drive the paint signal the way a real scene would.
function SceneStub({ onControls }: { onControls: (controls: PosterContextValue) => void }) {
  const posterControls = useContext(PosterContext);

  useEffect(() => {
    if (posterControls) onControls(posterControls);
  }, [posterControls, onControls]);

  return <canvas data-testid="scene" />;
}

function renderPosterWithStub() {
  let controls: PosterContextValue | null = null;
  const utils = render(
    <ShaderPoster poster={<img alt="poster" data-testid="poster" src="/p.jpg" />}>
      <SceneStub
        onControls={(received) => {
          controls = received;
        }}
      />
    </ShaderPoster>,
  );

  if (!controls) throw new Error('SceneStub never received poster controls');

  return { ...utils, controls: controls as PosterContextValue };
}

describe('ShaderPoster', () => {
  it('shows the poster and mounts children before the shader paints', () => {
    const { queryByTestId } = renderPosterWithStub();

    expect(queryByTestId('poster')).toBeInTheDocument();
    expect(queryByTestId('scene')).toBeInTheDocument();
  });

  it('drops the poster when the scene signals a painted frame', () => {
    const { queryByTestId, controls } = renderPosterWithStub();

    act(() => {
      controls.setShaderPainted(true);
    });

    expect(queryByTestId('poster')).not.toBeInTheDocument();
    expect(queryByTestId('scene')).toBeInTheDocument();
  });

  it('re-shows the poster when the scene signals painted=false', () => {
    const { queryByTestId, controls } = renderPosterWithStub();

    act(() => {
      controls.setShaderPainted(true);
    });
    act(() => {
      controls.setShaderPainted(false);
    });

    expect(queryByTestId('poster')).toBeInTheDocument();
  });
});
