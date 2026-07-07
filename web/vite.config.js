import { defineConfig } from 'vite';

// ImageSlicer Pro Web 版 Vite 配置
export default defineConfig({
  // 使用相对路径：资源相对于当前 URL 目录解析。
  // 这样直接访问 Vercel 根域名和通过 apps.endril.com/image-slicer/ 子路径访问都能正常加载样式与脚本。
  // 无斜杠的 /image-slicer 由 Cloudflare Worker 做 308 重定向到 /image-slicer/ 处理。
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 应用本身不大，但 JSZip 打包后可能触发体积警告，放宽阈值避免误报
    chunkSizeWarningLimit: 1500,
  },
});
