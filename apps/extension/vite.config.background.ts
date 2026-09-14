import { defineConfig } from 'vite';

/**
 * 后台 Service Worker 同样打包成 IIFE 单文件，避免在 manifest 里额外声明模块类型。
 * 本构建先执行：它清空输出目录，并把 public/ 下的 manifest.json 复制过去。
 */
export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    lib: {
      entry: 'src/background/index.ts',
      name: 'DuKongQiBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
  },
});
