/**
 * ImageSlicer Pro - 核心应用逻辑 v2.1
 * 纯原生JS，零依赖（除可选的JSZip），永不过时
 * Bug修复版：修复帮助/设置面板、等分数量、片段排序等问题
 */

'use strict';

// =============================================
// 全局状态管理
// =============================================
const State = {
  images: [],           // 已加载的图片列表 [{id, name, file, img, canvas, ...}]
  currentIdx: 0,        // 当前活跃图片索引
  mode: 'horizontal',   // 分割模式
  splitCount: 3,        // 等分数量
  fixedSize: 800,       // 固定尺寸(px)
  gridCols: 3,
  gridRows: 3,
  overlap: 0,           // 重叠像素
  outputFormat: 'png',
  outputQuality: 0.92,
  namingRule: '{name}_part_{index}',
  indexStart: 1,
  addWatermark: false,
  watermarkText: '© ImageSlicer Pro',
  watermarkPos: 'br',
  watermarkColor: '#ffffff',
  watermarkOpacity: 0.5,
  addBorder: false,
  borderSize: 0,
  borderColor: '#ffffff',
  zipDownload: true,
  guides: [],           // 自定义分割线 [{type:'h'|'v', pos:0-1}]
  selectedPiece: -1,
  excludedPieces: new Set(),
  zoom: 1.0,
  renderScale: 1.0,
  previewZoom: 1.0,
  pieceOrder: [],       // 片段自定义排序索引数组
  zoom: 1.0,
  canvasScale: 1.0,     // 适应屏幕的缩放比
  rotation: 0,          // 0/90/180/270
  flipH: false,
  flipV: false,
  cropActive: false,
  cropRect: null,
  undoStack: [],
  redoStack: [],
  presets: JSON.parse(localStorage.getItem('isp_presets') || '[]'),
  userConfig: JSON.parse(localStorage.getItem('isp_config') || '{}'),
  draggingGuide: null,
  isBatchMode: false,
  currentTab: 'workspace',
};

// 内置预设
const BUILT_IN_PRESETS = {
  weibo: { mode:'horizontal', splitCount:3, fixedSize:800, outputFormat:'jpeg', outputQuality:0.9, namingRule:'{name}_微博_{index}', hint:'微博长图3等分' },
  instagram: { mode:'grid', gridCols:3, gridRows:3, outputFormat:'jpeg', outputQuality:0.95, namingRule:'{name}_ig_{index}', hint:'Instagram 9宫格' },
  wechat: { mode:'fixed-height', fixedSize:800, outputFormat:'jpeg', outputQuality:0.92, namingRule:'{name}_wx_{index}', hint:'微信文章800px' },
  scroll: { mode:'fixed-height', fixedSize:1200, outputFormat:'jpeg', outputQuality:0.88, namingRule:'{name}_漫画_{index}', hint:'连载漫画1200px' },
};

// =============================================
// DOM 引用
// =============================================
const $ = (id) => document.getElementById(id);
const DOM = {
  uploadZone: null,
  fileInput: null,
  editorArea: null,
  mainCanvas: null,
  guidesLayer: null,
  canvasContainer: null,
  canvasWrap: null,
  previewList: null,
  previewViewer: null,
  previewViewport: null,
  previewCanvas: null,
  previewZoomLevel: null,
  imageTabs: null,
  imgInfo: null,
  splitInfo: null,
  splitCountDisplay: null,
  zoomLevel: null,
  statusMsg: null,
  progressBar: null,
  progressFill: null,
  helpDrawer: null,
  helpOverlay: null,
  helpTitle: null,
  helpBody: null,
  toastContainer: null,
  workspace: null,
  appBody: null,
};

function initDOM() {
  DOM.uploadZone = $('upload-zone');
  DOM.fileInput = $('file-input');
  DOM.editorArea = $('editor-area');
  DOM.mainCanvas = $('main-canvas');
  DOM.guidesLayer = $('guides-layer');
  DOM.canvasContainer = $('canvas-container');
  DOM.canvasWrap = $('canvas-wrap');
  DOM.previewList = $('preview-list');
  DOM.previewViewer = $('preview-viewer');
  DOM.previewViewport = $('preview-viewport');
  DOM.previewCanvas = $('preview-canvas');
  DOM.previewZoomLevel = $('preview-zoom-level');
  DOM.imageTabs = $('image-tabs');
  DOM.imgInfo = $('img-info');
  DOM.splitInfo = $('split-info');
  DOM.splitCountDisplay = $('split-count-display');
  DOM.zoomLevel = $('zoom-level');
  DOM.statusMsg = $('status-msg');
  DOM.progressBar = $('progress-bar');
  DOM.progressFill = $('progress-fill');
  DOM.helpDrawer = $('help-drawer');
  DOM.helpOverlay = $('help-overlay');
  DOM.helpTitle = $('help-title');
  DOM.helpBody = $('help-body');
  DOM.toastContainer = $('toast-container');
  DOM.workspace = $('workspace');
  DOM.appBody = document.querySelector('.app-body');
}

// =============================================
// 帮助文档内容
// =============================================
const HELP_CONTENT = {
  'split-modes': {
    title: '分割模式说明',
    html: `
<h4>🔲 水平分割</h4>
<p>沿水平方向（横向）切割图片，生成若干行。适合将长截图、长文章分割成等高的多张图片。</p>

<h4>📐 垂直分割</h4>
<p>沿垂直方向（纵向）切割图片，生成若干列。适合宽图横向拆分。</p>

<h4>🔢 网格分割</h4>
<p>同时按行列分割，将图片切成 M×N 的方块矩阵。常用于 Instagram 九宫格、拼图等场景。</p>

<h4>📏 固定高度分割</h4>
<p>按指定像素高度分割，每块高度相同。若图片高度不能整除，最后一块会较小（可通过"补白"选项填充至等高）。</p>

<h4>↔ 固定宽度分割</h4>
<p>按指定像素宽度分割，横向每块宽度相同。</p>

<h4>✏️ 自由分割</h4>
<p>进入自由模式后，在图片上<strong>单击</strong>可添加水平分割线；<strong>Shift+单击</strong>添加垂直分割线；<strong>单击已有分割线</strong>可删除它。支持同时添加水平和垂直分割线，实现不规则分割。</p>

<div class="tip-box">💡 提示：所有模式都支持设置"重叠像素"，让相邻分块略有重合，防止内容在边缘被截断。</div>`
  },
  'params': {
    title: '分割参数详解',
    html: `
<h4>等分数量</h4>
<p>在水平/垂直模式下，图片被平均分成指定数量的块。例如设为5则每块占图片的1/5。点击 + / - 按钮或直接输入数字即可调整。</p>

<h4>分块尺寸（固定模式）</h4>
<p>在固定高度/宽度模式下，每块的像素尺寸。计算公式：<br>
<code>块数 = ceil(图片高度 / 块高)</code></p>

<h4>网格行列数</h4>
<p>在网格模式下，分别设置水平方向的列数和垂直方向的行数。3列×3行即为9宫格。</p>

<h4>分割线重叠（像素）</h4>
<p>相邻分块在边界处的重叠量。如设为 20px，则相邻两块各延伸 20px 覆盖对方区域，避免内容刚好在边界处被截断。</p>

<table>
  <tr><th>重叠值</th><th>适用场景</th></tr>
  <tr><td>0px</td><td>精确分割，不需要衔接</td></tr>
  <tr><td>10-30px</td><td>文字内容，防止行截断</td></tr>
  <tr><td>50-100px</td><td>图表/漫画，防止元素截断</td></tr>
</table>`
  },
  'output': {
    title: '输出格式与质量',
    html: `
<h4>格式选择建议</h4>
<ul>
  <li><strong>PNG</strong>：无损压缩，支持透明通道。适合截图、文字图片、Logo等。文件较大。</li>
  <li><strong>JPEG</strong>：有损压缩，体积小。适合照片、渐变图片。不支持透明。</li>
  <li><strong>WebP</strong>：现代格式，在同等质量下比 JPEG 小30%。兼容大多数现代浏览器和平台。</li>
  <li><strong>保持原格式</strong>：输入什么格式，输出什么格式。</li>
</ul>

<h4>文件命名规则</h4>
<p>支持以下占位符：</p>
<table>
  <tr><th>占位符</th><th>替换为</th></tr>
  <tr><td><code>{name}</code></td><td>原文件名（不含扩展名）</td></tr>
  <tr><td><code>{index}</code></td><td>序号（从起始值开始）</td></tr>
  <tr><td><code>{row}</code></td><td>行号（网格模式）</td></tr>
  <tr><td><code>{col}</code></td><td>列号（网格模式）</td></tr>
  <tr><td><code>{date}</code></td><td>当前日期 YYYYMMDD</td></tr>
  <tr><td><code>{w}</code></td><td>该分块的宽度(px)</td></tr>
  <tr><td><code>{h}</code></td><td>该分块的高度(px)</td></tr>
</table>

<div class="tip-box">例如：<code>{name}_第{index}块_{date}</code> 会生成 <code>screenshot_第1块_20250519.png</code></div>`
  },
  'watermark': {
    title: '水印功能',
    html: `
<h4>水印说明</h4>
<p>开启水印后，每个分割块都会自动加上指定的文字水印。</p>

<h4>位置选项</h4>
<ul>
  <li>右下角（推荐，最不遮挡内容）</li>
  <li>左下角</li>
  <li>右上角</li>
  <li>左上角</li>
  <li>居中（会遮挡内容，慎用）</li>
</ul>

<h4>透明度</h4>
<p>建议设置在 20%-50% 之间，保证水印可见但不过于突兀。</p>

<div class="tip-box">💡 如需图片水印（如Logo），可先在外部合成后再导入本工具分割。</div>`
  },
  'presets': {
    title: '预设配置管理',
    html: `
<h4>什么是预设？</h4>
<p>预设保存了当前所有的分割参数配置，下次只需点击一下即可恢复所有设置，无需重新配置。</p>

<h4>内置预设</h4>
<ul>
  <li><strong>微博长图</strong>：3等分水平分割，JPEG格式</li>
  <li><strong>Instagram 9宫格</strong>：3×3网格，正方形分割</li>
  <li><strong>微信文章</strong>：800px固定高度，适合微信推文</li>
  <li><strong>连载漫画</strong>：1200px固定高度，适合漫画上传</li>
</ul>

<h4>自定义预设</h4>
<p>配置好参数后，点击「保存当前」按钮，输入预设名称即可保存。预设存储在浏览器本地，永久有效。</p>

<h4>导入/导出预设</h4>
<p>在「管理预设」中可以导出预设为 JSON 文件分享给他人，也可以导入他人分享的预设文件。</p>`
  },
  'piece-ops': {
    title: '片段操作说明',
    html: `
<h4>片段操作功能</h4>
<p>对分割后的每个片段，可以进行以下精细操作：</p>

<ul>
  <li><strong>下载此块</strong>：单独下载该片段，不影响其他片段</li>
  <li><strong>排除此块</strong>：将该片段标记为不导出（变灰），适合去掉不需要的空白片段。再次点击可恢复。</li>
  <li><strong>上移/下移</strong>：调整片段在导出顺序中的位置（在右侧预览列表中体现）</li>
  <li><strong>合并下一块</strong>：将当前片段与下一片段合并为一块（通过删除两者之间的分割线实现）</li>
  <li><strong>在此再分割</strong>：切换到自由模式，可对单个片段区域进一步细分</li>
</ul>

<div class="tip-box">💡 点击右侧预览列表中的片段缩略图即可选中（高亮显示），然后使用上方操作按钮。</div>`
  },
};

