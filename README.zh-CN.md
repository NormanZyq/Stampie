# Stampie - 盖章 PDF 工具（网页版）

[English README](README.md)

Codex生成的盖章小工具，挺方便的所以开源共享了。

概览
- 轻量网页应用，在 PDF 上盖“印章”图片并导出压平副本。
- 全部在浏览器本地运行，无需上传或服务器。
- 支持中/英文双语，工具栏可切换语言。

功能
- 选择 PDF 与印章图片（推荐 PNG 透明底，也支持 JPG）。
- 预览页面，在任意页面放置多个印章。
- 拖动移动；滚轮或滑块调整大小；支持不透明度调节。
- 提供 45/42/40 mm 等绝对尺寸预设（自动换算为 PDF 点 pt）。
- 撤销本页最后一个、清空本页。
- 导出压平后的 PDF，印章被“烘焙”到页内。

快速开始
1. 用浏览器打开 `index.html`（建议 Chrome/Edge）。
2. 点击“选择 PDF”加载文档。
3. 点击“选择印章图片 (PNG/JPG)”加载印章图。
4. 可按需调节顶部“视图缩放”。
5. 点击“在页面放置”，在画布中：
   - 单击：将印章中心移动到点击位置
   - 拖动：按住印章拖动移动
   - 滚轮或“大小（像素）”：调整大小，或使用大小预设
   - “不透明度”：调整透明度
   - “确认添加”：将当前印章落到当前页（可重复）
6. 需要时使用“撤销本页最后一个 / 清空本页”。
7. 点击“导出压平副本”下载结果 PDF。

注意
- 默认通过 CDN 加载 `pdf.js` 与 `pdf-lib`。内网/离线请自建并改为相对路径（见下）。
- 位置与尺寸以 PDF 点（pt）保存，导出时自动转换坐标系。
- 导出为压平效果：通过 `pdf-lib` 的 `opacity` 绘制到页面内容中。

离线/内网部署（可选）
- 将以下文件下载到 `web/vendor/`：
  - https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js
  - https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js
  - https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js
- 修改 `index.html`：
  ```html
  <script src="vendor/pdf.min.js"></script>
  <script src="vendor/pdf-lib.min.js"></script>
  ```
- 修改 `app.js` 顶部 worker 路径：
  ```js
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  ```

浏览器支持
- 推荐 Chrome、Edge、Firefox 的较新版本。

已知限制
- 目前未提供旋转功能，后续可扩展。
- 仅提供单页渲染视图（左右翻页），未含缩略图侧栏。

