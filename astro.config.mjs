// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com',
  // Its own port, so it never shares localhost:4321 (and that origin's cache
  // and storage) with other Astro projects running on the default.
  server: { port: 4380 },
  devToolbar: { enabled: false },
});