// =============================================
// 工具函数
// =============================================
function getCtx(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate() {
  const d = new Date();
  return d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
}

function applyNamingRule(rule, params) {
  return rule
    .replace(/{name}/g, params.name || 'image')
    .replace(/{index}/g, String(params.index).padStart(2, '0'))
    .replace(/{row}/g, String(params.row || 0).padStart(2, '0'))
    .replace(/{col}/g, String(params.col || 0).padStart(2, '0'))
    .replace(/{date}/g, formatDate())
    .replace(/{w}/g, params.w || 0)
    .replace(/{h}/g, params.h || 0);
}

function showToast(msg, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  DOM.toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function setStatus(msg) {
  if (DOM.statusMsg) DOM.statusMsg.textContent = msg;
}

function showProgress(pct) {
  DOM.progressBar.classList.remove('hidden');
  DOM.progressFill.style.width = pct + '%';
  if (pct >= 100) {
    setTimeout(() => {
      DOM.progressBar.classList.add('hidden');
      DOM.progressFill.style.width = '0%';
    }, 600);
  }
}

function saveHistory() {
  if (!State.images[State.currentIdx]) return;
  State.undoStack.push({
    guides: JSON.parse(JSON.stringify(State.guides)),
    mode: State.mode,
    splitCount: State.splitCount,
    fixedSize: State.fixedSize,
    gridCols: State.gridCols,
    gridRows: State.gridRows,
  });
  if (State.undoStack.length > 50) State.undoStack.shift();
  State.redoStack = [];
}

// =============================================
// 图片加载
// =============================================
function loadImages(files) {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/bmp', 'image/tiff', 'image/avif', 'image/svg+xml'];

  const filtered = Array.from(files).filter(f => {
    if (!f.type.startsWith('image/') && !validTypes.includes(f.type)) {
      showToast(`跳过不支持的文件：${f.name}`, 'warning');
      return false;
    }
    if (f.size > 100 * 1024 * 1024) {
      showToast(`文件过大（>100MB）：${f.name}`, 'error');
      return false;
    }
    return true;
  });

  if (filtered.length === 0) return;

  let loaded = 0;
  showProgress(5);
  setStatus(`正在加载 ${filtered.length} 张图片...`);

  filtered.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const entry = {
          id: Date.now() + Math.random(),
          name: file.name.replace(/\.[^.]+$/, ''),
          file: file,
          img: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
          fileSize: file.size,
          format: file.type,
        };
        State.images.push(entry);
        loaded++;
        showProgress(5 + (loaded / filtered.length) * 90);

        if (loaded === filtered.length) {
          showProgress(100);
          State.currentIdx = State.images.length - filtered.length;
          State.pieceOrder = [];
          // 切换回工作台
          if (State.currentTab !== 'workspace') {
            switchTab('workspace');
          } else {
            DOM.uploadZone.classList.add('hidden');
            DOM.editorArea.classList.remove('hidden');
            DOM.editorArea.classList.add('fade-in');
          }
          renderAll();
          setStatus(`已加载 ${State.images.length} 张图片`);
          showToast(`成功加载 ${filtered.length} 张图片`, 'success');
        }
      };
      img.onerror = () => {
        showToast(`无法解析图片：${file.name}`, 'error');
        loaded++;
        if (loaded === filtered.length && State.images.length > 0) {
          renderAll();
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// =============================================
// 渲染主画布
// =============================================
function renderAll() {
  renderTabs();
  renderCanvas();
  renderGuides();
  renderPreview();
  updateInfo();
}

function renderCanvas() {
  const entry = State.images[State.currentIdx];
  if (!entry) return;

  const canvas = DOM.mainCanvas;
  const container = DOM.canvasContainer;

  // 计算适合视口的缩放
  const maxW = container.clientWidth - 40;
  const maxH = container.clientHeight - 40;

  // 考虑旋转90/270度时宽高互换
  const isRotated90 = State.rotation === 90 || State.rotation === 270;
  const displayOrigW = isRotated90 ? entry.height : entry.width;
  const displayOrigH = isRotated90 ? entry.width : entry.height;

  const scaleX = maxW / displayOrigW;
  const scaleY = maxH / displayOrigH;
  State.canvasScale = Math.min(1, scaleX, scaleY);

  const displayW = Math.round(displayOrigW * State.canvasScale * State.zoom);
  const displayH = Math.round(displayOrigH * State.canvasScale * State.zoom);

  canvas.width = displayW;
  canvas.height = displayH;
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';

  const ctx = getCtx(canvas);
  ctx.clearRect(0, 0, displayW, displayH);

  ctx.save();
  ctx.translate(displayW / 2, displayH / 2);
  if (State.rotation) ctx.rotate(State.rotation * Math.PI / 180);
  if (State.flipH) ctx.scale(-1, 1);
  if (State.flipV) ctx.scale(1, -1);

  // 旋转后图片实际绘制尺寸要用原始宽高
  if (isRotated90) {
    ctx.drawImage(entry.img, -displayH / 2, -displayW / 2, displayH, displayW);
  } else {
    ctx.drawImage(entry.img, -displayW / 2, -displayH / 2, displayW, displayH);
  }
  ctx.restore();

  // 高亮分割区域
  drawSplitHighlight(ctx, displayW, displayH);
}

function drawSplitHighlight(ctx, w, h) {
  const lines = getSplitPositions(w, h);

  ctx.save();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 3]);

  lines.h.forEach(y => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  });

  lines.v.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  });

  ctx.restore();
}

// =============================================
// 计算分割位置
// =============================================
function getSplitPositions(dispW, dispH) {
  const entry = State.images[State.currentIdx];
  if (!entry) return { h: [], v: [] };

  const origW = entry.width;
  const origH = entry.height;
  const scl = State.canvasScale * State.zoom;

  let hLines = [], vLines = [];

  switch (State.mode) {
    case 'horizontal': {
      const n = Math.max(2, State.splitCount);
      for (let i = 1; i < n; i++) {
        hLines.push(Math.round((origH / n * i) * scl));
      }
      break;
    }
    case 'vertical': {
      const n = Math.max(2, State.splitCount);
      for (let i = 1; i < n; i++) {
        vLines.push(Math.round((origW / n * i) * scl));
      }
      break;
    }
    case 'grid': {
      const rows = State.gridRows, cols = State.gridCols;
      for (let i = 1; i < rows; i++) hLines.push(Math.round((origH / rows * i) * scl));
      for (let j = 1; j < cols; j++) vLines.push(Math.round((origW / cols * j) * scl));
      break;
    }
    case 'fixed-height': {
      let y = State.fixedSize;
      while (y < origH) {
        hLines.push(Math.round(y * scl));
        y += State.fixedSize;
      }
      break;
    }
    case 'fixed-width': {
      let x = State.fixedSize;
      while (x < origW) {
        vLines.push(Math.round(x * scl));
        x += State.fixedSize;
      }
      break;
    }
    case 'custom': {
      State.guides.forEach(g => {
        if (g.type === 'h') hLines.push(Math.round(g.pos * dispH));
        else vLines.push(Math.round(g.pos * dispW));
      });
      break;
    }
  }

  return { h: hLines, v: vLines };
}

// =============================================
// 渲染分割线（HTML覆盖层）
// =============================================
function renderGuides() {
  const layer = DOM.guidesLayer;
  layer.innerHTML = '';

  const canvas = DOM.mainCanvas;
  const w = canvas.width;
  const h = canvas.height;

  const lines = getSplitPositions(w, h);

  const createLine = (type, pos) => {
    const line = document.createElement('div');
    line.className = `guide-line ${type === 'h' ? 'horizontal' : 'vertical'}`;

    const label = document.createElement('div');
    label.className = 'guide-label';

    if (type === 'h') {
      line.style.top = pos + 'px';
      label.style.top = '2px';
      label.style.left = '4px';
      const origY = Math.round(pos / (State.canvasScale * State.zoom));
      label.textContent = `y: ${origY}px`;
    } else {
      line.style.left = pos + 'px';
      label.style.left = '2px';
      label.style.top = '4px';
      const origX = Math.round(pos / (State.canvasScale * State.zoom));
      label.textContent = `x: ${origX}px`;
    }

    line.appendChild(label);

    // 拖动分割线（仅自定义模式）
    if (State.mode === 'custom') {
      line.style.cursor = type === 'h' ? 'ns-resize' : 'ew-resize';
      const del = document.createElement('button');
      del.className = 'guide-delete';
      del.textContent = '×';
      del.title = '删除此分割线';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const ratio = type === 'h' ? pos / h : pos / w;
        const idx = State.guides.findIndex(g => g.type === type &&
          Math.abs(g.pos - ratio) < 0.02);
        if (idx >= 0) {
          saveHistory();
          State.guides.splice(idx, 1);
          renderGuides();
          renderPreview();
          updateInfo();
        }
      });
      line.appendChild(del);

      // 拖拽分割线
      let dragging = false;
      line.addEventListener('mousedown', (e) => {
        if (e.target === del) return;
        dragging = true;
        State.draggingGuide = { type, pos };
        e.preventDefault();
        e.stopPropagation();
      });

      document.addEventListener('mousemove', (ev) => {
        if (!dragging) return;
        const rect = DOM.mainCanvas.getBoundingClientRect();
        if (type === 'h') {
          const newY = Math.max(0, Math.min(h, ev.clientY - rect.top));
          const ratio = newY / h;
          const idx = State.guides.findIndex(g => g.type === type &&
            Math.abs(g.pos - State.draggingGuide.pos) < 0.02);
          if (idx >= 0) {
            State.guides[idx].pos = ratio;
            State.draggingGuide.pos = ratio;
            line.style.top = newY + 'px';
            label.textContent = `y: ${Math.round(newY / (State.canvasScale * State.zoom))}px`;
          }
        } else {
          const newX = Math.max(0, Math.min(w, ev.clientX - rect.left));
          const ratio = newX / w;
          const idx = State.guides.findIndex(g => g.type === type &&
            Math.abs(g.pos - State.draggingGuide.pos) < 0.02);
          if (idx >= 0) {
            State.guides[idx].pos = ratio;
            State.draggingGuide.pos = ratio;
            line.style.left = newX + 'px';
            label.textContent = `x: ${Math.round(newX / (State.canvasScale * State.zoom))}px`;
          }
        }
      });

      document.addEventListener('mouseup', () => {
        if (dragging) {
          dragging = false;
          State.draggingGuide = null;
          renderPreview();
          updateInfo();
        }
      });
    }

    layer.appendChild(line);
  };

  lines.h.forEach(y => createLine('h', y));
  lines.v.forEach(x => createLine('v', x));
}

