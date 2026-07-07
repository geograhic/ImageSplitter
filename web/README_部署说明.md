# ImageSlicer Pro (Web) — 部署到 Vercel 指南

本目录是一个**纯前端（静态）**版本，由 Vite 构建，**无任何后端**，可直接部署到 Vercel 供浏览器访问。
桌面版（`../main.cjs` 等）保持原样不受影响。

---

## 一、一键本地预览（可选，先验证效果）

```bash
cd web
npm install
npm run dev        # 打开终端里给出的 http://localhost:5173
```

构建产物预览：

```bash
npm run build
npm run preview
```

---

## 二、推送到 GitHub

> 建议在操作前先 `git pull` 拉取最新，避免覆盖远程内容（你的常规习惯）。

```bash
# 在项目根目录
git add web
git commit -m "feat: 新增 ImageSlicer Pro 纯 Web 版本（Vite + Vercel）"
git push
```

推送后，`web/` 子项目会被一起推到 GitHub 仓库。

---

## 三、在 Vercel 上自动识别并部署

### 方式 A：导入 Git 仓库（推荐，后续 push 自动部署）

1. 登录 [vercel.com](https://vercel.com) → **Add New → Project** → 选择你的 GitHub 仓库。
2. 在 **Configure Project** 页面，将 **Root Directory（根目录）** 改为：
   ```
   web
   ```
   （这是关键：默认是仓库根，但我们的前端工程在 `web/` 子目录里。）
3. Framework Preset 一般会自动识别为 **Vite**；若没有自动识别，手动选择 Vite。
4. 构建命令 / 输出目录保持默认即可（`npm run build` → `dist`）。`vercel.json` 里也已显式声明。
5. 点击 **Deploy**。几分钟后得到 `https://你的项目.vercel.app`，浏览器直接打开即用。

之后只要 `git push` 到主分支，Vercel 会自动重新构建部署。

### 方式 B：Vercel CLI（适合已在本地装好 CLI）

```bash
cd web
npm i -g vercel
vercel            # 按提示登录并部署；首次会询问 root directory，选当前 web 目录
vercel --prod     # 推到生产环境
```

---

## 四、自定义域名（可选）

在 Vercel 项目 **Settings → Domains** 中添加你的域名，按提示配置 DNS（CNAME 到 `cname.vercel-dns.com`）即可。
因为 `vite.config.js` 用了 `base: './'`，部署到根域名或子路径都正常。

---

## 五、常见问题

| 现象 | 原因 / 解决 |
|------|-------------|
| 页面空白、控制台报 `switchTab is not defined` | 旧 `index.html` 用了经典脚本。请确认已使用 `web/index.html`（指向 `./src/main.js` 模块），`app.js` 末尾已把函数挂到 `window`。 |
| 构建报 `Cannot find module 'jszip'` | 在 `web/` 目录执行 `npm install` 安装依赖。 |
| 粘贴截图按钮无效 | `navigator.clipboard.read()` 需要 HTTPS。Vercel 默认 HTTPS 可用；本地 `http://localhost` 也可用；用 `http` 非本地域名时该功能受限，但拖拽/点击上传不受影响。 |
| 想改端口/基础路径 | 编辑 `web/vite.config.js`。 |

---

## 六、与桌面版的差异对照

| 能力 | 桌面版 (Electron) | Web 版 (Vercel) |
|------|-------------------|-----------------|
| 打开方式 | 双击 `.exe` | 浏览器访问 URL |
| 图片读取 | 用户选文件 / 拖拽 | 用户选文件 / 拖拽 / Ctrl+V（HTTPS） |
| 处理 | 浏览器内核（Chromium） | 浏览器内核（用户自己的浏览器） |
| 保存 | 浏览器下载 | 浏览器下载（ZIP 或单张） |
| 配置持久化 | localStorage | localStorage（按域名隔离） |
| 后端/服务器 | 无 | **无**（纯静态） |
| 代码上多余的 | `main.cjs` + electron-builder | 已移除 |
