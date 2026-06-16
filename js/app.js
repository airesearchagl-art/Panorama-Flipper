"use strict";

/* ================================================================
   DOM references
================================================================ */
const dropArea        = document.getElementById("drop-area");
const fileInput       = document.getElementById("file-input");
const chooseFileBtn   = document.getElementById("choose-file-btn");
const errorMsg        = document.getElementById("error-message");
const statusMsg       = document.getElementById("status-message");

const modePanel       = document.getElementById("mode-panel");
const modeButtons     = document.querySelectorAll(".mode-btn");

const imageListSection = document.getElementById("image-list-section");
const imageListEl     = document.getElementById("image-list");
const imageCountEl    = document.getElementById("image-count");

const controls        = document.getElementById("controls");
const convertOneBtn   = document.getElementById("convert-one-btn");
const convertAllBtn   = document.getElementById("convert-all-btn");
const downloadPngBtn  = document.getElementById("download-png-btn");
const downloadJpgBtn  = document.getElementById("download-jpg-btn");
const batchPngBtn     = document.getElementById("batch-png-btn");
const batchJpgBtn     = document.getElementById("batch-jpg-btn");
const resetBtn        = document.getElementById("reset-btn");

const previewArea     = document.getElementById("preview-area");
const originalCanvas  = document.getElementById("original-canvas");
const flippedCanvas   = document.getElementById("flipped-canvas");
const flippedLabel    = document.getElementById("flipped-label");

const metaPanel       = document.getElementById("meta-panel");
const metaFilename    = document.getElementById("meta-filename");
const metaDimensions  = document.getElementById("meta-dimensions");
const metaAspect      = document.getElementById("meta-aspect");
const metaPanorama    = document.getElementById("meta-panorama");
const metaFiletype    = document.getElementById("meta-filetype");

/* ================================================================
   Constants
================================================================ */
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PANORAMA_ASPECT = 2;
const PANORAMA_TOLERANCE = 0.05;
const JPEG_QUALITY = 0.92;

const MODE_LABELS = {
  flip:   "左右反転後",
  rot180: "180°回転後",
  rot90:  "90°回転後",
  "rot-90": "-90°回転後",
};

const MODE_SUFFIX = {
  flip:   "_flipped",
  rot180: "_rot180",
  rot90:  "_rot90",
  "rot-90": "_rot-90",
};

const ZIP_PREFIX = {
  flip:   "flipped",
  rot180: "rot180",
  rot90:  "rot90",
  "rot-90": "rot-90",
};

/* ================================================================
   App state
================================================================ */
let currentMode = "flip";

// Each item: { id, file, image, thumbUrl, resultCanvas, status }
// status: "pending" | "done" | "error"
let imageItems = [];
let selectedId = null;

/* ================================================================
   Utilities
================================================================ */
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

function showStatus(msg) {
  statusMsg.textContent = msg;
  statusMsg.hidden = false;
}

function clearStatus() {
  statusMsg.hidden = true;
}