// =============================================
// 生成分割片段（实际像素数据）
// =============================================
function generateSlices() {
  const entry = State.images[State.currentIdx];
  if (!entry) return [];

  const origW = entry.width;
  const origH = entry.height;
  const ovlp = State.overlap;

  let rects = []; // [{x, y, w, h, row, col}]

  switch (State.mode) {
    case 'horizontal': {
      const n = Math.max(2, State.splitCount);
      const slice = origH / n;
      for (let i = 0; i < n; i++) {
        const y = Math.round(i * slice);
        const endY = i === n - 1 ? origH : Math.round((i + 1) * slice);
        rects.push({
          x: 0,
          y: Math.max(0, y - (i > 0 ? ovlp : 0)),
          w: origW,
          h: (endY - y) + (i > 0 ? ovlp : 0) + (i < n - 1 ? ovlp : 0),
          row: i, col: 0
        });
      }
      break;
    }
    case 'vertical': {
      const n = Math.max(2, State.splitCount);
      const slice = origW / n;
      for (let i = 0; i < n; i++) {
        const x = Math.round(i * slice);
        const endX = i === n - 1 ? origW : Math.round((i + 1) * slice);
        rects.push({
          x: Math.max(0, x - (i > 0 ? ovlp : 0)),
          y: 0,
          w: (endX - x) + (i > 0 ? ovlp : 0) + (i < n - 1 ? ovlp : 0),
          h: origH,
          row: 0, col: i
        });
      }
      break;
    }
    case 'grid': {
      const rows = State.gridRows, cols = State.gridCols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = Math.round(origW / cols * c);
          const y = Math.round(origH / rows * r);
          const endX = c === cols - 1 ? origW : Math.round(origW / cols * (c + 1));
          const endY = r === rows - 1 ? origH : Math.round(origH / rows * (r + 1));
          rects.push({
            x: Math.max(0, x - (c > 0 ? ovlp : 0)),
            y: Math.max(0, y - (r > 0 ? ovlp : 0)),
            w: (endX - x) + (c > 0 ? ovlp : 0) + (c < cols - 1 ? ovlp : 0),
            h: (endY - y) + (r > 0 ? ovlp : 0) + (r < rows - 1 ? ovlp : 0),
            row: r, col: c
          });
        }
      }
      break;
    }
    case 'fixed-height': {
      let y = 0, idx = 0;
      const fs = Math.max(10, State.fixedSize);
      while (y < origH) {
        const endY = Math.min(y + fs, origH);
        rects.push({
          x: 0, y: Math.max(0, y - (idx > 0 ? ovlp : 0)),
          w: origW,
          h: (endY - y) + (idx > 0 ? ovlp : 0) + (endY < origH ? ovlp : 0),
          row: idx, col: 0
        });
        y = endY;
        idx++;
      }
      break;
    }
    case 'fixed-width': {
      let x = 0, idx = 0;
      const fs = Math.max(10, State.fixedSize);
      while (x < origW) {
        const endX = Math.min(x + fs, origW);
        rects.push({
          x: Math.max(0, x - (idx > 0 ? ovlp : 0)),
          y: 0,
          w: (endX - x) + (idx > 0 ? ovlp : 0) + (endX < origW ? ovlp : 0),
          h: origH,
          row: 0, col: idx
        });
        x = endX;
        idx++;
      }
      break;
    }
    case 'custom': {
      const hSorted = State.guides
        .filter(g => g.type === 'h')
        .map(g => Math.round(g.pos * origH))
        .sort((a, b) => a - b);
      const vSorted = State.guides
        .filter(g => g.type === 'v')
        .map(g => Math.round(g.pos * origW))
        .sort((a, b) => a - b);

      const hBounds = [0, ...hSorted, origH];
      const vBounds = [0, ...vSorted, origW];

      for (let r = 0; r < hBounds.length - 1; r++) {
        for (let c = 0; c < vBounds.length - 1; c++) {
          rects.push({
            x: Math.max(0, vBounds[c] - (c > 0 ? ovlp : 0)),
            y: Math.max(0, hBounds[r] - (r > 0 ? ovlp : 0)),
            w: (vBounds[c + 1] - vBounds[c]) + (c > 0 ? ovlp : 0) + (c < vBounds.length - 2 ? ovlp : 0),
            h: (hBounds[r + 1] - hBounds[r]) + (r > 0 ? ovlp : 0) + (r < hBounds.length - 2 ? ovlp : 0),
            row: r, col: c
          });
        }
      }
      break;
    }
  }

  // 修正超出边界
  rects = rects.map(r => ({
    ...r,
    x: Math.max(0, r.x),
    y: Math.max(0, r.y),
    w: Math.min(r.w, origW - Math.max(0, r.x)),
    h: Math.min(r.h, origH - Math.max(0, r.y)),
  }));

  // 过滤空白块
  rects = rects.filter(r => r.w > 0 && r.h > 0);

  return rects;
}

// =============================================
// 渲染分割预览
// =============================================
function renderPreview() {
  const entry = State.images[State.currentIdx];
  if (!entry) return;

  const list = DOM.previewList;
  list.innerHTML = '';

  const rects = generateSlices();
  if (rects.length === 0) {
    list.innerHTML = '<div class="preview-empty"><p>无可预览内容</p></div>';
    return;
  }

  // 初始化 pieceOrder（保持自定义排序）
  if (State.pieceOrder.length !== rects.length) {
    State.pieceOrder = rects.map((_, i) => i);
  }

  const border = State.addBorder ? State.borderSize : 0;
  const borderColor = State.borderColor;

  State.pieceOrder.forEach((origIdx, displayIdx) => {
    const rect = rects[origIdx];
    if (!rect) return;

    const isExcluded = State.excludedPieces.has(origIdx);

    // 生成缩略图
    const thumbSize = 200;
    const thumbCanvas = document.createElement('canvas');
    const scale = Math.min(thumbSize / rect.w, thumbSize / rect.h);
    thumbCanvas.width = Math.max(1, Math.round(rect.w * scale));
    thumbCanvas.height = Math.max(1, Math.round(rect.h * scale));
    const tCtx = getCtx(thumbCanvas);

    if (border > 0) {
      tCtx.fillStyle = borderColor;
      tCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
      const bScl = border * scale;
      tCtx.drawImage(entry.img,
        rect.x, rect.y, rect.w, rect.h,
        bScl, bScl,
        thumbCanvas.width - bScl * 2, thumbCanvas.height - bScl * 2
      );
    } else {
      tCtx.drawImage(entry.img, rect.x, rect.y, rect.w, rect.h,
        0, 0, thumbCanvas.width, thumbCanvas.height);
    }

    const item = document.createElement('div');
    item.className = 'preview-item' + (origIdx === State.selectedPiece ? ' selected' : '') + (isExcluded ? ' excluded' : '');
    item.dataset.origIdx = origIdx;

    const img = document.createElement('img');
    img.src = thumbCanvas.toDataURL('image/jpeg', 0.7);
    img.alt = `片段 ${displayIdx + 1}`;
    if (isExcluded) img.style.opacity = '0.3';

    const footer = document.createElement('div');
    footer.className = 'preview-item-footer';
    footer.innerHTML = `
      <span class="preview-item-num">#${displayIdx + 1 + (State.indexStart - 1)}${isExcluded ? ' <span style="color:var(--danger);font-size:9px">排除</span>' : ''}</span>
      <span class="preview-item-size">${rect.w}×${rect.h}</span>
    `;

    item.appendChild(img);
    item.appendChild(footer);

    item.addEventListener('click', () => {
      State.selectedPiece = origIdx;
      renderPreview();
      updatePieceOps();
    });

    list.appendChild(item);
  });

  // 更新统计
  updateStats(rects);
}

function updateStats(rects) {
  const total = rects.filter((_, i) => !State.excludedPieces.has(i)).length;
  $('stat-total').textContent = total + ' 块';

  const entry = State.images[State.currentIdx];
  if (entry) {
    const maxBlock = rects.reduce((max, r) => {
      const area = r.w * r.h;
      return area > (max.w * max.h) ? r : max;
    }, { w: 0, h: 0 });
    $('stat-maxsize').textContent = `${maxBlock.w}×${maxBlock.h}`;
    $('stat-origsize').textContent = `${entry.width}×${entry.height}`;
    $('stat-filesize').textContent = formatBytes(entry.fileSize);
  }
}

