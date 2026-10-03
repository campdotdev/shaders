import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { getFavorites } from './homepage';

const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url));

// A favorite's card poster comes from scripts/build-posters.sh. A favorite
// whose file is missing would show a broken image on the homepage.
describe('getFavorites', () => {
  it('points every favorite at a card poster that exists', async () => {
    const favorites = await getFavorites();
    const missing = favorites
      .map((favorite) => favorite.poster)
      .filter((poster) => !existsSync(`${PUBLIC_DIR}${poster}`));

    expect(missing).toEqual([]);
  });
});
