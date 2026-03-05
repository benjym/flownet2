import { defineConfig } from 'vite';

function normalizeBasePath(raw: string): string {
  let value = raw.trim();
  if (value.length === 0) {
    return '/';
  }
  if (!value.startsWith('/')) {
    value = `/${value}`;
  }
  if (!value.endsWith('/')) {
    value = `${value}/`;
  }
  return value;
}

const base = normalizeBasePath(process.env.VITE_BASE_PATH ?? '/');

export default defineConfig({
  base,
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
  },
});
