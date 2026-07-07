// Vite 入口文件
// 1) 引入样式（Vite 会将其打包进产物）
// 2) 引入应用主逻辑（app.js 顶部已 import JSZip，底部会把内联事件需要的函数挂到 window）
import './styles.css';
import './app.js';
