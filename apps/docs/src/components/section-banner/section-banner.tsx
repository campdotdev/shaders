/**
 * The large section title under the site navigation, after the Figma mock:
 * a 144px band with the title at its bottom edge over the header shader, a
 * lime glow screened into LED dots (banner-shader.tsx). The components
 * layout renders it with "Components", so the index and every component
 * page share it.
 */
import { BannerShader } from './banner-shader';
import styles from './section-banner.module.css';

interface SectionBannerProps {
  /** The section name, rendered as the band's only text. */
  title: string;
}

export function SectionBanner({ title }: SectionBannerProps) {
  return (
    <div className={`site-gutter ${styles.banner}`} data-pagefind-ignore="all">
      <BannerShader />
      <div className={`site-container ${styles.inner}`}>
        <p className={styles.title}>{title}</p>
      </div>
    </div>
  );
}
