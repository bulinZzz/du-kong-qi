import { defineConfig } from 'vite';

/**
 * 内容脚本打包成 IIFE 单文件：MV3 的内容脚本不是模块，产物里不能出现 import。
 * 本构建排在后台脚本之后，所以不清空输出目录。
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: 'src/content/index.ts',
      name: 'DuKongQiContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