function updatePieceOps() {
  const selected = State.selectedPiece >= 0;
  const rects = generateSlices();
  const isFirst = State.selectedPiece === 0 || State.pieceOrder.indexOf(State.selectedPiece) === 0;
  const isLast = State.pieceOrder.indexOf(State.selectedPiece) === State.pieceOrder.length - 1;

  $('op-download-single').disabled = !selected;
  $('op-delete-piece').disabled = !selected;
  $('op-move-up').disabled = !selected || isFirst;
  $('op-move-down').disabled = !selected || isLast;
  $('op-merge-next').disabled = !selected || isLast;
  $('op-split-here').disabled = !selected;

  // 更新排除按钮文字
  if (selected) {
    const isExcluded = State.excludedPieces.has(State.selectedPiece);
    $('op-delete-piece').innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      ${isExcluded ? '恢复此块' : '排除此块'}
    `;
  }
}

// =============================================
// 渲染图片标签栏
// =============================================
function renderTabs() {
  DOM.imageTabs.innerHTML = '';
  State.images.forEach((entry, i) => {
    const tab = document.createElement('div');
    tab.className = 'img-tab' + (i === State.currentIdx ? ' active' : '');

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 28;
    thumbCanvas.height = 28;
    const tCtx = getCtx(thumbCanvas);
    tCtx.drawImage(entry.img, 0, 0, 28, 28);

    const img = document.createElement('img');
    img.src = thumbCanvas.toDataURL('image/jpeg', 0.5);

    const name = document.createElement('span');
    name.textContent = entry.name.length > 12 ? entry.name.slice(0, 12) + '…' : entry.name;

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = '关闭';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      removeImage(i);
    });

    tab.appendChild(img);
    tab.appendChild(name);
    tab.appendChild(close);

    tab.addEventListener('click', () => {
      State.currentIdx = i;
      State.guides = [];
      State.excludedPieces.clear();
      State.pieceOrder = [];
      State.selectedPiece = -1;
      renderAll();
    });

    DOM.imageTabs.appendChild(tab);
  });
}

function removeImage(idx) {
  State.images.splice(idx, 1);
  if (State.images.length === 0) {
    DOM.editorArea.classList.add('hidden');
    DOM.uploadZone.classList.remove('hidden');
    DOM.previewList.innerHTML = '<div class="preview-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>上传图片后显示预览</p></div>';
    return;
  }
  State.currentIdx = Math.min(idx, State.images.length - 1);
  State.pieceOrder = [];
  State.selectedPiece = -1;
  renderAll();
}

// =============================================
// 更新信息栏
// =============================================
function updateInfo() {
  const entry = State.images[State.currentIdx];
  if (!entry) return;

  const ext = entry.format.split('/')[1]?.toUpperCase() || 'IMG';
  DOM.imgInfo.textContent = `${entry.width} × ${entry.height} px · ${ext} · ${formatBytes(entry.fileSize)}`;

  const rects = generateSlices();
  const total = rects.filter((_, i) => !State.excludedPieces.has(i)).length;
  DOM.splitCountDisplay.textContent = total;

  // 更新固定尺寸信息
  if (State.mode === 'fixed-height' || State.mode === 'fixed-width') {
    const dim = State.mode === 'fixed-height' ? entry.height : entry.width;
    const blocks = Math.ceil(dim / Math.max(1, State.fixedSize));
    $('fixed-size-info').textContent = `预计分割为 ${blocks} 块`;
  }
}

// =============================================
// 核心导出功能
// =============================================
// 创建导出画布：自动按画布上限（约 8192px / 2400 万像素）缩放，避免超长/超大切片
// 超过 Chromium 画布尺寸限制导致 drawImage 静默失败、导出空白图。
function createExportCanvas(rect) {
  const border = State.addBorder ? State.borderSize : 0;
  const fullW = rect.w + border * 2;
  const fullH = rect.h + border * 2;
  const MAX_DIM = 8192;
  const MAX_PIXELS = 24000000;
  const scale = Math.min(1,
    MAX_DIM / fullW,
    MAX_DIM / fullH,
    Math.sqrt(MAX_PIXELS / Math.max(1, fullW * fullH))
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(fullW * scale));
  canvas.height = Math.max(1, Math.round(fullH * scale));
  const ctx = getCtx(canvas);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { canvas, ctx, border, fullW, fullH, scale };
}

async function exportAll() {
  const entry = State.images[State.currentIdx];
  if (!entry) { showToast('请先上传图片', 'warning'); return; }

  const allRects = generateSlices();
  // 按 pieceOrder 排序，并过滤排除项
  const orderedIndices = (State.pieceOrder.length === allRects.length ? State.pieceOrder : allRects.map((_, i) => i))
    .filter(i => !State.excludedPieces.has(i));
  const rects = orderedIndices.map(i => allRects[i]);

  if (rects.length === 0) { showToast('没有可导出的片段', 'warning'); return; }

  setStatus('正在生成分割片段...');
  showProgress(0);

  const format = State.outputFormat === 'original'
    ? (entry.format.includes('png') ? 'png' : entry.format.includes('webp') ? 'webp' : 'jpeg')
    : State.outputFormat;
  const mimeType = `image/${format}`;
  const quality = State.outputQuality;
  const ext = format === 'jpeg' ? 'jpg' : format;

  const files = [];

  let anyDownscaled = false;
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const { canvas: outCanvas, ctx, border, fullW, fullH, scale } = createExportCanvas(rect);
    if (scale < 1) anyDownscaled = true;

    // 填充边框背景
    if (border > 0) {
      ctx.fillStyle = State.borderColor;
      ctx.fillRect(0, 0, fullW, fullH);
    }

    // 绘制图像
    ctx.drawImage(entry.img, rect.x, rect.y, rect.w, rect.h,
      border, border, rect.w, rect.h);

    // 添加水印
    if (State.addWatermark && State.watermarkText) {
      drawWatermark(ctx, fullW, fullH);
    }

    // 文件名
    const fname = applyNamingRule(State.namingRule, {
      name: entry.name,
      index: i + State.indexStart,
      row: (rect.row || 0) + 1,
      col: (rect.col || 0) + 1,
      w: rect.w,
      h: rect.h,
    });

    const dataUrl = outCanvas.toDataURL(mimeType, quality);
    const base64 = dataUrl.split(',')[1];
    files.push({ name: fname + '.' + ext, data: base64 });

    showProgress(5 + (i / rects.length) * 85);
    // 让UI有时间更新
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  showProgress(90);

  if (State.zipDownload && typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    const folder = zip.folder(entry.name + '_slices');
    files.forEach(f => folder.file(f.name, f.data, { base64: true }));

    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(URL.createObjectURL(blob), `${entry.name}_slices.zip`);
    showToast(`已打包 ${files.length} 个文件并下载`, 'success');
  } else {
    // 逐个下载
    for (const f of files) {
      const url = `data:image/${ext};base64,${f.data}`;
      triggerDownload(url, f.name);
      await new Promise(r => setTimeout(r, 80));
    }
    showToast(`已下载 ${files.length} 个文件`, 'success');
  }

  showProgress(100);
  setStatus(`导出完成：${files.length} 个片段`);
  if (anyDownscaled) {
    showToast('部分超大切片已自动缩小分辨率以适配画布上限', 'warning', 4500);
  }
}

function drawWatermark(ctx, w, h) {
  const text = State.watermarkText;
  const opacity = State.watermarkOpacity;
  const color = State.watermarkColor;
  const pos = State.watermarkPos;

  const fontSize = Math.max(12, Math.min(w, h) * 0.04);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = 'bottom';

  const padding = fontSize * 0.8;
  const metrics = ctx.measureText(text);
  const tw = metrics.width;

  let x, y;
  switch (pos) {
    case 'br': x = w - tw - padding; y = h - padding; break;
    case 'bl': x = padding; y = h - padding; break;
    case 'tr': x = w - tw - padding; ctx.textBaseline = 'top'; y = padding; break;
    case 'tl': x = padding; ctx.textBaseline = 'top'; y = padding; break;
    case 'center': default:
      x = (w - tw) / 2;
      y = h / 2;
      ctx.textBaseline = 'middle';
      break;
  }

  // 文字阴影
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  ctx.fillText(text, x, y);
  ctx.restore();
}

async function exportSingle(pieceIndex) {
  const entry = State.images[State.currentIdx];
  if (!entry) return;

  const rects = generateSlices();
  const rect = rects[pieceIndex];
  if (!rect) return;

  const format = State.outputFormat === 'original' ? 'png' : State.outputFormat;
  const mimeType = `image/${format}`;
  const ext = format === 'jpeg' ? 'jpg' : format;

  const { canvas: outCanvas, ctx, border, fullW, fullH } = createExportCanvas(rect);

  if (border > 0) {
    ctx.fillStyle = State.borderColor;
    ctx.fillRect(0, 0, fullW, fullH);
  }

  ctx.drawImage(entry.img, rect.x, rect.y, rect.w, rect.h, border, border, rect.w, rect.h);

  if (State.addWatermark) drawWatermark(ctx, fullW, fullH);

  const fname = applyNamingRule(State.namingRule, {
    name: entry.name,
    index: pieceIndex + State.indexStart,
    row: (rect.row || 0) + 1,
    col: (rect.col || 0) + 1,
    w: rect.w, h: rect.h,
  });

  triggerDownload(outCanvas.toDataURL(mimeType, State.outputQuality), fname + '.' + ext);
  showToast(`已下载片段 #${pieceIndex + 1}`, 'success');
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// =============================================
// 参数面板显示/隐藏逻辑
// =============================================
function updateParamVisibility() {
  const mode = State.mode;
  $('param-equal-split').classList.toggle('hidden',
    !['horizontal', 'vertical'].includes(mode));
  $('param-fixed-size').classList.toggle('hidden',
    !['fixed-height', 'fixed-width'].includes(mode));
  $('param-grid').classList.toggle('hidden', mode !== 'grid');
}

// =============================================
// 帮助抽屉
// =============================================
function openHelp(key) {
  const content = HELP_CONTENT[key];
  if (!content) return;

  DOM.helpTitle.textContent = content.title;
  DOM.helpBody.innerHTML = content.html;
  DOM.helpDrawer.classList.remove('hidden');
  DOM.helpOverlay.classList.remove('hidden');
  setTimeout(() => DOM.helpDrawer.classList.add('open'), 10);
}

function closeHelp() {
  DOM.helpDrawer.classList.remove('open');
  setTimeout(() => {
    DOM.helpDrawer.classList.add('hidden');
    DOM.helpOverlay.classList.add('hidden');
  }, 300);
}

// =============================================
// 预设系统
// =============================================
function applyPreset(key) {
  const preset = BUILT_IN_PRESETS[key] ||
    State.presets.find(p => p.key === key);
  if (!preset) return;

  if (preset.mode) {
    State.mode = preset.mode;
    document.querySelectorAll('.mode-card').forEach(c => {
      c.classList.toggle('active', c.dataset.mode === preset.mode);
    });
    updateParamVisibility();
  }
  if (preset.splitCount !== undefined) {
    State.splitCount = preset.splitCount;
    $('split-count').value = preset.splitCount;
  }
  if (preset.fixedSize !== undefined) {
    State.fixedSize = preset.fixedSize;
    $('fixed-size').value = preset.fixedSize;
  }
  if (preset.gridCols !== undefined) {
    State.gridCols = preset.gridCols;
    $('grid-cols').value = preset.gridCols;
  }
  if (preset.gridRows !== undefined) {
    State.gridRows = preset.gridRows;
    $('grid-rows').value = preset.gridRows;
  }
  if (preset.outputFormat) {
    State.outputFormat = preset.outputFormat;
    $('output-format').value = preset.outputFormat;
  }
  if (preset.outputQuality !== undefined) {
    State.outputQuality = preset.outputQuality;
    $('output-quality').value = Math.round(preset.outputQuality * 100);
    $('quality-val').textContent = Math.round(preset.outputQuality * 100) + '%';
  }
  if (preset.namingRule) {
    State.namingRule = preset.namingRule;
    $('naming-rule').value = preset.namingRule;
  }

  State.pieceOrder = [];
  renderAll();
  showToast(`已应用预设：${preset.hint || key}`, 'success');
}

function getCurrentConfig() {
  return {
    mode: State.mode,
    splitCount: State.splitCount,
    fixedSize: State.fixedSize,
    gridCols: State.gridCols,
    gridRows: State.gridRows,
    overlap: State.overlap,
    outputFormat: State.outputFormat,
    outputQuality: State.outputQuality,
    namingRule: State.namingRule,
    indexStart: State.indexStart,
    addWatermark: State.addWatermark,
    watermarkText: State.watermarkText,
    watermarkPos: State.watermarkPos,
    watermarkOpacity: State.watermarkOpacity,
    addBorder: State.addBorder,
    borderSize: State.borderSize,
    borderColor: State.borderColor,
    zipDownload: State.zipDownload,
  };
}

function savePreset(name) {
  const config = getCurrentConfig();
  config.hint = name;
  config.key = 'custom_' + Date.now();
  State.presets.push(config);
  localStorage.setItem('isp_presets', JSON.stringify(State.presets));
  renderPresetList();
  showToast(`预设「${name}」已保存`, 'success');
}

function renderPresetList() {
  const list = $('preset-list');
  // 移除旧的自定义预设按钮
  list.querySelectorAll('[data-custom-preset]').forEach(el => el.remove());

  State.presets.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'preset-item';
    btn.dataset.customPreset = p.key;
    btn.textContent = p.hint || p.key;
    btn.addEventListener('click', () => applyPreset(p.key));
    list.appendChild(btn);
  });
}

// =============================================
// 自定义分割模式 - 画布点击添加分割线
// =============================================
function handleCanvasClick(e) {
  if (State.mode !== 'custom') return;
  if (State.draggingGuide) return;
  if (e.button !== 0) return;

  const rect = DOM.mainCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = DOM.mainCanvas.width;
  const h = DOM.mainCanvas.height;

  saveHistory();

  // 如果靠近现有分割线，删除它
  const snapDist = 8;
  let removed = false;

  State.guides = State.guides.filter(g => {
    const pos = g.type === 'h' ? g.pos * h : g.pos * w;
    const cur = g.type === 'h' ? y : x;
    if (Math.abs(pos - cur) < snapDist) {
      removed = true;
      return false;
    }
    return true;
  });

  if (!removed) {
    // Shift+点击添加垂直线，否则水平线
    const addVertical = e.shiftKey;
    if (addVertical) {
      State.guides.push({ type: 'v', pos: x / w });
    } else {
      State.guides.push({ type: 'h', pos: y / h });
    }
  }

  State.pieceOrder = [];
  renderGuides();
  renderPreview();
  updateInfo();
}

// =============================================
// 旋转/翻转
// =============================================
function rotateImage() {
  State.rotation = (State.rotation + 90) % 360;
  renderCanvas();
  renderGuides();
  renderPreview();
}

function flipHorizontal() {
  State.flipH = !State.flipH;
  renderCanvas();
  renderGuides();
  renderPreview();
}

function flipVertical() {
  State.flipV = !State.flipV;
  renderCanvas();
  renderGuides();
  renderPreview();
}

// =============================================
// 缩放控制
// =============================================
function setZoom(z) {
  State.zoom = Math.min(5, Math.max(0.1, z));
  DOM.zoomLevel.textContent = Math.round(State.zoom * 100) + '%';
  renderCanvas();
  renderGuides();
}

// =============================================
// 撤销/重做
// =============================================
function undo() {
  if (State.undoStack.length === 0) { showToast('没有可撤销的操作', 'info', 1500); return; }
  const snap = State.undoStack.pop();
  State.redoStack.push({
    guides: JSON.parse(JSON.stringify(State.guides)),
    mode: State.mode,
    splitCount: State.splitCount,
    fixedSize: State.fixedSize,
    gridCols: State.gridCols,
    gridRows: State.gridRows,
  });
  Object.assign(State, snap);
  syncUIFromState();
  State.pieceOrder = [];
  renderAll();
  showToast('已撤销', 'info', 1500);
}

function redo() {
  if (State.redoStack.length === 0) { showToast('没有可重做的操作', 'info', 1500); return; }
  const snap = State.redoStack.pop();
  State.undoStack.push({
    guides: JSON.parse(JSON.stringify(State.guides)),
    mode: State.mode,
    splitCount: State.splitCount,
    fixedSize: State.fixedSize,
    gridCols: State.gridCols,
    gridRows: State.gridRows,
  });
  Object.assign(State, snap);
  syncUIFromState();
  State.pieceOrder = [];
  renderAll();
  showToast('已重做', 'info', 1500);
}

function syncUIFromState() {
  document.querySelectorAll('.mode-card').forEach(c => {
    c.classList.toggle('active', c.dataset.mode === State.mode);
  });
  $('split-count').value = State.splitCount;
  $('fixed-size').value = State.fixedSize;
  $('grid-cols').value = State.gridCols;
  $('grid-rows').value = State.gridRows;
  updateParamVisibility();
}

