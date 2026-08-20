// Poster pipeline stage 2: a throwaway localhost server with exactly three
// routes — the harness HTML, the bundled JS, and a config JSON carrying the
// render dimensions. Listening on port 0 lets the OS pick any free port;
// the server exists only for the seconds the screenshot takes.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface PosterBundle {
  html: string;
  js: string;
}

export interface PosterRenderConfig {
  width: number;
  height: number;
}

export interface PosterServer {
  url: string;
  close: () => Promise<void>;
}

export async function createPosterServer(opts: {
  bundle: PosterBundle;
  config: PosterRenderConfig;
}): Promise<PosterServer> {
  const server: Server = createServer((request, response) => {
    const url = request.url ?? '/';

    if (url === '/' || url === '/index.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(opts.bundle.html);

      return;
    }
    if (url === '/harness.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(opts.bundle.js);

      return;
    }
    if (url === '/config.json') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(opts.config));

      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const rawAddress = server.address();

  if (rawAddress === null || typeof rawAddress === 'string') {
    throw new Error('shaders poster: expected server to bind a TCP address');
  }
  const address: AddressInfo = rawAddress;
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((closeError) => (closeError ? reject(closeError) : resolve()));
      }),
  };
}
