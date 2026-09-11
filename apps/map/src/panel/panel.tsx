// The right-hand column. The header names the flow and its payload, or the
// hovered district or module while the pointer is over one. Below it, two
// tabs of prose, then the step list with the current step highlighted and
// each step's files as VS Code links. Clicking a step seeks to it.
import { useState } from 'react';

import { moduleById, neighborhoodById } from '@/data';
import { useHovered } from '@/hover/store';
import { playback } from '@/timeline/store';
import { usePlayback } from '@/timeline/use-playback';

import { FileLink } from './file-link';

type Tab = 'what' | 'how';

export function Panel() {
  const hovered = useHovered();
  const { flow, stepIndex } = usePlayback();
  const [tab, setTab] = useState<Tab>('what');
  const hoveredNeighborhood =
    hovered?.kind === 'neighborhood' ? neighborhoodById(hovered.id) : undefined;
  const hoveredModule = hovered?.kind === 'module' ? moduleById(hovered.id) : undefined;
  const paragraphs = tab === 'what' ? flow.whatItDoes : flow.howItsBuilt;

  return (
    <aside className="panel">
      <header className="panel-header">
        {hoveredNeighborhood !== undefined && (
          <>
            <h1 style={{ color: hoveredNeighborhood.color }}>{hoveredNeighborhood.name}</h1>
            <p>{hoveredNeighborhood.description}</p>
          </>
        )}
        {hoveredModule !== undefined && (
          <>
            <h1>{hoveredModule.name}</h1>
            <p>{hoveredModule.summary}</p>
            <FileLink path={hoveredModule.path} />
          </>
        )}
        {hovered === null && (
          <>
            <h1>{flow.title}</h1>
            <p>
              <strong>Payload: {flow.payload.name}.</strong> {flow.payload.description}
            </p>
          </>
        )}
      </header>
      <div className="tabs" role="tablist">
        <button
          aria-selected={tab === 'what'}
          onClick={() => {
            setTab('what');
          }}
          role="tab"
          type="button"
        >
          What it does
        </button>
        <button
          aria-selected={tab === 'how'}
          onClick={() => {
            setTab('how');
          }}
          role="tab"
          type="button"
        >
          How it&apos;s built
        </button>
      </div>
      <section className="prose" role="tabpanel">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>
      <ol className="steps">
        {flow.steps.map((step, index) => (
          <li className={index === stepIndex ? 'step current' : 'step'} key={step.caption}>
            <button
              onClick={() => {
                playback.seekToStep(index);
              }}
              type="button"
            >
              <span className="step-number">{index + 1}</span>
              <span>{step.caption}</span>
            </button>
            <ul className="step-files">
              {step.files.map((file) => (
                <li key={file}>
                  <FileLink path={file} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </aside>
  );
}
