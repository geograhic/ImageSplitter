import { defineConfig } from 'vite';

// ImageSlicer Pro Web 版 Vite 配置
export default defineConfig({
  // 使用相对路径，便于部署到任意子路径 / 自定义域名
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 应用本身不大，但 JSZip 打包后可能触发体积警告，放宽阈值避免误报
    chunkSizeWarningLimit: 1500,
  },
});
