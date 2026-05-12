# M7 baseline — captured 2026-05-12

| Command | Wall time | Exit | Notes |
|---|---|---|---|
| pnpm install --frozen-lockfile | 0.7s | 0 | Lockfile up to date, nothing to install |
| pnpm typecheck | 7.0s | 0 | 4 cached; turbo warning: no outputs key for docs#typecheck (pre-existing) |
| pnpm lint | 2.6s | 0 | 2 cached; MODULE_TYPELESS_PACKAGE_JSON warnings (pre-existing, cosmetic) |
| pnpm build | 13.3s | 0 | 2 cached; full Next.js docs site SSG included |
| pnpm test | 3.8s | 0 | 2 cached; 22 test files, 80 tests (55 matter + 25 matter-react) all pass |
| pnpm smoke | 2.3s | 0 | add + update --force, byte-identical file check passed |

dist/ artifacts present:
- packages/matter/dist:
```
drwxr-xr-x@  9 hunter.garrett  staff     288 May 11 18:52 .
drwxr-xr-x@ 15 hunter.garrett  staff     480 May 12 17:03 ..
-rw-r--r--@  1 hunter.garrett  staff  190046 May  8 16:12 .tsbuildinfo
-rw-r--r--@  1 hunter.garrett  staff   15149 May 11 18:52 index.cjs
-rw-r--r--@  1 hunter.garrett  staff   41409 May 11 18:52 index.cjs.map
-rw-r--r--@  1 hunter.garrett  staff   14993 May 11 18:52 index.d.cts
-rw-r--r--@  1 hunter.garrett  staff   14993 May 11 18:52 index.d.ts
-rw-r--r--@  1 hunter.garrett  staff   13009 May 11 18:52 index.js
-rw-r--r--@  1 hunter.garrett  staff   39565 May 11 18:52 index.js.map
```
- packages/matter-react/dist:
```
drwxr-xr-x@  9 hunter.garrett  staff     288 May 12 17:03 .
drwxr-xr-x@ 15 hunter.garrett  staff     480 May 12 17:03 ..
-rw-r--r--@  1 hunter.garrett  staff  193585 May  8 16:09 .tsbuildinfo
-rw-r--r--@  1 hunter.garrett  staff   14423 May 12 17:03 index.cjs
-rw-r--r--@  1 hunter.garrett  staff   31665 May 12 17:03 index.cjs.map
-rw-r--r--@  1 hunter.garrett  staff    7199 May 12 17:03 index.d.cts
-rw-r--r--@  1 hunter.garrett  staff    7199 May 12 17:03 index.d.ts
-rw-r--r--@  1 hunter.garrett  staff   12612 May 12 17:03 index.js
-rw-r--r--@  1 hunter.garrett  staff   30808 May 12 17:03 index.js.map
```
- packages/matter-cli/dist:
```
drwxr-xr-x@ 20 hunter.garrett  staff    640 May 12 17:03 .
drwxr-xr-x@ 15 hunter.garrett  staff    480 May 12 17:03 ..
-rw-r--r--@  1 hunter.garrett  staff  60290 May 10 08:24 .tsbuildinfo
-rwxr-xr-x@  1 hunter.garrett  staff    189 May 12 17:03 add-WFXJ7HFS.js
-rw-r--r--@  1 hunter.garrett  staff     71 May 12 17:03 add-WFXJ7HFS.js.map
-rwxr-xr-x@  1 hunter.garrett  staff   2503 May 12 17:03 chunk-PWYRLP7T.js
-rw-r--r--@  1 hunter.garrett  staff   4817 May 12 17:03 chunk-PWYRLP7T.js.map
-rwxr-xr-x@  1 hunter.garrett  staff   2168 May 12 17:03 chunk-QTD5MDLV.js
-rw-r--r--@  1 hunter.garrett  staff   5572 May 12 17:03 chunk-QTD5MDLV.js.map
```
