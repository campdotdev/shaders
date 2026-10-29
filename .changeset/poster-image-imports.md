---
'@camp-dev/shaders-cli': minor
---

`poster` can now render a scene that imports an image. Its bundler inlines each imported `.png`, `.jpg`, `.jpeg`, or `.webp` file as a data URL string, so the poster server needs no route for the file. Next.js turns the same import into an object with a `src` field, so a scene that also runs in Next.js has to accept both.
