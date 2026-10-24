/**
 * The site's boxed text button as two components, so every caller gets the
 * same classes from text-button.module.css: TextButton for a <button>, such
 * as the control panel's Reset, and TextButtonLink for a Next <Link>, such as
 * the prev and next links and the homepage's Get started. A className passed
 * in joins the two shared classes.
 */
import Link from 'next/link';
import type { ComponentProps } from 'react';

import styles from './text-button.module.css';

const textButtonClassName = (className?: string) =>
  [styles.box, styles.button, className].filter(Boolean).join(' ');

export function TextButton({ className, ...props }: ComponentProps<'button'>) {
  return <button className={textButtonClassName(className)} type="button" {...props} />;
}

export function TextButtonLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={textButtonClassName(className)} {...props} />;
}
