import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

async function readFileUrl(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw caughtError;
  }
}

async function readHttpUrl(url: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch (caughtError) {
    throw new Error(
      `Failed to fetch ${url}: ${caughtError instanceof Error ? caughtError.message : String(caughtError)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
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
