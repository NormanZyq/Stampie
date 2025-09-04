盖章 PDF 工具（网页版）

功能
- 选择 PDF 与印章图片（建议 PNG 透明底）
- 在页面中预览 PDF、放置印章位置
- 支持拖动移动、滑块或滚轮调整大小、透明度
- 支持多次在不同页添加多个印章
- 导出为压平后的 PDF 副本

使用方法
1. 打开 `web/index.html`（双击或用浏览器打开，建议 Chrome/Edge）
2. 点击“选择 PDF”加载文档
3. 点击“选择印章图片”加载印章图
4. 如需缩放视图，可调节顶部“视图缩放”
5. 点击左侧“在页面放置”，在画布中：
   - 单击：将印章中心移动到点击位置
   - 拖动：按住印章拖动移动
   - 滚轮或“大小（像素）”：调整大小
   - “不透明度”：调整透明度
   - “确认添加”：将当前印章落到当前页（可重复多次）
6. 若需要撤销或清空当前页印章，可使用“撤销本页最后一个 / 清空本页”
7. 完成后点击“导出压平副本”

注意事项
- 本页面使用 CDN 加载 `pdf.js` 与 `pdf-lib`。如需内网/离线使用，请将依赖下载到本地并替换为相对路径。
- 位置与尺寸以 PDF 内部点（pt）为单位保存，导出时会自动转换坐标系。
- 透明度由 `pdf-lib` 的 `opacity` 叠加到页面内容，相当于压平效果。

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
- 修改 `app.js` 顶部：
  ```js
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  ```

已知限制
- 当前交互为单一浮动印章的逐次“确认添加”，暂未提供旋转功能（可后续添加）。
- 页面仅渲染单页预览（可左右翻页）。如需缩略图导航可扩展。

