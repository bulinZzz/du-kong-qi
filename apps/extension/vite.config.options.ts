import { defineConfig } from 'vite';

/**
 * 授权页面按普通网页打包：它跑在扩展自己的页面里，可以是模块，不必像脚本那样做成 IIFE。
 * 本构建排在后台脚本之后，所以不清空输出目录（public/ 下的 options.html 由那一趟带过来）。
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: 'src/options/index.ts',
      formats: ['es'],
      fileName: () => 'options.js',
    },
  },
});
