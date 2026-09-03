/**
 * The large section title under the site navigation, after the Figma mock:
 * a 144px band with the title sitting at its bottom edge over a faint lime
 * glow. The components layout renders it with "Components" so the index and
 * every component page share it. The mock also draws a dot pattern over
 * the glow; that is meant to become a shader, so the band ships without it
 * and the glow layer is where the shader will mount.
 */
import styles from './section-banner.module.css';

interface SectionBannerProps {
  /** The section name, rendered as the band's only text. */
  title: string;
}

export function SectionBanner({ title }: SectionBannerProps) {
  return (
    <div className={styles.banner} data-pagefind-ignore="all">
      <p className={styles.title}>{title}</p>
    </div>
  );
}
