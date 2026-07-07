import { defineConfig } from 'vite';

// ImageSlicer Pro Web 版 Vite 配置
export default defineConfig({
  // 绝对子路径：构建产物的资源引用自带 /image-slicer 前缀，
  // 这样无论用户访问 apps.endril.com/image-slicer 还是 /image-slicer/ 都能正确加载，
  // 不依赖末尾斜杠，也不依赖 Worker 重定向。改路径名时同步改这里即可。
  base: '/image-slicer/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 应用本身不大，但 JSZip 打包后可能触发体积警告，放宽阈值避免误报
    chunkSizeWarningLimit: 1500,
  },
});