function splitFileName(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { base: name, ext: "png" };
  return { base: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
}

function isSupportedFile(file) {
  if (SUPPORTED_TYPES.includes(file.type)) return true;
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function setAllButtonsBusy(busy) {
  [convertOneBtn, convertAllBtn, downloadPngBtn, downloadJpgBtn,
    batchPngBtn, batchJpgBtn, resetBtn, chooseFileBtn].forEach(b => {
    b.disabled = busy;
  });
  modeButtons.forEach(b => { b.disabled = busy; });
}

/* ================================================================
   Transform mode
================================================================ */
function setMode(mode) {
  currentMode = mode;
  modeButtons.forEach(b => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  if (flippedLabel) flippedLabel.textContent = MODE_LABELS[mode] || "変換後";
}

modeButtons.forEach(btn => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

/* ================================================================
   Canvas transform functions
================================================================ */
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function drawFlipped(img) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
  return c;
}

function drawRotate180(img) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.translate(w, h);
  ctx.rotate(Math.PI);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
  return c;
}

function drawRotate90(img) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const c = makeCanvas(h, w);
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.translate(h, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
  return c;
}

function drawRotateMinus90(img) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const c = makeCanvas(h, w);
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.translate(0, w);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
  return c;
}

function transformImage(img, mode) {
  switch (mode) {
    case "flip":    return drawFlipped(img);
    case "rot180":  return drawRotate180(img);
    case "rot90":   return drawRotate90(img);
    case "rot-90":  return drawRotateMinus90(img);
    default:        return drawFlipped(img);
  }
}

/* ================================================================
   File loading
================================================================ */
function loadFiles(files) {
  clearError();
  const valid = [];
  const invalid = [];

  for (const f of files) {
    if (isSupportedFile(f)) {
      valid.push(f);
    } else {
      invalid.push(f.name);
    }
  }

  if (invalid.length > 0) {
    showError(`非対応ファイルをスキップしました：${invalid.join(", ")}`);
  }

  if (valid.length === 0) {
    if (invalid.length === 0) showError("画像を選択してください。");
    return;
  }

  let loaded = 0;
  for (const file of valid) {
    const item = {
      id: uid(),
      file,
      image: null,
      thumbUrl: null,
      resultCanvas: null,
      status: "pending",
    };
    imageItems.push(item);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        item.image = img;
        item.thumbUrl = e.target.result;
        loaded++;
        renderImageList();
        if (imageItems.length === 1 && loaded === 1) {
          selectItem(item.id);
        }
        if (loaded === valid.length) showSections();
      };
      img.onerror = () => {
        item.status = "error";
        loaded++;
        renderImageList();
        if (loaded === valid.length) showSections();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function showSections() {
  modePanel.hidden = false;
  imageListSection.hidden = false;
  controls.hidden = false;
  updateBatchButtons();
}

/* ================================================================
   Image list rendering
================================================================ */
function renderImageList() {
  imageListEl.innerHTML = "";
  imageCountEl.textContent = `${imageItems.length} 枚`;

  imageItems.forEach(item => {
    const el = document.createElement("div");
    el.className = "image-item" + (item.id === selectedId ? " is-selected" : "");
    el.setAttribute("role", "option");
    el.setAttribute("aria-selected", item.id === selectedId ? "true" : "false");
    el.dataset.id = item.id;

    const img = document.createElement("img");
    img.className = "image-item__thumb";
    img.src = item.thumbUrl || "";
    img.alt = "";

    const info = document.createElement("div");
    info.className = "image-item__info";
    const { base, ext } = splitFileName(item.file.name);
    const ratio = item.image
      ? (item.image.naturalWidth / item.image.naturalHeight).toFixed(2)
      : "—";
    const dims = item.image
      ? `${item.image.naturalWidth}×${item.image.naturalHeight}`
      : "読み込み中";
    info.innerHTML = `
      <div class="image-item__name" title="${item.file.name}">${item.file.name}</div>
      <div class="image-item__meta">${dims}　比率 ${ratio}:1　${ext.toUpperCase()}</div>`;

    const badge = document.createElement("span");
    badge.className = "image-item__badge " + badgeClass(item.status);
    badge.textContent = badgeLabel(item.status);

    el.append(img, info, badge);
    el.addEventListener("click", () => selectItem(item.id));
    imageListEl.appendChild(el);
  });
}

function badgeClass(status) {
  return status === "done" ? "badge--done"
    : status === "error" ? "badge--error"
    : "badge--pending";
}

function badgeLabel(status) {
  return status === "done" ? "変換済み"
    : status === "error" ? "エラー"
    : "未変換";
}

/* ================================================================
   Selection & preview
================================================================ */
function selectItem(id) {
  selectedId = id;
  const item = imageItems.find(i => i.id === id);
  if (!item || !item.image) return;

  renderImageList();
  renderMeta(item);
  renderOriginalPreview(item.image);
  renderResultPreview(item);

  previewArea.hidden = false;
  metaPanel.hidden = false;

  downloadPngBtn.disabled = !item.resultCanvas;
  downloadJpgBtn.disabled = !item.resultCanvas;
}

function renderMeta(item) {
  const { image, file } = item;
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const ratio = w / h;
  const { ext } = splitFileName(file.name);

  metaFilename.textContent = file.name;
  metaDimensions.textContent = `${w} × ${h} px`;
  metaAspect.textContent = `${ratio.toFixed(3)} : 1`;
  metaPanorama.textContent =
    Math.abs(ratio - PANORAMA_ASPECT) / PANORAMA_ASPECT <= PANORAMA_TOLERANCE
      ? "360°パノラマ画像の可能性が高い"
      : "通常画像、または2:1比率ではない画像";
  metaFiletype.textContent = file.type || `(不明, .${ext})`;
}

function renderOriginalPreview(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  originalCanvas.width = w;
  originalCanvas.height = h;
  originalCanvas.getContext("2d").drawImage(img, 0, 0, w, h);
}

function renderResultPreview(item) {
  flippedLabel.textContent = MODE_LABELS[currentMode] || "変換後";
  if (!item.resultCanvas) {
    flippedCanvas.width = item.image.naturalWidth;
    flippedCanvas.height = item.image.naturalHeight;
    flippedCanvas.getContext("2d").clearRect(0, 0, flippedCanvas.width, flippedCanvas.height);
    return;
  }
  const src = item.resultCanvas;
  flippedCanvas.width = src.width;
  flippedCanvas.height = src.height;
  flippedCanvas.getContext("2d").drawImage(src, 0, 0);
}

/* ================================================================
   Conversion
================================================================ */
function convertItem(item) {
  if (!item.image) return;
  try {
    item.resultCanvas = transformImage(item.image, currentMode);
    item.status = "done";
  } catch (e) {
    item.status = "error";
  }
}

convertOneBtn.addEventListener("click", () => {
  clearError();
  const item = imageItems.find(i => i.id === selectedId);
  if (!item) { showError("画像を選択してください。"); return; }
  convertItem(item);
  renderImageList();
  renderResultPreview(item);
  downloadPngBtn.disabled = !item.resultCanvas;
  downloadJpgBtn.disabled = !item.resultCanvas;
  updateBatchButtons();
});

convertAllBtn.addEventListener("click", async () => {
  clearError();
  if (imageItems.length === 0) { showError("画像を選択してください。"); return; }
  setAllButtonsBusy(true);
  showStatus("変換中...");

  await asyncForEach(imageItems, async (item) => {
    convertItem(item);
    await yieldTick();
  });

  renderImageList();
  const sel = imageItems.find(i => i.id === selectedId);
  if (sel) {
    renderResultPreview(sel);
    downloadPngBtn.disabled = !sel.resultCanvas;
    downloadJpgBtn.disabled = !sel.resultCanvas;
  }
  updateBatchButtons();
  clearStatus();
  setAllButtonsBusy(false);
  restoreButtonStates();
});

/* ================================================================
   Download — single
================================================================ */
function downloadSingle(mimeType, ext) {
  const item = imageItems.find(i => i.id === selectedId);
  if (!item || !item.resultCanvas) {
    showError("変換済み画像がありません。まず変換してください。");
    return;
  }
  const { base } = splitFileName(item.file.name);
  const suffix = MODE_SUFFIX[currentMode] || "_converted";
  const filename = `${base}${suffix}.${ext}`;
  blobDownload(item.resultCanvas, mimeType, filename);
}

downloadPngBtn.addEventListener("click", () => downloadSingle("image/png", "png"));
downloadJpgBtn.addEventListener("click", () => downloadSingle("image/jpeg", "jpg"));

/* ================================================================
   Download — batch ZIP
================================================================ */
async function downloadBatchZip(mimeType, ext) {
  const done = imageItems.filter(i => i.status === "done" && i.resultCanvas);
  if (done.length === 0) {
    showError("一括ダウンロードする変換済み画像がありません。");
    return;
  }

  if (typeof JSZip === "undefined") {
    showError("ZIPライブラリ（JSZip）が読み込まれていません。個別ダウンロードをご利用ください。");
    fallbackBatchDownload(done, mimeType, ext);
    return;
  }

  setAllButtonsBusy(true);
  showStatus("ZIP作成中...");

  const zip = new JSZip();
  const suffix = MODE_SUFFIX[currentMode] || "_converted";

  for (const item of done) {
    await new Promise((resolve) => {
      item.resultCanvas.toBlob((blob) => {
        if (blob) {
          const { base } = splitFileName(item.file.name);
          zip.file(`${base}${suffix}.${ext}`, blob);
        }
        resolve();
      }, mimeType, mimeType === "image/jpeg" ? JPEG_QUALITY : undefined);
    });
  }

  showStatus("ダウンロード準備完了...");
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const prefix = ZIP_PREFIX[currentMode] || "converted";
  const zipName = `panorama-flipper_${prefix}_${ext}.zip`;
  const url = URL.createObjectURL(zipBlob);
  triggerDownload(url, zipName);
  URL.revokeObjectURL(url);

  clearStatus();
  setAllButtonsBusy(false);
  restoreButtonStates();
}

function fallbackBatchDownload(items, mimeType, ext) {
  items.forEach((item, i) => {
    const { base } = splitFileName(item.file.name);
    const suffix = MODE_SUFFIX[currentMode] || "_converted";
    setTimeout(() => {
      blobDownload(item.resultCanvas, mimeType, `${base}${suffix}.${ext}`);
    }, i * 200);
  });
}

batchPngBtn.addEventListener("click", () => downloadBatchZip("image/png", "png"));
batchJpgBtn.addEventListener("click", () => downloadBatchZip("image/jpeg", "jpg"));

/* ================================================================
   Download helpers
================================================================ */
function blobDownload(canvas, mimeType, filename) {
  canvas.toBlob((blob) => {
    if (!blob) { showError("ダウンロード用の画像生成に失敗しました。"); return; }
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    URL.revokeObjectURL(url);
  }, mimeType, mimeType === "image/jpeg" ? JPEG_QUALITY : undefined);
}

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ================================================================
   UI state helpers
================================================================ */
function updateBatchButtons() {
  const hasConverted = imageItems.some(i => i.status === "done");
  batchPngBtn.disabled = !hasConverted;
  batchJpgBtn.disabled = !hasConverted;
  convertOneBtn.disabled = false;
  convertAllBtn.disabled = false;
  resetBtn.disabled = false;
}

function restoreButtonStates() {
  const sel = imageItems.find(i => i.id === selectedId);
  downloadPngBtn.disabled = !(sel && sel.resultCanvas);
  downloadJpgBtn.disabled = !(sel && sel.resultCanvas);
  convertOneBtn.disabled = false;
  convertAllBtn.disabled = false;
  resetBtn.disabled = false;
  chooseFileBtn.disabled = false;
  modeButtons.forEach(b => { b.disabled = false; });
}

/* ================================================================
   Reset
================================================================ */
resetBtn.addEventListener("click", () => {
  clearError();
  clearStatus();
  imageItems = [];
  selectedId = null;
  fileInput.value = "";

  modePanel.hidden = true;
  imageListSection.hidden = true;
  controls.hidden = true;
  previewArea.hidden = true;
  metaPanel.hidden = true;

  [originalCanvas, flippedCanvas].forEach(c => {
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
  });

  downloadPngBtn.disabled = true;
  downloadJpgBtn.disabled = true;
  batchPngBtn.disabled = true;
  batchJpgBtn.disabled = true;
});

/* ================================================================
   File input events
================================================================ */
chooseFileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropArea.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length > 0) {
    loadFiles(Array.from(e.target.files));
  }
});

["dragenter", "dragover"].forEach(ev => {
  dropArea.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach(ev => {
  dropArea.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove("is-dragover");
  });
});

dropArea.addEventListener("drop", (e) => {
  const files = Array.from(e.dataTransfer.files || []);
  if (files.length > 0) loadFiles(files);
});

/* ================================================================
   Async helpers
================================================================ */
function yieldTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function asyncForEach(arr, fn) {
  for (const item of arr) {
    await fn(item);
  }
}
