'use client';

/**
 * The floating table of contents beside the shader preview: a stack of
 * short lines in the gutter between the sidebar and the page, one per
 * section, that opens a menu of the page's sections on hover. The lines
 * rest at the shader's vertical center on load and pin to the middle of the
 * viewport once the page scrolls past them, so the menu stays within reach
 * anywhere on the page. The shared components/[slug] template renders it
 * with a fixed section list, because every component page has the same
 * sections; nothing here reads headings out of the page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Popover } from '@base-ui/react/popover';

import { pickCurrentSection } from './current-section';
import styles from './page-toc.module.css';

export interface PageTocSection {
  /** The id of the element the row scrolls to. */
  id: string;
  /** The row's text. */
  label: string;
}

// How long the pointer rests on the lines before the menu opens, in ms. The
// lines sit in the gutter the pointer crosses on its way from the sidebar to
// the page, so an instant open would flash the menu on every crossing. Long
// enough to tell a rest from a crossing, short enough to feel like hover.
const OPEN_DELAY_MS = 150;

// ----------------------------------------------------------------------------
// Which section is current
// ----------------------------------------------------------------------------

/**
 * Tracks which of the given elements the reader is in as the page scrolls.
 * This hook only measures: once a frame it reads where every section's title
 * sits and how far the page has scrolled, and pickCurrentSection in
 * current-section.ts applies the rules (a chosen section holds while its
 * title is on screen, the last section wins at the bottom of the page, and
 * otherwise the reading line decides). The hold on a chosen section is the
 * one rule that can keep a title other than the last one lit at the bottom.
 * That happens only when a menu jump landed there because the page ran out
 * of scroll, and the reader has just said which section they meant, so it
 * stays. Releasing it on the next wheel or key press instead would flip the
 * lit row to the last section after a one-pixel nudge, with the chosen title
 * still in the middle of the screen.
 * Returns the current id and the function the menu calls with a choice.
 */
function useCurrentSection(ids: string[]): [string | undefined, (id: string) => void] {
  const [currentId, setCurrentId] = useState(ids[0]);
  const chosenRef = useRef<string | null>(null);
  // The list is a new array on every render, so the effect keys on its
  // contents.
  const key = ids.join('|');

  const choose = useCallback((id: string) => {
    chosenRef.current = id;
    setCurrentId(id);
  }, []);

  useEffect(() => {
    const elements: HTMLElement[] = [];

    for (const id of key.split('|')) {
      const element = document.getElementById(id);

      if (element) elements.push(element);
    }

    let frame = 0;

    const measure = () => {
      frame = 0;

      const { index, held } = pickCurrentSection({
        tops: elements.map((element) => element.getBoundingClientRect().top),
        chosenIndex: elements.findIndex((element) => element.id === chosenRef.current),
        viewportHeight: window.innerHeight,
        scrollTop: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
      });

      if (!held) chosenRef.current = null;

      setCurrentId(elements[index]?.id);
    };

    // One measurement per frame however many scroll events arrive in it.
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [key]);

  return [currentId, choose];
}

// ----------------------------------------------------------------------------
// The lines and the menu
// ----------------------------------------------------------------------------

export function PageToc({ sections }: { sections: PageTocSection[] }) {
  const [open, setOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const [activeId, choose] = useCurrentSection(sections.map((section) => section.id));

  return (
    <div className={styles.dock} ref={dockRef}>
      <Popover.Root onOpenChange={setOpen} open={open}>
        <Popover.Trigger className={styles.trigger} delay={OPEN_DELAY_MS} openOnHover>
          <span className={styles.srOnly}>On this page</span>
          {sections.map((section) => (
            <span
              aria-hidden="true"
              className={styles.line}
              data-active={section.id === activeId || undefined}
              key={section.id}
            />
          ))}
        </Popover.Trigger>
        {/* The portal lands inside the sticky dock rather than at the end of
            <body>. The browser then carries the lines and the menu together
            on every scroll frame, and the positioner's offset, measured from
            the dock, never changes. Portaled to <body>, the menu would chase
            the lines with a document-coordinate update one frame behind the
            scroll, which reads as jitter. */}
        <Popover.Portal container={dockRef}>
          <Popover.Positioner align="center" side="right" sideOffset={6}>
            <Popover.Popup className={styles.popup}>
              <nav aria-label="On this page">
                <ul className={styles.list}>
                  {sections.map((section) => (
                    <li key={section.id}>
                      {/* Following a row is the end of the visit: the menu
                        closes so it does not sit over the section it just
                        scrolled to, and that section is current from here
                        on, whatever the scroll position says. */}
                      <a
                        aria-current={section.id === activeId ? 'location' : undefined}
                        className={styles.row}
                        href={`#${section.id}`}
                        onClick={() => {
                          choose(section.id);
                          setOpen(false);
                        }}
                      >
                        {section.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
