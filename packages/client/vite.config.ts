import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Plugin: resolve .js extensions to .ts for NodeNext-module packages
function resolveTsExtensions(): Plugin {
  return {
    name: 'resolve-ts-extensions',
    resolveId(source, importer, options) {
      // Only handle imports from engine or shared packages
      if (
        source.endsWith('.js') &&
        (importer?.includes('/engine/') || importer?.includes('/shared/'))
      ) {
        const tsSource = source.replace(/\.js$/, '.ts');
        // Use Vite's own resolver to find the .ts file
        return this.resolve(tsSource, importer, { ...options, skipSelf: true });
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), resolveTsExtensions()],
  base: './',
  resolve: {
    alias: {
      '@rummikub/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@rummikub/engine': resolve(__dirname, '../engine/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // GitHub Pages 构建输出到项目根 docs/
    emptyOutDir: true,
  },
  // GitHub Pages 子路径时使用 './'，自定义域名时使用 '/'
  // base: './' 已在上方设置
});
