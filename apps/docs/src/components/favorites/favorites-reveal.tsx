'use client';

/**
 * The favorites' entrance: the grid that holds the heading and the cards,
 * which reveals them in reading order, the heading first. While the
 * homepage hero pins, the reveal follows the hero's scroll progress from
 * the moment the grid comes into view, so the last card lands as the demo
 * does, and scrolling back up takes it back (reveal-scrub.ts holds those
 * numbers). Wherever the hero doesn't pin, it plays once on its own clock
 * the first time the grid scrolls into view (favorites.module.css holds
 * that motion). Either way, the server renders the grid at rest, and only
 * a grid still below the viewport when the page hydrates is hidden to wait
 * for its reveal, so a grid already on screen never blinks out, and with
 * no JavaScript the grid simply shows. Under reduced motion it stays at
 * rest.
 */
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import type { MotionValue } from 'motion/react';

import { useHeroProgress } from '@/components/home-hero/hero-progress';

import { cardRevealAt, itemRevealAt } from './reveal-scrub';

// The played reveal starts once the grid's top has risen this far above
// the viewport's bottom, as a share of the viewport's height. At 0% it
// plays as the grid's first pixels appear. Higher waits until more of the
// grid is on screen.
const REVEAL_LINE = '0%';

/** Where the played reveal stands: hidden and waiting, or revealed. Unset is at rest. */
type Reveal = 'pending' | 'shown';

export function FavoritesReveal({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState<Reveal>();
  const heroProgress = useHeroProgress();

  // Picks the reveal for where the grid stands now: none if it is on screen
  // or above it, the scrub while the hero pins, and the played reveal
  // otherwise. Runs again when the hero starts or stops pinning, as it does
  // once the hero has measured itself after hydration, or on a resize.
  useLayoutEffect(() => {
    const grid = gridRef.current;

    setReveal(undefined);
    if (!grid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (grid.getBoundingClientRect().top < window.innerHeight) return undefined;
    if (heroProgress) return scrubReveal(grid, heroProgress);
    setReveal('pending');
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setReveal('shown');
        observer.disconnect();
      },
      { rootMargin: `0px 0px ${REVEAL_LINE} 0px` },
    );

    observer.observe(grid);

    return () => observer.disconnect();
  }, [heroProgress]);

  return (
    <div className={className} data-reveal={reveal} ref={gridRef}>
      {children}
    </div>
  );
}

// ---- The scrubbed reveal

// Drives the heading and the cards from the hero's progress, writing their
// styles straight to the elements on each change, so the scroll re-renders
// nothing. The reveal's own range starts at the progress where the grid's
// top first comes into view and ends at 1, where the hero's demo lands.
// Returns the cleanup, which puts every item back at rest.
function scrubReveal(grid: HTMLElement, progress: MotionValue<number>) {
  const heading = grid.querySelector<HTMLElement>(':scope > h2');
  const cards = [...grid.querySelectorAll<HTMLElement>('li')];
  const count = cards.length + 1;
  // Every card shares one size, so the first stands for all of them.
  let cardHeight = cards[0]?.offsetHeight ?? 0;
  // The hero's progress when the grid came into view, or null until then.
  let start: number | null = null;

  const apply = (at: number) => {
    if (start === null && grid.getBoundingClientRect().top < window.innerHeight) start = at;
    const reveal = start === null || start >= 1 ? 0 : Math.max(0, (at - start) / (1 - start));

    if (heading) heading.style.opacity = String(itemRevealAt(reveal, 0, count));
    cards.forEach((card, index) => {
      const { y, mask } = cardRevealAt(itemRevealAt(reveal, index + 1, count), cardHeight);

      card.style.transform = y > 0 ? `translateY(${y}px)` : '';
      card.style.maskImage = mask === 'none' ? '' : mask;
    });
  };
  // A resize changes the cards' size, and with it how far each one rises.
  const observer = new ResizeObserver(() => {
    cardHeight = cards[0]?.offsetHeight ?? 0;
    apply(progress.get());
  });

  observer.observe(grid);
  apply(progress.get());
  const unsubscribe = progress.on('change', apply);

  return () => {
    unsubscribe();
    observer.disconnect();
    if (heading) heading.style.opacity = '';
    for (const card of cards) {
      card.style.transform = '';
      card.style.maskImage = '';
    }
  };
}
