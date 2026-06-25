# ImageSplitter

ImageSplitter 是一个小巧实用的图片切割工具，适合将大图切分为多个小块用于网页图集、切图发布、拼图展示等场景。

最终成果

- ImageSlicer-Pro-Portable-1.1.0.exe — 可执行的便携版（Portable），开箱即用。双击运行即可使用，无需安装或额外依赖。

亮点特性

- 批量处理：一次性对多张图片进行切割，提高效率。
- 自定义网格：自由设置行数与列数，支持固定像素或按比例切割。
- 多种输出格式：支持常见图像格式（PNG、JPEG 等）。
- 保持命名与目录结构：输出文件名可配置，便于与前端、游戏资源或自动化脚本对接。
- 便携可执行：提供 Windows 便携版，可直接分发给非技术用户使用。

快速开始（开箱即用）

1. 下载 ImageSlicer-Pro-Portable-1.1.0.exe（请到仓库 Releases 页面或附件下载）。
2. 将需要切割的图片放到一个文件夹中，或直接将图片拖放到程序窗口中。
3. 在程序界面中选择：
   - 行数（Rows）/ 列数（Columns）
   - 输出目录（Output folder）
   - 命名规则（Prefix / Suffix）
4. 点击“开始切割”（Start / Process），程序会在输出目录生成切片文件。

使用建议

- 如果需要保持透明通道，请使用 PNG 输入与输出格式。
- 大图切割时建议先确认输出目录空间和目标切片尺寸，避免生成过多小图导致管理困难。

从源码运行（可选）

如果你想查看源码或自行打包：

1. 克隆仓库：

   git clone https://github.com/geograhic/ImageSplitter.git

2. 进入项目目录并安装依赖（若有 package.json）：

   npm install

3. 启动开发环境或构建：

   npm start
   或
   npm run build

注：具体命令请参考仓库根目录的 package.json 或构建说明。

文件位置与 Releases

- 可执行文件（ImageSlicer-Pro-Portable-1.1.0.exe）通常放在 Releases 页面或仓库的 dist/、release/、build/ 等目录下，若未找到请检查 Releases。

常见问题

- Q：ImageSlicer-Pro-Portable-1.1.0.exe 放在哪？
  A：请先查看本仓库的 Releases 页面；如果仓库没有发布 Release，请检查 dist/ 或 release/ 目录，或在 Issue 中联系作者。

- Q：是否支持 macOS / Linux？
  A：当前仓库提供的是 Windows 便携可执行。如需跨平台支持，请通过源码在目标平台打包，或在 Issue 中提出需求。

贡献与反馈

欢迎提交 Issue 或 Pull Request 来改进项目。如果你发现 bug、需要新功能或想优化界面/体验，请在仓库中创建 issue，并附上复现步骤和样例图片。

许可证

请参见仓库中的 LICENSE 文件以获取完整的开源许可信息。

联系方式

- GitHub: @geograhic