// =============================================
// 标签页切换（帮助/设置/批量/工作台）
// 修复：正确在 workspace 区域展示内容
// =============================================
function switchTab(tab) {
  State.currentTab = tab;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  // 获取或创建动态内容容器（放在 workspace 上方，覆盖 workspace 内容）
  let overlay = $('tab-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tab-overlay';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: var(--bg-base);
      z-index: 10;
      overflow: auto;
      display: none;
    `;
    DOM.workspace.style.position = 'relative';
    DOM.workspace.appendChild(overlay);
  }

  if (tab === 'workspace') {
    overlay.style.display = 'none';
    overlay.innerHTML = '';
    // 根据是否有图片，显示上传区或编辑区
    if (State.images.length > 0) {
      DOM.uploadZone.classList.add('hidden');
      DOM.editorArea.classList.remove('hidden');
    } else {
      DOM.uploadZone.classList.remove('hidden');
      DOM.editorArea.classList.add('hidden');
    }
    return;
  }

  // 显示非工作台内容
  overlay.style.display = 'block';
  overlay.innerHTML = getTabContent(tab);

  // 批量处理：绑定文件上传
  if (tab === 'batch') {
    const batchUploadArea = $('batch-upload-area');
    if (batchUploadArea) {
      batchUploadArea.addEventListener('click', () => $('file-input').click());
      batchUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        batchUploadArea.style.background = 'var(--primary-dim)';
      });
      batchUploadArea.addEventListener('dragleave', () => {
        batchUploadArea.style.background = '';
      });
      batchUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        batchUploadArea.style.background = '';
        if (e.dataTransfer.files.length > 0) {
          loadImages(e.dataTransfer.files);
        }
      });
    }
    renderBatchGrid();
  }

  // 设置页：绑定主题按钮
  if (tab === 'settings') {
    // 按钮已通过 onclick 绑定
  }
}

function getTabContent(tab) {
  if (tab === 'batch') {
    return `<div style="padding:24px;max-width:800px;margin:0 auto">
    <h2 style="margin-bottom:8px;font-size:18px">批量处理</h2>
    <p style="color:var(--text-secondary);margin-bottom:20px;font-size:13px">上传多张图片，使用当前分割参数对所有图片进行批量分割，一键导出。</p>
    
    <div id="batch-upload-area" style="border:2px dashed var(--border);border-radius:12px;padding:40px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:20px">
      <div style="font-size:32px;margin-bottom:10px">📁</div>
      <p style="color:var(--text-secondary);margin-bottom:16px;font-size:13px">点击或拖入多张图片（已加载图片也会参与批量处理）</p>
      <button class="btn-primary" onclick="$('file-input').click()">选择图片</button>
    </div>

    <div id="batch-status" style="margin-bottom:16px;padding:12px;background:var(--bg-elevated);border-radius:8px;font-size:13px;color:var(--text-secondary)">
      当前已加载 <strong style="color:var(--text-primary)">${State.images.length}</strong> 张图片
      · 使用<strong style="color:var(--primary-light)"> ${getModeLabel(State.mode)} </strong>模式
      · 预计每张分割为 <strong style="color:var(--text-primary)">${getExpectedCount()}</strong> 块
    </div>

    <div id="batch-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:20px"></div>

    <div style="display:flex;gap:10px;align-items:center">
      <button class="btn-primary btn-lg" onclick="batchExportAll()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        批量导出全部
      </button>
      <button class="btn-secondary" onclick="switchTab('workspace')">← 返回工作台</button>
      ${State.images.length > 0 ? `<span style="color:var(--text-muted);font-size:12px">共 ${State.images.length} 张图片</span>` : ''}
    </div>
  </div>`;
  }

  if (tab === 'settings') {
    const currentTheme = localStorage.getItem('isp_theme') || 'dark';
    return `<div style="padding:24px;max-width:660px;margin:0 auto">
    <h2 style="margin-bottom:8px;font-size:18px">个性化设置</h2>
    <p style="color:var(--text-secondary);margin-bottom:24px;font-size:13px">自定义软件外观、快捷键和数据管理</p>
    
    <div class="panel-section" style="border-radius:12px;margin-bottom:12px;border:1px solid var(--border)">
      <div class="panel-title">🎨 外观主题</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-secondary ${currentTheme === 'dark' ? 'active-theme' : ''}" onclick="setTheme('dark');this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('active-theme'));this.classList.add('active-theme')">🌑 暗色（默认）</button>
        <button class="btn-secondary ${currentTheme === 'light' ? 'active-theme' : ''}" onclick="setTheme('light');this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('active-theme'));this.classList.add('active-theme')">☀️ 浅色</button>
        <button class="btn-secondary ${currentTheme === 'auto' ? 'active-theme' : ''}" onclick="setTheme('auto');this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('active-theme'));this.classList.add('active-theme')">🖥 跟随系统</button>
      </div>
    </div>

    <div class="panel-section" style="border-radius:12px;margin-bottom:12px;border:1px solid var(--border)">
      <div class="panel-title">⌨️ 快捷键参考</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>Ctrl+O</code></td><td style="padding:7px 10px;border:1px solid var(--border)">打开图片</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>Ctrl+Z</code></td><td style="padding:7px 10px;border:1px solid var(--border)">撤销</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>Ctrl+Y / Ctrl+Shift+Z</code></td><td style="padding:7px 10px;border:1px solid var(--border)">重做</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>Ctrl+Enter</code></td><td style="padding:7px 10px;border:1px solid var(--border)">导出全部</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>Ctrl+V</code></td><td style="padding:7px 10px;border:1px solid var(--border)">粘贴截图</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>+/-</code></td><td style="padding:7px 10px;border:1px solid var(--border)">缩放画布</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>R</code></td><td style="padding:7px 10px;border:1px solid var(--border)">旋转图片90°</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>Del</code></td><td style="padding:7px 10px;border:1px solid var(--border)">排除选中片段</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>Shift+点击画布</code></td><td style="padding:7px 10px;border:1px solid var(--border)">添加垂直分割线（自定义模式）</td></tr>
        <tr><td style="padding:7px 10px;border:1px solid var(--border)"><code>Esc</code></td><td style="padding:7px 10px;border:1px solid var(--border)">关闭帮助/对话框</td></tr>
      </table>
    </div>

    <div class="panel-section" style="border-radius:12px;margin-bottom:12px;border:1px solid var(--border)">
      <div class="panel-title">🎛 显示设置</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:var(--text-secondary)">
          <input type="checkbox" id="setting-show-guides" ${localStorage.getItem('isp_show_guides') !== 'false' ? 'checked' : ''} onchange="localStorage.setItem('isp_show_guides',this.checked);toggleGuidesVisibility(this.checked)">
          <span>显示分割线标注（y/x坐标）</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:var(--text-secondary)">
          <input type="checkbox" id="setting-auto-preview" ${localStorage.getItem('isp_auto_preview') !== 'false' ? 'checked' : ''} onchange="localStorage.setItem('isp_auto_preview',this.checked)">
          <span>参数变化时自动更新右侧预览</span>
        </label>
      </div>
    </div>

    <div class="panel-section" style="border-radius:12px;margin-bottom:12px;border:1px solid var(--border)">
      <div class="panel-title">💾 数据管理</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary" onclick="exportPresets()">📤 导出预设</button>
        <button class="btn-secondary" onclick="importPresets()">📥 导入预设</button>
        <button class="btn-danger" onclick="clearAllData()">🗑 清除所有数据</button>
      </div>
      <p style="margin-top:10px;font-size:11px;color:var(--text-muted)">预设数据保存在浏览器 LocalStorage 中，清除浏览器缓存会丢失数据，建议定期导出备份。</p>
    </div>

    <div style="margin-top:16px">
      <button class="btn-secondary" onclick="switchTab('workspace')">← 返回工作台</button>
    </div>
  </div>`;
  }

  if (tab === 'help') {
    return `<div style="padding:24px;max-width:760px;margin:0 auto">
    <h2 style="margin-bottom:8px;font-size:18px">帮助文档</h2>
    <p style="color:var(--text-secondary);margin-bottom:24px;font-size:13px">ImageSlicer Pro v2.1 · 纯Web技术，无需安装，永久免费，本地处理不上传</p>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
      <div style="padding:16px;background:var(--bg-elevated);border-radius:10px;border:1px solid var(--border)">
        <div style="font-size:24px;margin-bottom:8px">🚀</div>
        <h3 style="font-size:14px;margin-bottom:8px;color:var(--primary-light)">快速开始</h3>
        <ol style="color:var(--text-secondary);line-height:2.2;padding-left:18px;font-size:12px;margin:0">
          <li>上传图片（拖拽/点击/Ctrl+V粘贴）</li>
          <li>左侧选择分割模式</li>
          <li>调整分割参数</li>
          <li>右侧实时预览分割结果</li>
          <li>点击「导出全部」下载</li>
        </ol>
      </div>
      <div style="padding:16px;background:var(--bg-elevated);border-radius:10px;border:1px solid var(--border)">
        <div style="font-size:24px;margin-bottom:8px">✂️</div>
        <h3 style="font-size:14px;margin-bottom:8px;color:var(--primary-light)">6种分割模式</h3>
        <ul style="color:var(--text-secondary);line-height:2.2;padding-left:18px;font-size:12px;margin:0">
          <li><strong>水平分割</strong>：按行等分</li>
          <li><strong>垂直分割</strong>：按列等分</li>
          <li><strong>网格分割</strong>：M×N矩阵</li>
          <li><strong>固定高度</strong>：指定像素高</li>
          <li><strong>固定宽度</strong>：指定像素宽</li>
          <li><strong>自由分割</strong>：手动拖拽</li>
        </ul>
      </div>
    </div>

    <div style="padding:16px;background:var(--bg-elevated);border-radius:10px;border:1px solid var(--border);margin-bottom:12px">
      <h3 style="font-size:14px;margin-bottom:12px;color:var(--primary-light)">💡 高级功能</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--text-secondary)">
        <div>✅ <strong>智能重叠</strong>：防止内容边界截断</div>
        <div>✅ <strong>水印功能</strong>：自动为每块添加水印</div>
        <div>✅ <strong>预设系统</strong>：一键保存/恢复配置</div>
        <div>✅ <strong>ZIP打包</strong>：一键打包所有片段</div>
        <div>✅ <strong>批量处理</strong>：多张图片同参数导出</div>
        <div>✅ <strong>片段操作</strong>：排除/上移/下移/合并</div>
        <div>✅ <strong>撤销/重做</strong>：50步历史记录</div>
        <div>✅ <strong>PNG/JPEG/WebP</strong>：多格式输出</div>
      </div>
    </div>

    <div style="padding:16px;background:var(--bg-elevated);border-radius:10px;border:1px solid var(--border);margin-bottom:12px">
      <h3 style="font-size:14px;margin-bottom:8px;color:var(--primary-light)">🔧 自由分割操作说明</h3>
      <ul style="color:var(--text-secondary);line-height:2.2;padding-left:18px;font-size:12px;margin:0">
        <li><strong>单击画布</strong>：添加水平分割线</li>
        <li><strong>Shift+单击</strong>：添加垂直分割线</li>
        <li><strong>单击已有分割线</strong>：删除该分割线（需靠近8px内）</li>
        <li><strong>拖拽分割线</strong>：调整位置</li>
        <li><strong>点击 × 按钮</strong>：精确删除某条分割线</li>
      </ul>
    </div>

    <div style="padding:16px;background:var(--bg-elevated);border-radius:10px;border:1px solid var(--border);margin-bottom:16px">
      <h3 style="font-size:14px;margin-bottom:8px;color:var(--primary-light)">⚙️ 技术说明</h3>
      <ul style="color:var(--text-secondary);line-height:2.2;padding-left:18px;font-size:12px;margin:0">
        <li>使用 <strong>Canvas 2D API</strong> 进行像素级处理，支持超大分辨率图片</li>
        <li>可选 <strong>JSZip</strong> 打包下载，无网络时自动回退到逐个下载</li>
        <li>预设配置持久化存储在浏览器 <strong>LocalStorage</strong></li>
        <li>所有处理均在本地完成，<strong>图片数据不会上传到任何服务器</strong></li>
        <li>无框架、无后端依赖，可离线使用，永不过时</li>
      </ul>
    </div>

    <button class="btn-secondary" onclick="switchTab('workspace')">← 返回工作台</button>
  </div>`;
  }

  return '';
}

function getModeLabel(mode) {
  const labels = {
    'horizontal': '水平分割',
    'vertical': '垂直分割',
    'grid': '网格分割',
    'fixed-height': '固定高度',
    'fixed-width': '固定宽度',
    'custom': '自由分割',
  };
  return labels[mode] || mode;
}

function getExpectedCount() {
  const entry = State.images[0];
  if (!entry) return '?';
  const rects = generateSlices();
  return rects.length;
}

function renderBatchGrid() {
  const grid = $('batch-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (State.images.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:12px;grid-column:1/-1">暂无图片，请上传</p>';
    return;
  }
  State.images.forEach((entry, i) => {
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-elevated);border-radius:8px;overflow:hidden;border:1px solid var(--border)';

    const thumb = document.createElement('canvas');
    thumb.width = 100;
    thumb.height = 80;
    const ctx = getCtx(thumb);
    const scale = Math.min(100 / entry.width, 80 / entry.height);
    const dw = entry.width * scale;
    const dh = entry.height * scale;
    ctx.drawImage(entry.img, (100 - dw) / 2, (80 - dh) / 2, dw, dh);

    const img = document.createElement('img');
    img.src = thumb.toDataURL('image/jpeg', 0.6);
    img.style.cssText = 'width:100%;height:80px;object-fit:cover;display:block';

    const info = document.createElement('div');
    info.style.cssText = 'padding:5px 6px;font-size:10px;color:var(--text-muted)';
    const name = entry.name.length > 10 ? entry.name.slice(0, 10) + '…' : entry.name;
    info.textContent = name;

    card.appendChild(img);
    card.appendChild(info);
    grid.appendChild(card);
  });
}

function toggleGuidesVisibility(show) {
  const labels = document.querySelectorAll('.guide-label');
  labels.forEach(l => l.style.display = show ? '' : 'none');
}

// =============================================
// 主题切换
// =============================================
function setTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') {
    const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = preferDark ? 'dark' : 'light';
  } else {
    root.dataset.theme = theme;
  }
  localStorage.setItem('isp_theme', theme);
  const btn = $('theme-toggle');
  if (btn) btn.textContent = (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) ? '🌙' : '☀️';
  showToast(`已切换为${theme === 'dark' ? '暗色' : theme === 'light' ? '浅色' : '跟随系统'}主题`, 'success', 2000);
}

// =============================================
// 预设导入/导出
// =============================================
function exportPresets() {
  const data = JSON.stringify(State.presets, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  triggerDownload(URL.createObjectURL(blob), 'isp_presets.json');
  showToast('预设已导出', 'success');
}

function importPresets() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const presets = JSON.parse(ev.target.result);
        if (Array.isArray(presets)) {
          State.presets.push(...presets);
          localStorage.setItem('isp_presets', JSON.stringify(State.presets));
          renderPresetList();
          showToast(`已导入 ${presets.length} 个预设`, 'success');
        }
      } catch {
        showToast('预设文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function clearAllData() {
  if (confirm('确定要清除所有预设和配置数据吗？此操作不可撤销。')) {
    localStorage.removeItem('isp_presets');
    localStorage.removeItem('isp_config');
    localStorage.removeItem('isp_theme');
    State.presets = [];
    renderPresetList();
    showToast('所有数据已清除', 'warning');
  }
}

// =============================================
// 批量处理
// =============================================
async function batchExportAll() {
  if (State.images.length === 0) { showToast('请先上传图片', 'warning'); return; }

  showToast(`开始批量处理 ${State.images.length} 张图片...`, 'info', 2000);
  const origIdx = State.currentIdx;

  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();

    for (let imgIdx = 0; imgIdx < State.images.length; imgIdx++) {
      State.currentIdx = imgIdx;
      const entry = State.images[imgIdx];
      const rects = generateSlices();
      const folder = zip.folder(entry.name);
      const format = State.outputFormat === 'original' ? 'jpeg' : State.outputFormat;
      const mimeType = `image/${format}`;
      const ext = format === 'jpeg' ? 'jpg' : format;

      rects.forEach((rect, i) => {
        if (State.excludedPieces.has(i)) return;
        const c = document.createElement('canvas');
        const border = State.addBorder ? State.borderSize : 0;
        c.width = rect.w + border * 2;
        c.height = rect.h + border * 2;
        const ctx = getCtx(c);
        if (border > 0) {
          ctx.fillStyle = State.borderColor;
          ctx.fillRect(0, 0, c.width, c.height);
        }
        ctx.drawImage(entry.img, rect.x, rect.y, rect.w, rect.h, border, border, rect.w, rect.h);
        if (State.addWatermark) drawWatermark(ctx, c.width, c.height);

        const fname = applyNamingRule(State.namingRule, {
          name: entry.name, index: i + State.indexStart,
          row: (rect.row || 0) + 1, col: (rect.col || 0) + 1,
          w: rect.w, h: rect.h
        }) + '.' + ext;

        const base64 = c.toDataURL(mimeType, State.outputQuality).split(',')[1];
        folder.file(fname, base64, { base64: true });
      });
      showProgress(((imgIdx + 1) / State.images.length) * 90);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(URL.createObjectURL(blob), `batch_slices_${formatDate()}.zip`);
    showToast(`批量导出完成！共处理 ${State.images.length} 张图片`, 'success');
  } else {
    showToast('批量模式需要 JSZip，请检查网络或使用单图导出', 'warning');
  }

  State.currentIdx = origIdx;
  showProgress(100);
}

// =============================================
// 键盘快捷键
// =============================================
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;

  if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
  if (ctrl && e.key === 'o') { e.preventDefault(); $('file-input').click(); }
  if (ctrl && e.key === 'Enter') { e.preventDefault(); exportAll(); }

  if (!ctrl && !e.shiftKey) {
    if (e.key === 'r' || e.key === 'R') {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        rotateImage();
      }
    }
    if (e.key === '=' || e.key === '+') setZoom(State.zoom * 1.2);
    if (e.key === '-') setZoom(State.zoom / 1.2);
    if (e.key === '0') { State.zoom = 1; setZoom(1); }
    if (e.key === 'Escape') {
      closeHelp();
      $('preset-modal-overlay').classList.add('hidden');
      $('save-preset-overlay').classList.add('hidden');
    }
    if (e.key === 'Delete' && State.selectedPiece >= 0) {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        // 切换排除状态
        if (State.excludedPieces.has(State.selectedPiece)) {
          State.excludedPieces.delete(State.selectedPiece);
        } else {
          State.excludedPieces.add(State.selectedPiece);
        }
        renderPreview();
        updatePieceOps();
      }
    }
  }
});

// =============================================
// 粘贴截图
// =============================================
document.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        loadImages([file]);
        showToast('已从剪贴板粘贴图片', 'success');
      }
    }
  }
});

// =============================================
// 滚轮缩放（画布区域直接滚轮即可缩放，无需按住 Ctrl）
// =============================================
document.addEventListener('wheel', (e) => {
  const inCanvas = DOM.canvasWrap && DOM.canvasWrap.contains(e.target)
                || DOM.canvasContainer && DOM.canvasContainer.contains(e.target);
  if (!inCanvas) return;
  // 预览窗口仍用 Ctrl/Cmd+滚轮，避免冲突
  if (DOM.previewViewport && DOM.previewViewport.contains(e.target) && !e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  setZoom(State.zoom * delta);
}, { passive: false });

// =============================================
// 事件绑定
// =============================================
function bindEvents() {

  // 导航标签切换
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(el.dataset.tab);
    });
  });

  // 文件上传
  $('btn-select-file').addEventListener('click', () => $('file-input').click());
  $('btn-paste').addEventListener('click', async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            loadImages([new File([blob], 'paste.' + type.split('/')[1], { type })]);
            return;
          }
        }
      }
      showToast('剪贴板中没有图片，请先复制图片', 'warning');
    } catch {
      showToast('请使用 Ctrl+V 直接粘贴截图', 'info');
    }
  });

  $('file-input').addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadImages(e.target.files);
    e.target.value = '';
  });

  // 拖拽上传（工作区和上传区）
  const dropTargets = [DOM.uploadZone, DOM.workspace].filter(Boolean);
  dropTargets.forEach(el => {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      DOM.uploadZone.classList.add('drag-over');
    });
    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        DOM.uploadZone.classList.remove('drag-over');
      }
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      DOM.uploadZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) loadImages(e.dataTransfer.files);
    });
  });

  // 模式切换
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      saveHistory();
      State.mode = card.dataset.mode;
      State.guides = [];
      State.pieceOrder = [];
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      updateParamVisibility();
      renderAll();

      if (State.mode === 'custom') {
        showToast('自由分割：单击添加水平线 · Shift+单击添加垂直线 · 单击已有线可删除', 'info', 5000);
      }
    });
  });

  // 数字按钮 +/- (修复：直接更新State并调用renderAll，不依赖dispatchEvent)
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = $(targetId);
      if (!input) return;
      const step = parseFloat(input.step) || 1;
      const min = parseFloat(input.min) || 0;
      const max = parseFloat(input.max) || 99999;
      let val = parseFloat(input.value) || 0;
      if (btn.dataset.action === 'inc') val = Math.min(max, val + step);
      else val = Math.max(min, val - step);
      val = Math.round(val * 1000) / 1000; // 避免浮点数问题
      input.value = val;

      // 直接更新 State，不再依赖 dispatchEvent
      if (targetId === 'split-count') {
        State.splitCount = parseInt(val) || 2;
        State.pieceOrder = [];
        renderAll();
      } else if (targetId === 'fixed-size') {
        State.fixedSize = parseInt(val) || 100;
        State.pieceOrder = [];
        renderAll();
      } else if (targetId === 'grid-cols') {
        State.gridCols = parseInt(val) || 1;
        State.pieceOrder = [];
        renderAll();
      } else if (targetId === 'grid-rows') {
        State.gridRows = parseInt(val) || 1;
        State.pieceOrder = [];
        renderAll();
      } else if (targetId === 'index-start') {
        State.indexStart = parseInt(val) || 1;
        renderPreview();
      }
    });
  });

  // 等分数量（直接输入）
  $('split-count').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (val >= 2 && val <= 100) {
      State.splitCount = val;
      State.pieceOrder = [];
      renderAll();
    }
  });
  $('split-count').addEventListener('change', (e) => {
    const val = Math.max(2, Math.min(100, parseInt(e.target.value) || 2));
    e.target.value = val;
    State.splitCount = val;
    State.pieceOrder = [];
    renderAll();
  });

  // 固定尺寸
  $('fixed-size').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (val >= 10) {
      State.fixedSize = val;
      State.pieceOrder = [];
      renderAll();
    }
  });
  $('fixed-size').addEventListener('change', (e) => {
    const val = Math.max(10, parseInt(e.target.value) || 100);
    e.target.value = val;
    State.fixedSize = val;
    State.pieceOrder = [];
    renderAll();
  });

  // 网格行列
  $('grid-cols').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (val >= 1) { State.gridCols = val; State.pieceOrder = []; renderAll(); }
  });
  $('grid-rows').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (val >= 1) { State.gridRows = val; State.pieceOrder = []; renderAll(); }
  });

  // 重叠
  $('overlap').addEventListener('input', (e) => {
    State.overlap = parseInt(e.target.value) || 0;
    $('overlap-val').textContent = State.overlap + ' px';
    State.pieceOrder = [];
    renderPreview();
    updateInfo();
  });

  // 输出格式
  $('output-format').addEventListener('change', (e) => {
    State.outputFormat = e.target.value;
  });

  // 输出质量
  $('output-quality').addEventListener('input', (e) => {
    State.outputQuality = parseInt(e.target.value) / 100;
    $('quality-val').textContent = e.target.value + '%';
  });

  // 命名规则
  $('naming-rule').addEventListener('input', (e) => {
    State.namingRule = e.target.value || '{name}_part_{index}';
  });

  // 序号起始
  $('index-start').addEventListener('input', (e) => {
    State.indexStart = parseInt(e.target.value) || 1;
    renderPreview();
  });

  // 水印
  $('add-watermark').addEventListener('change', (e) => {
    State.addWatermark = e.target.checked;
    $('watermark-options').classList.toggle('hidden', !e.target.checked);
  });
  $('watermark-text').addEventListener('input', (e) => State.watermarkText = e.target.value);
  $('watermark-pos').addEventListener('change', (e) => State.watermarkPos = e.target.value);
  $('watermark-color').addEventListener('input', (e) => State.watermarkColor = e.target.value);
  $('watermark-opacity').addEventListener('input', (e) => {
    State.watermarkOpacity = parseInt(e.target.value) / 100;
    $('watermark-opacity-val').textContent = e.target.value + '%';
  });

  // 边框
  $('add-border').addEventListener('change', (e) => {
    State.addBorder = e.target.checked;
    $('border-options').classList.toggle('hidden', !e.target.checked);
  });
  $('border-size').addEventListener('input', (e) => {
    State.borderSize = parseInt(e.target.value) || 0;
    renderPreview();
  });
  $('border-color').addEventListener('input', (e) => State.borderColor = e.target.value);

  // ZIP下载
  $('zip-download').addEventListener('change', (e) => State.zipDownload = e.target.checked);

  // 预设按钮（内置）
  document.querySelectorAll('.preset-item[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  // 保存预设
  $('btn-save-preset').addEventListener('click', () => {
    $('save-preset-overlay').classList.remove('hidden');
    $('new-preset-name').value = '';
    setTimeout(() => $('new-preset-name').focus(), 50);
  });
  $('close-save-preset').addEventListener('click', () => $('save-preset-overlay').classList.add('hidden'));
  $('cancel-save-preset').addEventListener('click', () => $('save-preset-overlay').classList.add('hidden'));
  $('confirm-save-preset').addEventListener('click', () => {
    const name = $('new-preset-name').value.trim();
    if (!name) { showToast('请输入预设名称', 'warning'); return; }
    savePreset(name);
    $('save-preset-overlay').classList.add('hidden');
  });

  // 管理预设
  $('btn-manage-presets').addEventListener('click', () => {
    $('preset-modal-overlay').classList.remove('hidden');
    renderPresetManagerModal();
  });
  $('close-preset-modal').addEventListener('click', () => {
    $('preset-modal-overlay').classList.add('hidden');
  });

  // 帮助按钮（侧边栏 ? 按钮）
  document.querySelectorAll('.help-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openHelp(btn.dataset.help);
    });
  });
  $('close-help').addEventListener('click', closeHelp);
  $('help-overlay').addEventListener('click', closeHelp);

  // 工具栏按钮
  $('btn-rotate').addEventListener('click', rotateImage);
  $('btn-flip-h').addEventListener('click', flipHorizontal);
  $('btn-flip-v').addEventListener('click', flipVertical);
  $('btn-clear-image').addEventListener('click', () => {
    if (State.images.length === 0) return;
    if (!confirm('确定要清除所有已载入的图片吗？')) return;
    State.images = [];
    State.currentIdx = 0;
    State.guides = [];
    State.excludedPieces.clear();
    State.pieceOrder = [];
    State.selectedPiece = -1;
    DOM.editorArea.classList.add('hidden');
    DOM.uploadZone.classList.remove('hidden');
    DOM.previewList.innerHTML = '<div class="preview-empty"><p>上传图片后显示预览</p></div>';
    setStatus('就绪');
  });
  $('btn-apply-split').addEventListener('click', () => {
    State.pieceOrder = [];
    renderAll();
    showToast('分割已应用，预览已更新', 'success', 2000);
  });

  // 导出
  $('btn-export-all').addEventListener('click', exportAll);

  // 缩放
  $('zoom-in').addEventListener('click', () => setZoom(State.zoom * 1.25));
  $('zoom-out').addEventListener('click', () => setZoom(State.zoom / 1.25));
  $('zoom-fit').addEventListener('click', () => {
    State.zoom = 1;
    renderCanvas();
    renderGuides();
    DOM.zoomLevel.textContent = '100%';
  });

  // 撤销/重做按钮
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);

  // 画布点击（自定义模式）
  DOM.mainCanvas.addEventListener('click', handleCanvasClick);

  // 刷新预览
  $('btn-preview-reload').addEventListener('click', () => {
    State.pieceOrder = [];
    renderPreview();
    showToast('预览已刷新', 'info', 1500);
  });

  // 片段操作按钮
  $('op-download-single').addEventListener('click', () => {
    if (State.selectedPiece >= 0) exportSingle(State.selectedPiece);
  });

  $('op-delete-piece').addEventListener('click', () => {
    if (State.selectedPiece < 0) return;
    // 切换排除状态
    if (State.excludedPieces.has(State.selectedPiece)) {
      State.excludedPieces.delete(State.selectedPiece);
      showToast('已恢复该片段', 'success', 2000);
    } else {
      State.excludedPieces.add(State.selectedPiece);
      showToast('已排除该片段（不会被导出）', 'info', 2000);
    }
    renderPreview();
    updatePieceOps();
  });

  $('op-move-up').addEventListener('click', () => {
    if (State.selectedPiece < 0) return;
    const rects = generateSlices();
    if (State.pieceOrder.length !== rects.length) {
      State.pieceOrder = rects.map((_, i) => i);
    }
    const dispIdx = State.pieceOrder.indexOf(State.selectedPiece);
    if (dispIdx <= 0) return;
    // 交换
    [State.pieceOrder[dispIdx - 1], State.pieceOrder[dispIdx]] =
      [State.pieceOrder[dispIdx], State.pieceOrder[dispIdx - 1]];
    renderPreview();
    showToast('已上移', 'info', 1000);
  });

  $('op-move-down').addEventListener('click', () => {
    if (State.selectedPiece < 0) return;
    const rects = generateSlices();
    if (State.pieceOrder.length !== rects.length) {
      State.pieceOrder = rects.map((_, i) => i);
    }
    const dispIdx = State.pieceOrder.indexOf(State.selectedPiece);
    if (dispIdx < 0 || dispIdx >= State.pieceOrder.length - 1) return;
    [State.pieceOrder[dispIdx], State.pieceOrder[dispIdx + 1]] =
      [State.pieceOrder[dispIdx + 1], State.pieceOrder[dispIdx]];
    renderPreview();
    showToast('已下移', 'info', 1000);
  });

  $('op-merge-next').addEventListener('click', () => {
    if (State.selectedPiece < 0) return;
    const rects = generateSlices();
    if (State.pieceOrder.length !== rects.length) {
      State.pieceOrder = rects.map((_, i) => i);
    }
    const dispIdx = State.pieceOrder.indexOf(State.selectedPiece);
    if (dispIdx >= State.pieceOrder.length - 1) {
      showToast('已是最后一块，无法合并', 'warning'); return;
    }
    // 合并：将下一块排除，并从排序中移除
    const nextOrigIdx = State.pieceOrder[dispIdx + 1];
    State.excludedPieces.add(nextOrigIdx);
    State.pieceOrder.splice(dispIdx + 1, 1);
    showToast('已合并（下一块已排除）。如需真正合并内容请在导出后手动裁剪，或在自由模式中删除分割线。', 'info', 5000);
    renderPreview();
    updatePieceOps();
  });

  $('op-split-here').addEventListener('click', () => {
    if (State.selectedPiece < 0) return;
    State.mode = 'custom';
    document.querySelectorAll('.mode-card').forEach(c => {
      c.classList.toggle('active', c.dataset.mode === 'custom');
    });
    updateParamVisibility();
    renderAll();
    showToast('已切换至自由模式，单击画布添加分割线', 'info', 4000);
  });

  // 模态框遮罩点击关闭
  $('preset-modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('preset-modal-overlay')) $('preset-modal-overlay').classList.add('hidden');
  });
  $('save-preset-overlay').addEventListener('click', (e) => {
    if (e.target === $('save-preset-overlay')) $('save-preset-overlay').classList.add('hidden');
  });

  // Enter 确认保存预设
  $('new-preset-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('confirm-save-preset').click();
  });

  // 窗口大小变化重新适应
  window.addEventListener('resize', () => {
    if (State.images[State.currentIdx]) {
      renderCanvas();
      renderGuides();
    }
  });
}

function renderPresetManagerModal() {
  const body = $('preset-modal-body');
  if (State.presets.length === 0) {
    body.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">暂无自定义预设</p>';
    const importExportRow = document.createElement('div');
    importExportRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;justify-content:center';
    importExportRow.innerHTML = `
      <button class="btn-secondary" onclick="exportPresets()">📤 导出所有预设</button>
      <button class="btn-secondary" onclick="importPresets()">📥 导入预设文件</button>
    `;
    body.appendChild(importExportRow);
    return;
  }

  body.innerHTML = '';
  State.presets.forEach((p, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px';
    row.innerHTML = `
      <span style="flex:1;font-size:13px">${p.hint || p.key}</span>
      <span style="font-size:11px;color:var(--text-muted)">${getModeLabel(p.mode)}</span>
      <button class="btn-ghost btn-sm" onclick="applyPreset('${p.key}');$('preset-modal-overlay').classList.add('hidden')">应用</button>
      <button class="btn-danger btn-sm" onclick="deletePreset(${i})">删除</button>
    `;
    body.appendChild(row);
  });

  const importExportRow = document.createElement('div');
  importExportRow.style.cssText = 'display:flex;gap:8px;margin-top:16px';
  importExportRow.innerHTML = `
    <button class="btn-secondary" onclick="exportPresets()">📤 导出所有预设</button>
    <button class="btn-secondary" onclick="importPresets()">📥 导入预设文件</button>
  `;
  body.appendChild(importExportRow);
}

function deletePreset(idx) {
  const name = State.presets[idx].hint || State.presets[idx].key;
  State.presets.splice(idx, 1);
  localStorage.setItem('isp_presets', JSON.stringify(State.presets));
  renderPresetList();
  renderPresetManagerModal();
  showToast(`已删除预设「${name}」`, 'warning');
}

// =============================================
// 初始化
// =============================================
function init() {
  // 初始化 DOM 引用
  initDOM();

  // 恢复主题
  const savedTheme = localStorage.getItem('isp_theme') || 'dark';
  const root = document.documentElement;
  if (savedTheme === 'auto') {
    root.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    root.dataset.theme = savedTheme;
  }
  const themeBtn = $('theme-toggle');
  if (themeBtn) {
    themeBtn.textContent = (root.dataset.theme === 'dark') ? '🌙' : '☀️';
  }

  // 初始化参数面板
  updateParamVisibility();

  // 绑定事件
  bindEvents();

  // 恢复自定义预设
  renderPresetList();

  // 初始化滑块颜色
  initSliders();

  // 欢迎提示
  setStatus('就绪 · 拖拽或点击上传图片开始使用');

  // 检测 JSZip
  setTimeout(() => {
    if (typeof JSZip === 'undefined') {
      console.warn('JSZip 加载失败，将使用逐个下载模式。');
      $('zip-download').checked = false;
      State.zipDownload = false;
      showToast('JSZip 加载失败，将使用逐个下载', 'warning', 4000);
    }
  }, 2000);

  console.log('%c ImageSlicer Pro v2.1 ', 'background:#6366f1;color:white;font-size:14px;padding:4px 8px;border-radius:4px');
  console.log('%c Bug修复版 · 纯原生JS · 零后端依赖 · 开源可定制 ', 'color:#818cf8');
}

function initSliders() {
  document.querySelectorAll('.slider').forEach(slider => {
    const updateColor = () => {
      const min = parseFloat(slider.min) || 0;
      const max = parseFloat(slider.max) || 100;
      const val = ((parseFloat(slider.value) - min) / (max - min)) * 100;
      slider.style.setProperty('--val', val + '%');
    };
    slider.addEventListener('input', updateColor);
    updateColor();
  });
}

// DOM 就绪后启动
// =============================================
// Enhanced preview and zoom overrides v2.2
// =============================================
function getCurrentPreviewRect() {
  const rects = generateSlices();
  if (!rects.length) return null;
  let idx = State.selectedPiece;
  if (idx < 0 || !rects[idx]) idx = State.pieceOrder[0] ?? 0;
  return rects[idx] ? { rect: rects[idx], index: idx } : null;
}

function drawSliceToCanvas(canvas, entry, rect, zoom) {
  const border = State.addBorder ? State.borderSize : 0;
  const outW = rect.w + border * 2;
  const outH = rect.h + border * 2;
  const displayW = Math.max(1, Math.round(outW * zoom));
  const displayH = Math.max(1, Math.round(outH * zoom));
  const renderScale = Math.min(
    1,
    8192 / displayW,
    8192 / displayH,
    Math.sqrt(24000000 / Math.max(1, displayW * displayH))
  );

  canvas.width = Math.max(1, Math.round(displayW * renderScale));
  canvas.height = Math.max(1, Math.round(displayH * renderScale));
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';

  const ctx = getCtx(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(renderScale * zoom, 0, 0, renderScale * zoom, 0, 0);
  if (border > 0) {
    ctx.fillStyle = State.borderColor;
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.drawImage(entry.img, rect.x, rect.y, rect.w, rect.h, border, border, rect.w, rect.h);
  if (State.addWatermark && State.watermarkText) drawWatermark(ctx, outW, outH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function renderPreviewViewer() {
  const entry = State.images[State.currentIdx];
  if (!entry || !DOM.previewViewer || !DOM.previewCanvas) return;
  const current = getCurrentPreviewRect();
  if (!current) {
    DOM.previewViewer.classList.add('hidden');
    return;
  }

  DOM.previewViewer.classList.remove('hidden');
  const title = $('preview-viewer-title');
  if (title) title.textContent = `#${current.index + State.indexStart} · ${current.rect.w} x ${current.rect.h}`;
  drawSliceToCanvas(DOM.previewCanvas, entry, current.rect, State.previewZoom);
  if (DOM.previewZoomLevel) DOM.previewZoomLevel.textContent = Math.round(State.previewZoom * 100) + '%';
}

