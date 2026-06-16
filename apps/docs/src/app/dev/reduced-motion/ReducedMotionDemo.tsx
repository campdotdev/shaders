'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { type ReducedMotionPolicy, setReducedMotionPolicy } from '@lovo/matter';
import { ShaderScene } from '@lovo/matter-react';
import { LinearGradient } from '@matter/registry/linear-gradient';
import { Pane } from 'tweakpane';

const Waves = dynamic(() => import('@matter/registry/waves').then((m) => m.Waves), { ssr: false });

const INITIAL_PARAMS: { policy: ReducedMotionPolicy } = { policy: 'auto' };

export function ReducedMotionDemo() {
  const paneRef = useRef<HTMLDivElement>(null);
  const [policy, setPolicy] = useState<ReducedMotionPolicy>('auto');

  useEffect(() => {
    if (!paneRef.current) return;

    const params = { ...INITIAL_PARAMS };
    const pane = new Pane({
      container: paneRef.current,
      title: 'Reduced motion',
    });

    pane
      .addBinding(params, 'policy', {
        options: { auto: 'auto', off: 'off', slow: 'slow', paused: 'paused' },
      })
      .on('change', (e) => {
        setPolicy(e.value);
        setReducedMotionPolicy(e.value);
      });

    return () => pane.dispose();
  }, []);

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            LinearGradient
          </p>
          <div style={{ position: 'relative', width: 600, height: 400 }}>
            <ShaderScene style={{ borderRadius: 8 }}>
              <LinearGradient
                angle={45}
                speed={1}
                stops={[{ color: '#ff7b72' }, { color: '#7b9cff' }, { color: '#7bff9c' }]}
              />
            </ShaderScene>
          </div>
        </div>
        <div>
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Waves
          </p>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#666' }}>
            The waves should freeze when policy is paused.
          </p>
          <div style={{ position: 'relative', width: 600, height: 400 }}>
            <ShaderScene style={{ borderRadius: 8 }}>
              <Waves />
            </ShaderScene>
          </div>
        </div>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          Active policy: <code>{policy}</code>
        </p>
      </div>
      <div ref={paneRef} style={{ position: 'sticky', top: '1rem', width: 280 }} />
    </div>
  );
}
