import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

async function readFileUrl(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }
}

async function readHttpUrl(url: string): Promise<string> {
  let res: Response;

  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

export async function readUrl(url: string): Promise<string> {
  const parsed = new URL(url);

  if (parsed.protocol === 'file:') {
    return readFileUrl(fileURLToPath(parsed));
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return readHttpUrl(url);
  }

  throw new Error(
    `Unsupported protocol: ${parsed.protocol} (only file://, http://, https:// are supported)`,
  );
}
