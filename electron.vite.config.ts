import { defineConfig } from 'electron-vite';
import { resolve } from 'path';

const rootDir = __dirname;

export default defineConfig({
  main: {
    entry: resolve(rootDir, 'electron/main/index.ts'),
    build: {
      outDir: resolve(rootDir, 'dist-electron/main'),
      rollupOptions: {
        external: ['better-sqlite3']
      }
    },
    resolve: {
      alias: {
        '@domain': resolve(rootDir, 'packages/domain/src'),
        '@db': resolve(rootDir, 'packages/db/src')
      }
    }
  },
  preload: {
    entry: resolve(rootDir, 'electron/preload/index.ts'),
    build: {
      outDir: resolve(rootDir, 'dist-electron/preload')
    },
    resolve: {
      alias: {
        '@domain': resolve(rootDir, 'packages/domain/src')
      }
    }
  },
  renderer: {
    root: resolve(rootDir, 'renderer'),
    build: {
      outDir: resolve(rootDir, 'dist/renderer')
    },
    resolve: {
      alias: {
        '@domain': resolve(rootDir, 'packages/domain/src')
      }
    },
    server: {
      fs: {
        allow: [rootDir]
      }
    }
  }
});
