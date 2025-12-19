import { defineConfig } from 'electron-vite';
import { resolve } from 'path';

const rootDir = __dirname;

export default defineConfig({
  main: {
    build: {
      outDir: resolve(rootDir, 'dist-electron/main'),
      lib: {
        entry: resolve(rootDir, 'electron/main/index.ts')
      },
      rollupOptions: {
        external: ['better-sqlite3', 'exceljs']
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
    build: {
      outDir: resolve(rootDir, 'dist-electron/preload'),
      lib: {
        entry: resolve(rootDir, 'electron/preload/index.ts')
      }
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
      outDir: resolve(rootDir, 'dist/renderer'),
      rollupOptions: {
        input: resolve(rootDir, 'renderer/index.html')
      }
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
