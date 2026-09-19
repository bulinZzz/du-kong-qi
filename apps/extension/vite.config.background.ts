import { defineConfig } from 'vite';

/**
 * 后端地址在构建期注入：开发期指向本机，发布时由 BACKEND_ORIGIN 给出（见 scripts/package.mjs）。
 * 用 define 而不是 import.meta.env：产物是 IIFE，没有模块环境可读。
 */
const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:8080';

/**
 * 后台 Service Worker 同样打包成 IIFE 单文件，避免在 manifest 里额外声明模块类型。
 * 本构建先执行：它清空输出目录，并把 public/ 下的 manifest.json 复制过去。
 */
export default defineConfig({
  publicDir: 'public',
  define: {
    __BACKEND_ORIGIN__: JSON.stringify(backendOrigin),
  },
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
