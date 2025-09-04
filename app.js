// Configure pdf.js worker via CDN
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // i18n
  const i18n = {
    zh: {
      title: "Stampie - 盖章 PDF 工具",
      choosePdf: "选择 PDF",
      chooseSealImage: "选择印章图片 (PNG/JPG)",
      prevPage: "上一页",
      nextPage: "下一页",
      zoomLabel: "视图缩放",
      exportFlattened: "导出压平副本",
      sealSettings: "印章设置",
      noSealSelected: "未选择印章",
      sizePixels: "大小（像素）",
      sizePresets: "大小预设",
      opacity: "不透明度",
      placeOnPage: "在页面放置",
      confirmAdd: "确认添加",
      cancel: "取消",
      currentPageStamps: "当前页印章",
      none: "暂无",
      undoLastOnPage: "撤销本页最后一个",
      clearPage: "清空本页",
      footerHint: "提示：使用鼠标拖动印章移动位置，滚轮或滑块调整大小。",
      loadPdfError: "加载 PDF 失败，请确认文件是否有效。",
      loadSealError: "加载印章图片失败，请重新选择。",
      exportError: "导出失败，请重试或更换文件。",
      langLabel: "🇨🇳",
    },
    en: {
      title: "Stampie - PDF Stamping Tool",
      choosePdf: "Choose PDF",
      chooseSealImage: "Choose Seal Image (PNG/JPG)",
      prevPage: "Prev",
      nextPage: "Next",
      zoomLabel: "Zoom",
      exportFlattened: "Export Flattened Copy",
      sealSettings: "Seal Settings",
      noSealSelected: "No seal selected",
      sizePixels: "Size (pixels)",
      sizePresets: "Size Presets",
      opacity: "Opacity",
      placeOnPage: "Place on Page",
      confirmAdd: "Confirm",
      cancel: "Cancel",
      currentPageStamps: "Stamps on This Page",
      none: "None",
      undoLastOnPage: "Undo Last on Page",
      clearPage: "Clear Page",
      footerHint: "Tip: Drag to move seal; use wheel or slider to resize.",
      loadPdfError: "Failed to load PDF. Please check the file.",
      loadSealError: "Failed to load seal image. Please try again.",
      exportError: "Export failed. Please retry or use another file.",
      langLabel: "🇬🇧",
    },
  };
  const storedLang = localStorage.getItem("lang");
  let currentLang = storedLang ? storedLang : ((navigator.language || "zh").startsWith("zh") ? "zh" : "en");
  function t(key) {
    const table = i18n[currentLang] || i18n.zh;
    return table[key] || key;
  }
  function applyTranslations() {
    // Update all elements with data-i18n
    $$('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    // Update stamps list empty placeholder if empty
    const list = $("#stampsList");
    if (list && list.classList.contains("empty")) {
      list.textContent = t("none");
    }
    // Update title and html lang
    document.title = t('title');
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    // Sync selector
    const select = $("#langSwitch");
    if (select && select.value !== currentLang) select.value = currentLang;
  }
  function setLang(lang) {
    currentLang = lang === 'en' ? 'en' : 'zh';
    localStorage.setItem('lang', currentLang);
    applyTranslations();
    refreshPager();
    refreshActionButtons();
  }

  // DOM elements
  const pdfInput = $("#pdfFile");
  const sealInput = $("#sealFile");
  const prevBtn = $("#prevPage");
  const nextBtn = $("#nextPage");
  const pageInfo = $("#pageInfo");
  const exportBtn = $("#exportBtn");
  const zoomRange = $("#zoom");
  const langSwitch = $("#langSwitch");

  const pageContainer = $("#pageContainer");
  const canvas = $("#pdfCanvas");
  const ctx = canvas.getContext("2d");

  const overlay = $("#overlay");
  const overlayImg = $("#overlayImg");

  const sealPreviewWrap = $("#sealPreviewWrap");
  const sealSize = $("#sealSize");
  const sealOpacity = $("#sealOpacity");
  const placeSealBtn = $("#placeSeal");
  const confirmSealBtn = $("#confirmSeal");
  const cancelSealBtn = $("#cancelSeal");
  const preset45Btn = $("#preset45");
  const preset42Btn = $("#preset42");
  const preset40Btn = $("#preset40");

  const stampsList = $("#stampsList");
  const undoStampBtn = $("#undoStamp");
  const clearPageBtn = $("#clearPage");

  // State
  let pdfBytes = null; // original PDF ArrayBuffer
  let pdfDoc = null; // pdf.js doc
  let pdfLibDocBytes = null; // keep original for export
  let numPages = 0;
  let currentPage = 1;
  let viewportScale = 1.0; // UI zoom (50-200%) affects canvas render size

  // seal image data
  let sealImage = null; // HTMLImageElement
  let sealImageDataURL = null; // for pdf-lib embedding later
  let sealPixelSize = 200; // displayed pixel size in UI
  let sealAlpha = 1.0;

  // Overlay placement
  let placing = false; // whether overlay is active for placement
  let dragOffset = { x: 0, y: 0 };
  let isDragging = false;

  // Stamps per page: { [pageNumber]: [{x,y,width,height,opacity}] }
  // x,y,width,height are in PDF points
  const stamps = {};

  function resetUI() {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    exportBtn.disabled = true;
    pageInfo.textContent = "— / —";
    canvas.width = 1;
    canvas.height = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    overlay.classList.add("hidden");
    overlayImg.src = "";
    placing = false;
    isDragging = false;
    Object.keys(stamps).forEach((k) => delete stamps[k]);
    refreshStampsList();
  }

  function enableSealControls(enabled) {
    sealSize.disabled = !enabled;
    sealOpacity.disabled = !enabled;
    placeSealBtn.disabled = !enabled || !pdfDoc;
    preset45Btn.disabled = !enabled;
    preset42Btn.disabled = !enabled;
    preset40Btn.disabled = !enabled;
  }

  function refreshPager() {
    pageInfo.textContent = `${currentPage} / ${numPages || "—"}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = !numPages || currentPage >= numPages;
  }

  function refreshActionButtons() {
    const hasAnyStamp = Object.values(stamps).some((arr) => arr && arr.length);
    exportBtn.disabled = !hasAnyStamp || !pdfDoc;
    const pageStamps = stamps[currentPage] || [];
    undoStampBtn.disabled = pageStamps.length === 0;
    clearPageBtn.disabled = pageStamps.length === 0;
  }

  function refreshStampsList() {
    const pageStamps = stamps[currentPage] || [];
    stampsList.innerHTML = "";
    if (pageStamps.length === 0) {
      stampsList.classList.add("empty");
      stampsList.textContent = t("none");
    } else {
      stampsList.classList.remove("empty");
      pageStamps.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "stamp-item";
        const xy = `x:${s.x.toFixed(1)}, y:${s.y.toFixed(1)}`;
        const wh = `w:${s.width.toFixed(1)}, h:${s.height.toFixed(1)}`;
        div.innerHTML = `<span>#${i + 1} (${xy}; ${wh}; α:${s.opacity.toFixed(2)})</span>`;
        stampsList.appendChild(div);
      });
    }
    refreshActionButtons();
  }

  async function loadPdf(file) {
    pdfBytes = await file.arrayBuffer();
    pdfLibDocBytes = pdfBytes.slice(0); // copy for export
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    pdfDoc = await loadingTask.promise;
    numPages = pdfDoc.numPages;
    currentPage = 1;
    viewportScale = zoomRange.valueAsNumber / 100;
    await renderPage();
    prevBtn.disabled = false;
    nextBtn.disabled = false;
    refreshPager();
    refreshActionButtons();
  }

  async function renderPage() {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: viewportScale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const renderContext = { canvasContext: ctx, viewport };
    ctx.save();
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    await page.render(renderContext).promise;

    // Position overlay container to match canvas (CSS pixels)
    const rect = canvas.getBoundingClientRect();
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.left = `${canvas.offsetLeft}px`;
    overlay.style.top = `${canvas.offsetTop}px`;

    // Draw existing stamps as preview on top of the rendered page
    drawStampsPreview();

    // update stamps list for current page
    refreshStampsList();
  }

  function setOverlayVisible(visible) {
    if (visible) overlay.classList.remove("hidden");
    else overlay.classList.add("hidden");
  }

  function setOverlayPosition(px, py) {
    // overlayImg is centered on its (left,top) via translate(-50%,-50%)
    overlayImg.style.left = `${px}px`;
    overlayImg.style.top = `${py}px`;
  }

  function canvasCssPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  }

  function pdfPointFromCanvas(xCanvas, yCanvas, wCanvasPx, hCanvasPx) {
    // pdf.js viewport at scale S: canvas = pdfPoints * S
    const s = viewportScale;
    const xPdf = xCanvas / s;
    const yPdf = yCanvas / s;
    const wPdf = wCanvasPx / s;
    const hPdf = hCanvasPx / s;
    return { xPdf, yPdf, wPdf, hPdf };
  }

  function mmToPoints(mm) {
    return (mm * 72) / 25.4;
  }

  // Apply absolute size preset (width in mm)
  function applyPresetMm(mm) {
    if (!pdfDoc || !sealImage) return;
    const wPdf = mmToPoints(mm);
    const rect = canvas.getBoundingClientRect();
    const cssToCanvas = canvas.width / rect.width; // device pixel ratio scaling
    // wCss such that: wPdf = (wCss * cssToCanvas) / viewportScale
    const wCss = (wPdf * viewportScale) / cssToCanvas;
    sealPixelSize = Math.max(8, Math.round(wCss));
    // Keep UI in sync
    sealSize.value = String(Math.min(parseInt(sealSize.max, 10), sealPixelSize));
    if (placing) updateOverlaySizeFromSlider();
  }

  // Draw placed stamps for the current page on top of the rendered canvas
  function drawStampsPreview() {
    const pageStamps = stamps[currentPage] || [];
    if (!pageStamps.length || !sealImage) return;
    ctx.save();
    for (const s of pageStamps) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity || 1));
      const w = s.width * viewportScale;
      const h = s.height * viewportScale;
      const x = s.x * viewportScale;
      const y = s.y * viewportScale; // top-left origin
      ctx.drawImage(sealImage, x, y, w, h);
    }
    ctx.restore();
  }

  function beginPlacing() {
    if (!sealImage || !pdfDoc) return;
    placing = true;
    overlayImg.src = sealImage.src;
    overlayImg.style.width = `${sealPixelSize}px`;
    overlayImg.style.opacity = sealAlpha.toString();
    setOverlayVisible(true);
    // default position: center of current canvas (CSS pixels)
    const rect = canvas.getBoundingClientRect();
    setOverlayPosition(rect.width / 2, rect.height / 2);
    confirmSealBtn.disabled = false;
    cancelSealBtn.disabled = false;
  }

  function endPlacing() {
    placing = false;
    setOverlayVisible(false);
    confirmSealBtn.disabled = true;
    cancelSealBtn.disabled = true;
  }

  function addCurrentOverlayAsStamp() {
    if (!placing) return;
    const leftCss = parseFloat(overlayImg.style.left);
    const topCss = parseFloat(overlayImg.style.top);
    const wCss = parseFloat(overlayImg.style.width);
    const hCss = (sealImage.naturalHeight / sealImage.naturalWidth) * wCss;

    // Convert CSS pixels to canvas drawing pixels
    const rect = canvas.getBoundingClientRect();
    const cssToCanvas = canvas.width / rect.width;
    const left = leftCss * cssToCanvas;
    const top = topCss * cssToCanvas;
    const w = wCss * cssToCanvas;
    const h = hCss * cssToCanvas;

    // overlayImg is centered; convert center to top-left in canvas coords
    const xCanvas = left - w / 2;
    const yCanvas = top - h / 2;

    const { xPdf, yPdf, wPdf, hPdf } = pdfPointFromCanvas(
      xCanvas,
      yCanvas,
      w,
      h
    );

    // Store as bottom-left origin for pdf-lib conversion later (we convert then)
    // Here we keep top-left oriented in PDF points for simplicity
    if (!stamps[currentPage]) stamps[currentPage] = [];
    stamps[currentPage].push({
      x: xPdf,
      y: yPdf,
      width: wPdf,
      height: hPdf,
      opacity: sealAlpha,
    });
    refreshStampsList();
    refreshActionButtons();
    // Draw the new stamp onto the preview and end placing
    drawStampsPreview();
    endPlacing();
  }

  async function exportFlattened() {
    if (!pdfLibDocBytes) return;
    const { PDFDocument, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.load(pdfLibDocBytes);
    let imgEmbed = null;
    let isPng = false;
    if (sealImageDataURL) {
      const header = sealImageDataURL.slice(0, 30);
      isPng = header.includes("image/png");
      const bytes = dataURLtoUint8Array(sealImageDataURL);
      imgEmbed = isPng
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes);
    }
    for (let p = 1; p <= pdfDoc.getPageCount(); p++) {
      const page = pdfDoc.getPage(p - 1);
      const { width: pw, height: ph } = page.getSize();
      const pageStamps = stamps[p] || [];
      for (const s of pageStamps) {
        if (!imgEmbed) continue;
        // s.x, s.y are top-left in PDF points. pdf-lib uses bottom-left origin
        const x = s.x;
        const yFromTop = s.y;
        const y = ph - (yFromTop + s.height);
        page.drawImage(imgEmbed, {
          x,
          y,
          width: s.width,
          height: s.height,
          opacity: Math.max(0, Math.min(1, s.opacity || 1)),
        });
      }
    }
    const bytes = await pdfDoc.save();
    downloadBytes(bytes, makeStampedFilename());
  }

  // Utils
  function dataURLtoUint8Array(dataUrl) {
    const [meta, base64] = dataUrl.split(",");
    const bin = atob(base64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function makeStampedFilename() {
    const f = pdfInput.files && pdfInput.files[0] ? pdfInput.files[0].name : "document.pdf";
    const dot = f.lastIndexOf(".");
    const base = dot > 0 ? f.slice(0, dot) : f;
    return `${base}_stamped.pdf`;
  }

  function updateOverlaySizeFromSlider() {
    if (!placing) return;
    overlayImg.style.width = `${sealPixelSize}px`;
  }

  function updateOverlayOpacityFromSlider() {
    if (!placing) return;
    overlayImg.style.opacity = String(sealAlpha);
  }

  // Event wiring
  pdfInput.addEventListener("change", async (e) => {
    resetUI();
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadPdf(file);
    } catch (err) {
      console.error(err);
      alert(t("loadPdfError"));
    }
    enableSealControls(!!sealImage);
  });

  sealInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      sealImage = img;
      sealImageDataURL = null; // regenerate below
      // preview
      sealPreviewWrap.innerHTML = "";
      const prevImg = new Image();
      prevImg.src = url;
      prevImg.alt = "seal";
      sealPreviewWrap.appendChild(prevImg);
      enableSealControls(true);
      placeSealBtn.disabled = !pdfDoc;
      // Convert to data URL (for pdf-lib embed) using canvas to preserve format
      const canvasTmp = document.createElement("canvas");
      canvasTmp.width = img.naturalWidth;
      canvasTmp.height = img.naturalHeight;
      const ict = canvasTmp.getContext("2d");
      ict.drawImage(img, 0, 0);
      // If original is PNG with transparency, toDataURL('image/png') keeps it
      // For JPEG, transparency not applicable
      const mime = file.type && (file.type === "image/png" ? "image/png" : "image/jpeg");
      sealImageDataURL = canvasTmp.toDataURL(mime, 0.95);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert(t("loadSealError"));
    };
    img.src = url;
  });

  prevBtn.addEventListener("click", async () => {
    if (!pdfDoc || currentPage <= 1) return;
    currentPage -= 1;
    await renderPage();
    refreshPager();
  });
  nextBtn.addEventListener("click", async () => {
    if (!pdfDoc || currentPage >= numPages) return;
    currentPage += 1;
    await renderPage();
    refreshPager();
  });

  zoomRange.addEventListener("input", async () => {
    viewportScale = zoomRange.valueAsNumber / 100;
    await renderPage();
    // Keep overlay position roughly consistent (no guarantee during active placing)
  });

  sealSize.addEventListener("input", () => {
    sealPixelSize = sealSize.valueAsNumber;
    updateOverlaySizeFromSlider();
  });
  sealOpacity.addEventListener("input", () => {
    sealAlpha = Math.max(0.1, Math.min(1, sealOpacity.valueAsNumber / 100));
    updateOverlayOpacityFromSlider();
  });

  // Size presets (absolute mm -> exact PDF size)
  preset45Btn.addEventListener("click", () => applyPresetMm(45));
  preset42Btn.addEventListener("click", () => applyPresetMm(42));
  preset40Btn.addEventListener("click", () => applyPresetMm(40));

  placeSealBtn.addEventListener("click", () => {
    beginPlacing();
  });

  cancelSealBtn.addEventListener("click", () => {
    endPlacing();
  });

  confirmSealBtn.addEventListener("click", () => {
    addCurrentOverlayAsStamp();
  });

  // Dragging overlay with mouse
  overlayImg.addEventListener("mousedown", (e) => {
    if (!placing) return;
    isDragging = true;
    const { x, y } = canvasCssPointFromEvent(e);
    const left = parseFloat(overlayImg.style.left);
    const top = parseFloat(overlayImg.style.top);
    dragOffset.x = left - x;
    dragOffset.y = top - y;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!placing || !isDragging) return;
    const { x, y } = canvasCssPointFromEvent(e);
    setOverlayPosition(x + dragOffset.x, y + dragOffset.y);
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  // Click on canvas to move center
  canvas.addEventListener("click", (e) => {
    if (!placing) return;
    const { x, y } = canvasCssPointFromEvent(e);
    setOverlayPosition(x, y);
  });

  // Wheel to resize when placing
  canvas.addEventListener("wheel", (e) => {
    if (!placing) return;
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    const step = 10;
    const newSize = Math.max(16, Math.min(1600, sealPixelSize - delta * step));
    sealPixelSize = newSize;
    sealSize.value = String(newSize);
    updateOverlaySizeFromSlider();
  }, { passive: false });

  // Stamps operations
  undoStampBtn.addEventListener("click", async () => {
    const arr = stamps[currentPage] || [];
    if (arr.length > 0) arr.pop();
    refreshStampsList();
    await renderPage();
  });
  clearPageBtn.addEventListener("click", async () => {
    if (stamps[currentPage]) stamps[currentPage] = [];
    refreshStampsList();
    await renderPage();
  });

  exportBtn.addEventListener("click", async () => {
    try {
      await exportFlattened();
    } catch (e) {
      console.error(e);
      alert(t("exportError"));
    }
  });

  // Initialize
  applyTranslations();
  if (langSwitch) {
    langSwitch.addEventListener('change', (e) => setLang(e.target.value));
  }
  resetUI();
})();
