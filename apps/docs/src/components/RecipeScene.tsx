'use client';

import { useEffect, useMemo } from 'react';

import { ShaderScene, useCursor, useShaderContext } from '@lovo/matter-react';
import { uniform } from 'three/tsl';
import { Vector2 } from 'three/webgpu';

import { RECIPE_BUILDS } from '@/app/recipes/_builds';
import { addPlaneMesh } from '@/lib/meshUtils';

interface RecipeSceneProps {
  slug: string;
  variant: string;
}

export function RecipeScene({ slug, variant }: RecipeSceneProps) {
  return (
    <ShaderScene>
      <RecipeMesh slug={slug} variant={variant} />
    </ShaderScene>
  );
}

function RecipeMesh({ slug, variant }: { slug: string; variant: string }) {
  const shaderContext = useShaderContext();
  const cursor = useCursor();

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  useEffect(() => {
    return cursor.on('change', ([cursorX, cursorY]) => cursorVec.set(cursorX, 1 - cursorY));
  }, [cursor, cursorVec]);

  useEffect(() => {
    if (!shaderContext) return;
    const key = `${slug}.${variant}`;
    const build = RECIPE_BUILDS[key];

    if (!build) return;

    const colorNode = build({ cursorUniform });

    return addPlaneMesh(shaderContext, colorNode);
  }, [shaderContext, slug, variant, cursorUniform]);

  return null;
}
