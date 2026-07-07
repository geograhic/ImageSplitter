# ImageSlicer Pro — 桌面端 → Web 端 代码迁移分析

> 结论先行：**原项目几乎已经是一个纯前端应用**，Electron 只是把 `index.html` 包进了一个浏览器窗口。
> 真正依赖 Electron / Node.js 的代码**只有 `main.cjs` 一个文件**，其余全部是浏览器 API。

---

## 1. 各文件依赖盘点

| 文件 | 是否依赖 Electron / Node | 说明 |
|------|--------------------------|------|
| `main.cjs` | ✅ **是（唯一）** | 使用 `require('electron')`、`require('path')`、`BrowserWindow`、`app` 启动桌面窗口。 |
| `app.js` | ❌ 否 | 仅用浏览器 API：`FileReader`、`Image`、`Canvas 2D`、`localStorage`、`Blob`、`URL.createObjectURL`、`navigator.clipboard`、`document`/`window`。**无任何 `require` / `fs` / `process` / `__dirname`**。 |
| `index.html` | ❌ 否 | 纯 HTML 标记。仅通过 `<script src="vendor/jszip.min.js">` 与 `<script src="app.js">` 引入两个脚本。 |
| `styles.css` | ❌ 否 | 纯 CSS。 |
| `package.json` | ✅ 是（配置层） | 声明了 `electron`、`electron-builder` 依赖，并引用 `main.cjs` 作为 `main` 入口。 |
| `vendor/jszip.min.js` | ❌ 否 | JSZip 库本身，浏览器可直接运行；只是以“全局 `<script>`”方式注入。 |

### 关键发现
- `app.js` 里唯一的“外部依赖”是 **JSZip**，原本通过 `vendor/jszip.min.js` 以全局变量形式提供。
- 代码中所有图片读取（`FileReader`）、像素处理（`Canvas`）、保存（`Blob` + `<a download>` / `URL.createObjectURL`）、配置持久化（`localStorage`）**都是浏览器标准能力**，在 Vercel 的静态托管环境下 100% 可用。
- 没有任何“读取本地磁盘路径”“写入文件到磁盘”等 `fs` 操作 —— 原本就是用户手动选文件 → 浏览器内存处理 → 浏览器下载，这条链路在 Web 上完全一致。

---

## 2. 为了上 Web 必须做的改造（清单）

| 改造项 | 原状 | Web 版做法 |
|--------|------|-----------|
| 删除 Electron 外壳 | `main.cjs` 用 `BrowserWindow` 打开页面 | 整个文件不再需要，Web 版不创建它。 |
| JSZip 引入方式 | `<script src="vendor/jszip.min.js">`（全局变量） | 改为 `import JSZip from 'jszip'`（npm 依赖，Vite 打包）。 |
| 入口脚本 | `<script src="app.js">`（经典脚本，全局作用域） | 改为 `<script type="module" src="./src/main.js">`（ES module，由 Vite 处理）。 |
| 内联事件处理器 | HTML 里的 `onclick="switchTab(...)"` 等直接调用全局函数 | ES module 作用域不是全局，因此在 `app.js` 末尾把 `switchTab / exportPresets / setTheme / ...` 等挂到 `window`（见 `app.js` 末尾“Web 版改造”注释）。 |
| 构建/部署配置 | `electron-builder` 打 `.exe` | 移除 `electron` / `electron-builder`，改用 `vite` + `vercel.json`。 |

### 不需要改的部分（直接复用）
`app.js` 的全部业务逻辑、`styles.css` 样式、`index.html` 的 DOM 结构 —— 原样搬入 `web/` 子项目即可，未触碰任何算法。

---

## 3. Web 上需要注意的几点（均为浏览器标准能力，Vercel 已满足）

1. **HTTPS / 安全上下文**：`navigator.clipboard.read()`（按钮“粘贴”）需要安全上下文。Vercel 默认提供 HTTPS，因此“Ctrl+V 粘贴截图”功能在线上可用；即使不可用，拖拽/点击上传依然正常。
2. **localStorage**：按源（origin）隔离，预设配置会保存在用户浏览器内，与桌面版行为一致。
3. **文件下载**：通过 `Blob` + `URL.createObjectURL` 触发 `<a download>`，浏览器原生支持。
4. **性能**：超大图（>100MB）完全在浏览器内存中处理，和桌面 Electron（同样基于 Chromium）上限一致，无新增限制。
5. **隐私**：图片全程不离开浏览器，不上传到任何服务器 —— 与桌面版一致，部署到 Vercel 后依然成立。

---

## 4. 改造后目录结构（`web/` 子项目）

```
web/
├── package.json        # vite + jszip，已移除 electron-builder
├── vite.config.js      # Vite 构建配置（base: './'）
├── vercel.json         # 告诉 Vercel 这是 Vite 项目
├── .gitignore
├── index.html          # 入口页（指向 ./src/main.js 模块）
├── src/
│   ├── main.js         # Vite 入口：import 样式 + app.js
│   ├── app.js          # 原 app.js（顶部 import JSZip；末尾挂 window 全局）
│   └── styles.css      # 原 styles.css
└── public/             # 如需放 favicon 等静态资源放这里
```

> 原项目根目录（`main.cjs` / `app.js` / `index.html` / `package.json` 等）**完全未改动**，桌面版仍可独立打包。
