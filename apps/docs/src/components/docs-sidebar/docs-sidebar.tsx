'use client';

/**
 * The docs sidebar after the Figma mock: group headers over rows, with the
 * current page's row highlighted in lime. It renders whatever tree the docs
 * shell hands it: on a component page the top level is the taxonomy's
 * category groups, and on a guide it is the section's groups, which may
 * nest one level (Frameworks holds React). NavGroup (nav-tree/) draws both
 * levels, and whether the tree nests at all reaches the stylesheet as a data
 * attribute, which keys the top header's size off it and nothing else. A
 * client component because the active row comes from the pathname, because
 * a row click has to pin the sidebar before the page changes, and because
 * the sticky box's cap is a measurement: how far the nav sits below the
 * viewport's top, taken on every scroll and resize. The tree scrolls inside
 * the shared ScrollArea with both of its edge fades on, so a row clipped by
 * the cap reads as clipped rather than as the last row.
 */
import { usePathname } from 'next/navigation';
import { type MouseEvent, useEffect, useRef } from 'react';

import navRowStyles from '@/components/nav-row/nav-row.module.css';
import { navigatesThisTab, treeNests } from '@/components/nav-tree/helpers';
import { NavGroup, type NavTreeClassNames } from '@/components/nav-tree/nav-tree';
import { ScrollArea } from '@/components/scroll-area/scroll-area';
import type { ResolvedNavGroup } from '@/content/types';

import styles from './docs-sidebar.module.css';

// The tree's look, from this file's stylesheet and the link row it shares
// with the table of contents; its markup is NavGroup's.
const TREE_CLASS_NAMES: NavTreeClassNames = {
  group: styles.group,
  groupHeader: styles.groupHeader,
  list: styles.list,
  row: `${navRowStyles.row} ${styles.row}`,
};

// How far from either edge, in px, still counts as reaching it before the
// fade over that edge goes off. Matches the tree's padding, the control
// panel's reasoning (DemoLayout.tsx): an overflow that small clips nothing
// but padding, so the row at that edge is fully visible and a fade over it
// would only hide it. One value for both edges because .tree pads both by
// the same 16px.
const FADE_THRESHOLD_PX = 16;

export function DocsSidebar({ tree }: { tree: ResolvedNavGroup[] }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // A tree that nests takes a larger top-level header than a flat one.
  const nests = treeNests(tree);

  // The nav is sticky under a header and banner that scroll away, so until
  // it pins its top sits some way down the viewport, and a 100vh box would
  // hang that far below the fold. The scroll viewport is contained (see the
  // stylesheet), so the page never scrolls to pin the nav while the wheel is
  // over the tree, and that hidden tail would be unreachable. This measures
  // the distance from the viewport's top to the nav's on every scroll and
  // resize and hands it to the cap, so the box always ends at the fold: 200px
  // short of 100vh at the top of a component page, exactly 100vh once
  // pinned. The window scroll pinSidebar makes fires this too. One effect
  // owns add and remove, so Strict Mode's double mount is safe.
  useEffect(() => {
    const nav = navRef.current;

    if (!nav) return;

    // An expression rather than a declaration: a declaration hoists above
    // the null check, so TypeScript would not carry the narrowing into it.
    const measureOffset = () => {
      // Under 48rem of the site the sidebar is display: none and the
      // dropdown in main carries the tree instead, but this component still
      // mounts and this listener still runs. The cap means nothing while
      // the box is off screen, so a hidden sidebar does none of the work
      // below: the write invalidates style on the nav, and the next scroll
      // event's getBoundingClientRect has to flush that style back out, so
      // a phone pays for the pair through a whole momentum scroll to set a
      // custom property no rule is reading. offsetParent is the test
      // because on an element like this one it is null exactly when
      // display: none applies, to it or to an ancestor. It cannot misfire
      // on a rendered sidebar: the other way to null it is position: fixed,
      // and .sidebar is sticky (docs-sidebar.module.css), which keeps a
      // normal offsetParent. Coming back into range is a resize, and that
      // listener measures again in the same frame, so the cap is right
      // before the box paints.
      if (nav.offsetParent === null) return;

      const offset = Math.max(0, nav.getBoundingClientRect().top);

      nav.style.setProperty('--sidebar-offset', `${offset}px`);
    };

    measureOffset();
    window.addEventListener('scroll', measureOffset, { passive: true });
    window.addEventListener('resize', measureOffset);

    return () => {
      window.removeEventListener('scroll', measureOffset);
      window.removeEventListener('resize', measureOffset);
      nav.style.removeProperty('--sidebar-offset');
    };
  }, []);

  // The sidebar is sticky under a header and banner that scroll away, so a
  // reader reaches its lower groups by scrolling the window until the nav
  // pins at the top of the viewport. Next's default scroll-to-top on
  // navigation would then drop the nav back under the banner and push those
  // groups below the fold again (SHA-130). So the rows opt out of that
  // scroll, and this handler, which every row runs on the old page before
  // the router swaps in the new one, brings the window up to the point where
  // the nav pins. A reader who was past the banner lands with the sidebar
  // exactly where it was and the new page's breadcrumbs at the top; a reader
  // who was not sees nothing move. Doing it here rather than after the route
  // changes leaves back and forward to the browser's own scroll restoration.
  // A modifier-key click leaves this page alone, and a keyboard reader's
  // Enter gets the same pin (navigatesThisTab).
  function pinSidebar(event: MouseEvent<HTMLAnchorElement>) {
    const shell = navRef.current?.parentElement;

    if (!navigatesThisTab(event) || !shell) return;

    const shellTop = shell.getBoundingClientRect().top + window.scrollY;

    if (window.scrollY > shellTop) window.scrollTo({ top: shellTop, behavior: 'instant' });
  }

  return (
    <nav aria-label="Docs" className={styles.sidebar} data-pagefind-ignore="all" ref={navRef}>
      <ScrollArea
        edgeFades="both"
        overflowEdgeThreshold={FADE_THRESHOLD_PX}
        viewportClassName={styles.viewport}
      >
        <div className={styles.tree} data-nests={nests || undefined}>
          {/* scroll={false} keeps the window where pinSidebar put it. */}
          {tree.map((group) => (
            <NavGroup
              classNames={TREE_CLASS_NAMES}
              group={group}
              key={group.label}
              level={2}
              onRowClick={pinSidebar}
              pathname={pathname}
              scroll={false}
            />
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}