function setPreviewZoom(z) {
  State.previewZoom = Math.max(0.05, z);
  renderPreviewViewer();
}

function renderCanvas() {
  const entry = State.images[State.currentIdx];
  if (!entry) return;

  const canvas = DOM.mainCanvas;
  const container = DOM.canvasContainer;
  const maxW = Math.max(1, container.clientWidth - 40);
  const maxH = Math.max(1, container.clientHeight - 40);
  const isRotated90 = State.rotation === 90 || State.rotation === 270;
  const displayOrigW = isRotated90 ? entry.height : entry.width;
  const displayOrigH = isRotated90 ? entry.width : entry.height;

  State.canvasScale = Math.min(1, maxW / displayOrigW, maxH / displayOrigH);
  const displayW = Math.max(1, Math.round(displayOrigW * State.canvasScale * State.zoom));
  const displayH = Math.max(1, Math.round(displayOrigH * State.canvasScale * State.zoom));
  State.renderScale = Math.min(
    1,
    8192 / displayW,
    8192 / displayH,
    Math.sqrt(24000000 / Math.max(1, displayW * displayH))
  );

  canvas.width = Math.max(1, Math.round(displayW * State.renderScale));
  canvas.height = Math.max(1, Math.round(displayH * State.renderScale));
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';
  DOM.canvasWrap.style.width = displayW + 'px';
  DOM.canvasWrap.style.height = displayH + 'px';

  const ctx = getCtx(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(State.renderScale, 0, 0, State.renderScale, 0, 0);
  ctx.save();
  ctx.translate(displayW / 2, displayH / 2);
  if (State.rotation) ctx.rotate(State.rotation * Math.PI / 180);
  if (State.flipH) ctx.scale(-1, 1);
  if (State.flipV) ctx.scale(1, -1);
  if (isRotated90) {
    ctx.drawImage(entry.img, -displayH / 2, -displayW / 2, displayH, displayW);
  } else {
    ctx.drawImage(entry.img, -displayW / 2, -displayH / 2, displayW, displayH);
  }
  ctx.restore();
  drawSplitHighlight(ctx, displayW, displayH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function setZoom(z) {
  State.zoom = Math.max(0.05, z);
  DOM.zoomLevel.textContent = Math.round(State.zoom * 100) + '%';
  renderCanvas();
  renderGuides();
}

function renderGuides() {
  const layer = DOM.guidesLayer;
  if (!layer || !DOM.mainCanvas) return;
  layer.innerHTML = '';

  const w = parseFloat(DOM.mainCanvas.style.width) || DOM.mainCanvas.width;
  const h = parseFloat(DOM.mainCanvas.style.height) || DOM.mainCanvas.height;
  layer.style.width = w + 'px';
  layer.style.height = h + 'px';
  const lines = getSplitPositions(w, h);

  const createLine = (type, pos) => {
    const line = document.createElement('div');
    line.className = `guide-line ${type === 'h' ? 'horizontal' : 'vertical'}`;
    const label = document.createElement('div');
    label.className = 'guide-label';

    if (type === 'h') {
      line.style.top = pos + 'px';
      label.style.top = '2px';
      label.style.left = '4px';
      const origY = Math.round(pos / (State.canvasScale * State.zoom));
      label.textContent = `y: ${origY}px`;
    } else {
      line.style.left = pos + 'px';
      label.style.left = '2px';
      label.style.top = '4px';
      const origX = Math.round(pos / (State.canvasScale * State.zoom));
      label.textContent = `x: ${origX}px`;
    }

    line.appendChild(label);

    if (State.mode === 'custom') {
      line.style.cursor = type === 'h' ? 'ns-resize' : 'ew-resize';
      const del = document.createElement('button');
      del.className = 'guide-delete';
      del.textContent = 'x';
      del.title = '删除此分割线';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const ratio = type === 'h' ? pos / h : pos / w;
        const idx = State.guides.findIndex(g => g.type === type && Math.abs(g.pos - ratio) < 0.02);
        if (idx >= 0) {
          saveHistory();
          State.guides.splice(idx, 1);
          renderGuides();
          renderPreview();
          updateInfo();
        }
      });
      line.appendChild(del);

      let dragging = false;
      line.addEventListener('mousedown', (e) => {
        if (e.target === del) return;
        dragging = true;
        State.draggingGuide = { type, pos };
        e.preventDefault();
        e.stopPropagation();
      });

      const onMove = (ev) => {
        if (!dragging) return;
        const rect = DOM.mainCanvas.getBoundingClientRect();
        if (type === 'h') {
          const newY = Math.max(0, Math.min(h, ev.clientY - rect.top));
          const ratio = newY / h;
          const idx = State.guides.findIndex(g => g.type === type && Math.abs(g.pos - State.draggingGuide.pos) < 0.02);
          if (idx >= 0) {
            State.guides[idx].pos = ratio;
            State.draggingGuide.pos = ratio;
            line.style.top = newY + 'px';
            label.textContent = `y: ${Math.round(newY / (State.canvasScale * State.zoom))}px`;
          }
        } else {
          const newX = Math.max(0, Math.min(w, ev.clientX - rect.left));
          const ratio = newX / w;
          const idx = State.guides.findIndex(g => g.type === type && Math.abs(g.pos - State.draggingGuide.pos) < 0.02);
          if (idx >= 0) {
            State.guides[idx].pos = ratio;
            State.draggingGuide.pos = ratio;
            line.style.left = newX + 'px';
            label.textContent = `x: ${Math.round(newX / (State.canvasScale * State.zoom))}px`;
          }
        }
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        State.draggingGuide = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        renderPreview();
        updateInfo();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    layer.appendChild(line);
  };

  lines.h.forEach(y => createLine('h', y));
  lines.v.forEach(x => createLine('v', x));
}

function bindPreviewEnhancements() {
  $('preview-zoom-in')?.addEventListener('click', () => setPreviewZoom(State.previewZoom * 1.25));
  $('preview-zoom-out')?.addEventListener('click', () => setPreviewZoom(State.previewZoom / 1.25));
  $('preview-zoom-fit')?.addEventListener('click', () => {
    const current = getCurrentPreviewRect();
    if (!current || !DOM.previewViewport) return;
    const border = State.addBorder ? State.borderSize * 2 : 0;
    const fit = Math.min(
      1,
      (DOM.previewViewport.clientWidth - 24) / Math.max(1, current.rect.w + border),
      (DOM.previewViewport.clientHeight - 24) / Math.max(1, current.rect.h + border)
    );
    setPreviewZoom(Math.max(0.05, fit));
  });
  DOM.previewViewport?.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setPreviewZoom(State.previewZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false });
}

const __baseRenderPreview = renderPreview;
renderPreview = function enhancedRenderPreview() {
  __baseRenderPreview();
  renderPreviewViewer();
  DOM.previewList?.querySelectorAll('.preview-item').forEach(item => {
    item.addEventListener('dblclick', () => {
      State.selectedPiece = Number(item.dataset.origIdx);
      State.previewZoom = Math.max(State.previewZoom, 1);
      renderPreview();
      updatePieceOps();
    });
  });
};

const __baseBindEvents = bindEvents;
bindEvents = function enhancedBindEvents() {
  __baseBindEvents();
  bindPreviewEnhancements();
  bindPinchZoom();
};

function bindPinchZoom() {
  const wrap = DOM.canvasWrap;
  const container = DOM.canvasContainer;
  if (!wrap || !container) return;

  let mode = null;        // 'pan' | 'pinch'
  let startDist = 0;
  let startZoom = 1;
  let lastSingle = null;  // 单指上一帧坐标 {x,y}
  let lastCenter = null;  // 双指上一帧中心 {x,y}

  function pinchDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function pinchMid(t) {
    return {
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2
    };
  }

  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      mode = 'pan';
      lastSingle = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastCenter = null;
    } else if (e.touches.length === 2) {
      mode = 'pinch';
      startDist = pinchDist(e.touches);
      startZoom = State.zoom;
      lastCenter = pinchMid(e.touches);
    }
  }, { passive: false });

  wrap.addEventListener('touchmove', (e) => {
    if (mode === 'pan' && e.touches.length === 1) {
      e.preventDefault();
      const x = e.touches[0].clientX, y = e.touches[0].clientY;
      container.scrollLeft -= (x - lastSingle.x);
      container.scrollTop  -= (y - lastSingle.y);
      lastSingle = { x, y };
    } else if (mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const c = pinchMid(e.touches);
      const dist = pinchDist(e.touches);

      if (lastCenter) {
        container.scrollLeft -= (c.x - lastCenter.x);
        container.scrollTop  -= (c.y - lastCenter.y);
      }

      if (startDist > 0) {
        const oldZoom = State.zoom;
        const oldScrollX = container.scrollLeft;
        const oldScrollY = container.scrollTop;
        const rect = container.getBoundingClientRect();
        const vx = c.x - rect.left;
        const vy = c.y - rect.top;
        const c0x = vx + oldScrollX;
        const c0y = vy + oldScrollY;

        setZoom(startZoom * (dist / startDist));

        const ratio = State.zoom / oldZoom;
        container.scrollLeft = c0x * ratio - vx;
        container.scrollTop  = c0y * ratio - vy;
      }
      lastCenter = c;
    }
  }, { passive: false });

  function onEnd(e) {
    if (e.touches.length === 0) {
      mode = null; lastSingle = null; lastCenter = null;
    } else if (e.touches.length === 1) {
      mode = 'pan';
      lastSingle = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastCenter = null;
    }
  }
  wrap.addEventListener('touchend', onEnd);
  wrap.addEventListener('touchcancel', () => {
    mode = null; lastSingle = null; lastCenter = null;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
