/**
 * The homepage's footer, after the Figma mock: the outlined "shaders"
 * wordmark centered at the foot of the page. On a phone the wordmark fills
 * the width, as the phone mock draws it. Only the homepage renders the
 * footer (app/page.tsx). The wordmark is drawn here in its final state. Its
 * scroll reveal comes in a later ticket.
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
