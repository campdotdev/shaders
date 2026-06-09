'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';

import type { PrimitiveControl } from '@/data/primitives';

import { buildPrimitiveParams } from './PrimitiveScene';
import {
  initialStateFromSchema,
  type PropSchema,
  PropsPlayground,
  type PropsState,
} from './PropsPlayground';

interface PrimitiveDemoProps {
  slug: string;
  controls: readonly PrimitiveControl[];
}

const PrimitiveScene = dynamic(() => import('./PrimitiveScene').then((m) => m.PrimitiveScene), {
  ssr: false,
});

const buildSchema = (controls: readonly PrimitiveControl[]): PropSchema =>
  controls.map((c) => ({
    name: c.name,
    type: 'number' as const,
    default: c.default,
    min: c.min,
    max: c.max,
    step: c.step,
  }));

export function PrimitiveDemo({ slug, controls }: PrimitiveDemoProps) {
  const schema = buildSchema(controls);
  const [params, setParams] = useState<PropsState>(() => initialStateFromSchema(schema));

  const primitive = useMemo(() => buildPrimitiveParams(slug, params), [slug, params]);

  const handleChange = useCallback((next: PropsState) => {
    setParams(next);
  }, []);

  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: 320,
          background: '#0a0a14',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        <PrimitiveScene primitive={primitive} />
      </div>
      {schema.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <PropsPlayground onChange={handleChange} schema={schema} />
        </div>
      )}
    </div>
  );
}
