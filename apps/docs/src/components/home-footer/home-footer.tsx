/**
 * The homepage's footer, after the Figma mock: the outlined "shaders"
 * wordmark centered at the foot of the page, filling the width on a phone.
 * Only the homepage renders it (app/page.tsx). The wordmark is drawn in its
 * final state. Its scroll reveal comes in a later ticket.
 */
import styles from './home-footer.module.css';

export function HomeFooter() {
  return (
    <footer className={`site-gutter ${styles.footer}`}>
      <div className={`site-container ${styles.row}`}>
        {/* Hidden from screen readers: it is the site's name drawn as
            decoration, and the header's home link already names the site. */}
        <p aria-hidden="true" className={styles.wordmark}>
          shaders
        </p>
      </div>
    </footer>
  );
}
