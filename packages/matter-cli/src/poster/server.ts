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
  const server: Server = createServer((req, res) => {
    const url = req.url ?? '/';

    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(opts.bundle.html);

      return;
    }
    if (url === '/harness.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(opts.bundle.js);

      return;
    }
    if (url === '/config.json') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(opts.config));

      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const addrRaw = server.address();

  if (addrRaw === null || typeof addrRaw === 'string') {
    throw new Error('matter poster: expected server to bind a TCP address');
  }
  const addr: AddressInfo = addrRaw;
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
