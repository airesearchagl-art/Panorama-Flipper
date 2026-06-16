"use strict";

/* ---------- DOM ---------- */
const dropArea = document.getElementById("drop-area");
const fileInput = document.getElementById("file-input");
const chooseFileBtn = document.getElementById("choose-file-btn");
const errorMessage = document.getElementById("error-message");

const metaPanel = document.getElementById("meta-panel");
const metaFilename = document.getElementById("meta-filename");
const metaDimensions = document.getElementById("meta-dimensions");
const metaAspect = document.getElementById("meta-aspect");
const metaPanorama = document.getElementById("meta-panorama");
const metaFiletype = document.getElementById("meta-filetype");

const previewArea = document.getElementById("preview-area");
const originalCanvas = document.getElementById("original-canvas");
const flippedCanvas = document.getElementById("flipped-canvas");

const controls = document.getElementById("controls");
const flipBtn = document.getElementById("flip-btn");
const downloadPngBtn = document.getElementById("download-png-btn");
const downloadJpgBtn = document.getElementById("download-jpg-btn");
const resetBtn = document.getElementById("reset-btn");

/* ---------- State ---------- */
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PANORAMA_ASPECT_TARGET = 2;
const PANORAMA_ASPECT_TOLERANCE = 0.05; // 5% deviation from 2:1 is still "likely"
const JPEG_QUALITY = 0.92;

let state = {
  originalImage: null,
  fileBaseName: "panorama",
  fileExtension: "png",
  isFlipped: false,
};

/* ---------- Error display ---------- */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = "";
}

/* ---------- File handling ---------- */
function isSupportedFile(file) {
  if (SUPPORTED_TYPES.includes(file.type)) return true;
  // fallback for browsers/OSes that don't set MIME type correctly
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

function handleFile(file) {
  clearError();

  if (!file) {
    showError("画像を選択してください。");
    return;
  }

  if (!isSupportedFile(file)) {
    showError("対応していないファイル形式です。PNG、JPG/JPEG、WebPをご利用ください。");
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => showError("ファイルの読み込みに失敗しました。再度お試しください。");
  reader.onload = (event) => {
    const img = new Image();
    img.onerror = () => showError("画像の読み込みに失敗しました。ファイルが破損している可能性があります。");
    img.onload = () => onImageLoaded(img, file);
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function splitFileName(name) {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return { base: name, ext: "png" };
  return { base: name.slice(0, lastDot), ext: name.slice(lastDot + 1) };
}

/* ---------- Image loaded ---------- */
function onImageLoaded(img, file) {
  const { base, ext } = splitFileName(file.name);
  state.originalImage = img;
  state.fileBaseName = base;
  state.fileExtension = ext.toLowerCase();
  state.isFlipped = false;

  renderMeta(img, file);
  renderOriginal(img);
  resetFlippedCanvas();

  metaPanel.hidden = false;
  previewArea.hidden = false;
  controls.hidden = false;
  downloadPngBtn.disabled = true;
  downloadJpgBtn.disabled = true;
}

/* ---------- Meta info ---------- */
function renderMeta(img, file) {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const ratio = width / height;

  metaFilename.textContent = file.name;
  metaDimensions.textContent = `${width} x ${height} px`;
  metaAspect.textContent = `${ratio.toFixed(3)} : 1`;

  const deviation = Math.abs(ratio - PANORAMA_ASPECT_TARGET) / PANORAMA_ASPECT_TARGET;
  if (deviation <= PANORAMA_ASPECT_TOLERANCE) {
    metaPanorama.textContent = "360°パノラマ画像の可能性が高い";
  } else {
    metaPanorama.textContent = "通常画像、または2:1比率ではない画像";
  }

  metaFiletype.textContent = file.type || `(不明, .${state.fileExtension})`;
}

/* ---------- Canvas rendering ---------- */
function drawImageToCanvas(canvas, img, flip) {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  if (flip) {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, width, height);
    ctx.restore();
  } else {
    ctx.drawImage(img, 0, 0, width, height);
  }
}

function renderOriginal(img) {
  drawImageToCanvas(originalCanvas, img, false);
}

function resetFlippedCanvas() {
  const ctx = flippedCanvas.getContext("2d");
  flippedCanvas.width = state.originalImage.naturalWidth;
  flippedCanvas.height = state.originalImage.naturalHeight;
  ctx.clearRect(0, 0, flippedCanvas.width, flippedCanvas.height);
}

function flipHorizontal() {
  if (!state.originalImage) {
    showError("画像を選択してください。");
    return;
  }
  clearError();
  drawImageToCanvas(flippedCanvas, state.originalImage, true);
  state.isFlipped = true;
  downloadPngBtn.disabled = false;
  downloadJpgBtn.disabled = false;
}

/* ---------- Download ---------- */
function downloadCanvas(canvas, mimeType, extension) {
  if (!state.isFlipped) {
    showError("反転後の画像がまだ作成されていません。");
    return;
  }
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        showError("ダウンロード用の画像生成に失敗しました。");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.fileBaseName}_flipped.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    mimeType,
    mimeType === "image/jpeg" ? JPEG_QUALITY : undefined
  );
}

/* ---------- Reset ---------- */
function resetAll() {
  clearError();
  state = {
    originalImage: null,
    fileBaseName: "panorama",
    fileExtension: "png",
    isFlipped: false,
  };
  fileInput.value = "";
  metaPanel.hidden = true;
  previewArea.hidden = true;
  controls.hidden = true;
  downloadPngBtn.disabled = true;
  downloadJpgBtn.disabled = true;

  const octx = originalCanvas.getContext("2d");
  octx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
  const fctx = flippedCanvas.getContext("2d");
  fctx.clearRect(0, 0, flippedCanvas.width, flippedCanvas.height);
}

/* ---------- Events ---------- */
chooseFileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropArea.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  handleFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove("is-dragover");
  });
});

dropArea.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  handleFile(file);
});

flipBtn.addEventListener("click", flipHorizontal);
downloadPngBtn.addEventListener("click", () => downloadCanvas(flippedCanvas, "image/png", "png"));
downloadJpgBtn.addEventListener("click", () => downloadCanvas(flippedCanvas, "image/jpeg", "jpg"));
resetBtn.addEventListener("click", resetAll);
