/**
 * The docs tree's groups and rows, shared by the sidebar on a wide viewport
 * and the dropdown on a narrow one. Both draw the same tree with the same
 * structure: a heading over a list of rows and nested groups, the current
 * page marked with aria-current. Each passes its own stylesheet's classes and
 * its own row click, so this file owns the markup and neither owns the look.
 */
import Link from 'next/link';
import { type MouseEvent, type RefObject, useId } from 'react';

import type { ResolvedNavGroup } from '@/content/types';

type RowClickHandler = (event: MouseEvent<HTMLAnchorElement>) => void;

/** The classes a surface gives the tree. CSS module lookups, hence `| undefined`. */
export interface NavTreeClassNames {
  group: string | undefined;
  groupHeader: string | undefined;
  list: string | undefined;
  row: string | undefined;
}

interface NavGroupProps {
  classNames: NavTreeClassNames;
  /** Attached to the current page's row, for a surface that scrolls to it. */
  currentRowRef?: RefObject<HTMLAnchorElement | null>;
  group: ResolvedNavGroup;
  /** Which heading this group's label is: h2 at the top, h3 inside a group. */
  level: 2 | 3;
  /** Every row's click handler. */
  onRowClick: RowClickHandler;
  pathname: string;
  /** Passed to each row's Link. False keeps the window where it is on navigation. */
  scroll?: boolean;
}

// ----------------------------------------------------------------------------
// The tree
// ----------------------------------------------------------------------------

// The mock's "group" at either depth: a header over its rows, over its
// nested groups, or over both. A plain div rather than a section, because
// section is for content that belongs in the document's outline and this is
// a grouping of links inside a nav; seven of them would also become seven
// landmarks the day one gained a label. The heading stays, so heading
// navigation still steps through the nav, and its id labels the list below
// it: a screen reader then says "Gradients, list, 4 items" rather than
// reading an unlabelled list.
//
// One list holds everything the group contains, rows and nested groups
// alike, so a nested group is an item of its parent's list rather than a
// sibling of it and the Frameworks-over-React hierarchy reaches assistive
// technology as a hierarchy. A nested group's header is an h3. No tree nests
// deeper than this: the components tree is flat and the only nesting in
// nav.config.ts is Frameworks over React.
export function NavGroup({
  classNames,
  currentRowRef,
  group,
  level,
  onRowClick,
  pathname,
  scroll,
}: NavGroupProps) {
  const headingId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <div className={classNames.group}>
      <Heading className={classNames.groupHeader} id={headingId}>
        {group.label}
      </Heading>
      <ul aria-labelledby={headingId} className={classNames.list}>
        {group.items.map((item) =>
          'items' in item ? (
            <li key={item.label}>
              <NavGroup
                classNames={classNames}
                currentRowRef={currentRowRef}
                group={item}
                level={3}
                onRowClick={onRowClick}
                pathname={pathname}
                scroll={scroll}
              />
            </li>
          ) : (
            <li key={item.url}>
              <Link
                aria-current={item.url === pathname ? 'page' : undefined}
                className={classNames.row}
                href={item.url}
                onClick={onRowClick}
                ref={item.url === pathname ? currentRowRef : undefined}
                scroll={scroll}
              >
                {item.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
