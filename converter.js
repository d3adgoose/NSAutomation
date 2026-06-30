let converterPdfFile = null;
let converterExcelFile = null;
let converterExcelFiles = [];
let converterMap = [];
let converterMatches = [];
let converterChangedPages = [];
let converterReplacementDetails = [];
let converterBuildCache = null;
let converterScanPromise = null;
let converterBuildPromise = null;
let converterRenderedPreviewKey = "";
let converterManualOverrides = [];
let converterLastScannedPages = [];
let converterLastOcrPages = [];
let converterPreviewFocusPage = null;
let converterSkippedReplacements = [];
let converterActiveReplacementKey = "";

const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;

document.addEventListener("DOMContentLoaded", () => {
  const pdfInput = document.getElementById("converterPdfUpload");
  const excelInput = document.getElementById("converterExcelUpload");

  const pdfDropZone = document.getElementById("converterPdfDropZone");
  const excelDropZone = document.getElementById("converterExcelDropZone");

  if (pdfInput) {
    pdfInput.addEventListener("change", event => {
      setConverterPdfFile(event.target.files[0]);
    });
  }

  if (excelInput) {
    excelInput.addEventListener("change", event => {
      setConverterExcelFiles(Array.from(event.target.files || []));
    });
  }

  setupConverterDropZone(pdfDropZone, "pdf");
  setupConverterDropZone(excelDropZone, "excel");
});

function setupConverterDropZone(dropZone, expectedType) {
  if (!dropZone) return;

  dropZone.addEventListener("dragover", event => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", event => {
    event.preventDefault();
    dropZone.classList.remove("dragover");

    const files = Array.from(event.dataTransfer.files || []);
    const file = files[0];
    if (!file) return;

    if (expectedType === "pdf") {
      setConverterPdfFile(file);
    }

    if (expectedType === "excel") {
      setConverterExcelFiles(files);
    }
  });
}

function setConverterPdfFile(file) {
  if (!file) return;

  const name = file.name.toLowerCase();

  if (!(file.type === "application/pdf" || name.endsWith(".pdf"))) {
    alert("Please drop or choose a PDF file in the PDF box.");
    return;
  }

  converterPdfFile = file;
  converterMatches = [];
  converterChangedPages = [];
  converterReplacementDetails = [];
  converterBuildCache = null;
  converterScanPromise = null;
  converterBuildPromise = null;
  converterRenderedPreviewKey = "";
  converterManualOverrides = [];
  converterLastScannedPages = [];
  converterLastOcrPages = [];
  converterPreviewFocusPage = null;
  converterSkippedReplacements = [];
  converterActiveReplacementKey = "";

  const selected = document.getElementById("selectedConverterPdf");
  if (selected) {
    selected.textContent = `Selected PDF: ${file.name}`;
  }

  resetConverterPreview();
  updateConverterStatus();
}

function setConverterExcelFile(file) {
  setConverterExcelFiles(file ? [file] : []);
}

function setConverterExcelFiles(files) {
  const incomingFiles = Array.from(files || []).filter(file => {
    const name = file.name.toLowerCase();
    return name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
  });

  if (!incomingFiles.length) {
    alert("Please drop or choose one or more Excel or CSV files in the Excel box.");
    return;
  }

  const validFiles = mergeConverterExcelFiles(converterExcelFiles, incomingFiles);
  converterExcelFiles = validFiles;
  converterExcelFile = validFiles[0];
  converterMap = [];
  converterMatches = [];
  converterChangedPages = [];
  converterReplacementDetails = [];
  converterBuildCache = null;
  converterScanPromise = null;
  converterBuildPromise = null;
  converterRenderedPreviewKey = "";
  converterManualOverrides = [];
  converterLastScannedPages = [];
  converterLastOcrPages = [];
  converterPreviewFocusPage = null;
  converterSkippedReplacements = [];
  converterActiveReplacementKey = "";

  const selected = document.getElementById("selectedConverterExcel");
  if (selected) {
    selected.innerHTML = `
      <span class="selected-excel-summary">
        ${validFiles.length === 1 ? "1 Excel file selected" : `${validFiles.length} Excel files selected`}
      </span>
      <span class="selected-excel-list">
        ${validFiles.map((file, index) => `
          <span class="selected-excel-chip">
            <span>${index + 1}</span>
            ${escapeConverterHTML(file.name)}
          </span>
        `).join("")}
      </span>
    `;
  }

  resetConverterPreview();
  updateConverterStatus();

  const excelInput = document.getElementById("converterExcelUpload");
  if (excelInput) excelInput.value = "";
}

function mergeConverterExcelFiles(existingFiles, incomingFiles) {
  const filesByKey = new Map();
  [...existingFiles, ...incomingFiles].forEach(file => {
    filesByKey.set(getConverterExcelFileKey(file), file);
  });
  return Array.from(filesByKey.values());
}

function getConverterExcelFileKey(file) {
  return [
    file.name,
    file.size,
    file.lastModified || 0
  ].join("|");
}
function updateConverterStatus(message = "") {
  const status = document.getElementById("converterStatus");
  if (!status) return;

  if (message) {
    status.textContent = message;
    return;
  }

  const pdfText = converterPdfFile
    ? `PDF: ${converterPdfFile.name}`
    : "No PDF selected";

  const excelText = converterExcelFiles.length
    ? `Excel: ${converterExcelFiles.length === 1 ? converterExcelFiles[0].name : `${converterExcelFiles.length} files`}`
    : "No Excel selected";

  const foundCount = converterMatches.filter(match => (match.foundPages || []).length || (match.ocrFoundPages || []).length).length;
  const changeCount = converterMatches.length;
  const pageCount = converterChangedPages.length;
  const changeText = changeCount > 0
    ? `Changes: ${foundCount}/${changeCount} found on ${pageCount} page(s)`
    : "Changes: 0";

  status.textContent = `${pdfText} | ${excelText} | ${changeText}`;
}

function runConverterTask(task, failureMessage) {
  return Promise.resolve()
    .then(task)
    .catch(error => {
      console.error(failureMessage, error);
      updateConverterStatus(
        `${failureMessage} ${error?.message || "Please try again."}`
      );
    });
}

async function readExcelConverterMap() {
  if (!converterExcelFiles.length && converterExcelFile) {
    converterExcelFiles = [converterExcelFile];
  }

  if (!converterExcelFiles.length) {
    alert("Upload an Excel file first.");
    return [];
  }

  const combinedMap = [];

  for (const file of converterExcelFiles) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: ""
      });

      rows.forEach(row => {
        const oldPart = getExcelRowValue(row, [
          "Old/Obsolete Part Number",
          "Old/Obsolete Part #",
          "Old/Obsolete Part#",
          "Old Obsolete Part Number",
          "Old Obsolete Part #",
          "Old / Obsolete Part Number",
          "Old / Obsolete Part #",
          "Old/Obsolete PN",
          "Old/Obsolete PN #",
          "Obsolete Part Number",
          "Obsolete Part #",
          "Obsolete Part#",
          "Obsolete PN",
          "Obsolete PN #",
          "Obsolete Item Number",
          "Old Part #",
          "Old Part#",
          "Old Part Number",
          "Old Part",
          "Old PN",
          "Old PN #"
        ]);

        const itemCode = getExcelRowValue(row, [
          "New Part Number",
          "New Part #",
          "New Part#",
          "New Part",
          "New PN",
          "New PN #",
          "New Item Number",
          "Item Code",
          "ItemCode",
          "Item #",
          "Item Number",
          "Part #",
          "Part Number"
        ]);

        if (oldPart && itemCode && oldPart !== itemCode) {
          combinedMap.push({
            oldPart,
            itemCode,
            sourceFile: file.name,
            sourceSheet: sheetName
          });
        }
      });
    });
  }

  const seen = new Set();
  converterMap = combinedMap.filter(item => {
    const key = `${item.oldPart}=>${item.itemCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return converterMap;
}

function getExcelRowValue(row, aliases) {
  const normalizedAliases = aliases.map(normalizeExcelHeader);
  const matchKey = Object.keys(row).find(key => normalizedAliases.includes(normalizeExcelHeader(key)));
  return matchKey ? String(row[matchKey] || "").trim() : "";
}

function normalizeExcelHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[#/\\]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
async function extractPDFTextByPage(file) {
  const bytes = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: bytes.slice(0)
  }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const textItems = textContent.items.map(item => ({
      text: item.str,
      transform: item.transform,
      width: item.width,
      height: item.height
    }));

    pages.push({
      pageNumber,
      text: textItems.map(item => item.text).join(" "),
      textItems
    });
  }

  return pages;
}

async function extractDrawingPageOCRText(file, textPages) {
  const hasOCR = await ensureTesseractLoaded();
  if (!hasOCR) {
    updateConverterStatus(
      "Drawing-page OCR could not load, so only selectable PDF text was scanned."
    );
    return [];
  }

  const drawingCandidates = textPages
    .filter(isDrawingLikeTextPage)
    .slice(0, 8);
  if (!drawingCandidates.length) return [];

  updateConverterStatus(
    `Scanning up to ${drawingCandidates.length} drawing-like page(s) with OCR...`
  );

  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: bytes.slice(0)
  }).promise;
  const results = [];

  for (const candidate of drawingCandidates) {
    try {
      await waitForConverterIdle();
      updateConverterStatus(
        `OCR scanning drawing page ${candidate.pageNumber}...`
      );

      const canvas = await renderPDFPageToCanvas(
        pdf,
        candidate.pageNumber,
        1.35
      );
      const ocrResult = await withTimeout(
        Tesseract.recognize(canvas, "eng"),
        25000
      );

      results.push({
        pageNumber: candidate.pageNumber,
        text: normalizeOCRText(ocrResult.data?.text || "")
      });
    } catch (error) {
      console.warn(`Could not OCR page ${candidate.pageNumber}:`, error);
    }
  }

  return results;
}

function waitForConverterIdle() {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

async function renderPDFPageToCanvas(pdf, pageNumber, scale) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  return canvas;
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    })
  ]);
}

async function ensureTesseractLoaded() {
  if (window.Tesseract) return true;

  const sources = [
    "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
    "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js"
  ];

  for (const source of sources) {
    const loaded = await loadConverterScript(source, () => !!window.Tesseract);
    if (loaded) return true;
  }

  return false;
}

function loadConverterScript(source, isReady) {
  return new Promise(resolve => {
    if (isReady()) {
      resolve(true);
      return;
    }

    const existing = Array.from(document.scripts).find(
      script => script.src === source
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(isReady()), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      setTimeout(() => resolve(isReady()), 3000);
      return;
    }

    const script = document.createElement("script");
    script.src = source;
    script.onload = () => resolve(isReady());
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function isDrawingLikeTextPage(page) {
  const text = String(page.text || "").trim();

  return text.length < 80 || page.textItems.length < 6;
}

function normalizeOCRText(text) {
  return String(text || "")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function getManualConverterValue(oldPart) {
  return converterManualOverrides.find(item => item.oldPart === oldPart)?.itemCode || "";
}

function getEffectiveConverterMap(baseMap = converterMap) {
  return baseMap.map(item => {
    const manualValue = getManualConverterValue(item.oldPart);
    return manualValue ? { ...item, itemCode: manualValue } : item;
  });
}

function updateConverterManualPart(oldPart, value) {
  const itemCode = String(value || "").trim();
  converterManualOverrides = converterManualOverrides.filter(item => item.oldPart !== oldPart);
  if (itemCode) converterManualOverrides.push({ oldPart, itemCode });

  converterBuildCache = null;
  converterBuildPromise = null;
  converterRenderedPreviewKey = "";
  converterMatches = buildConverterMatches(
    getEffectiveConverterMap(),
    converterMatches.length ? converterLastScannedPages : [],
    converterMatches.length ? converterLastOcrPages : []
  );
  renderConverterPreview();
  renderConverterAfterEditPanel();
  refreshOpenConverterAfterPreview().catch(error => {
    console.error("After preview refresh failed:", error);
  });
  updateConverterStatus("Manual new part number saved. Build and preview will use the edited value.");
}


function getConverterChangeDetails(match) {
  const details = [];
  (match.foundPageCounts || []).forEach(page => {
    details.push(`Page ${page.pageNumber}: ${page.count} PDF text mention(s)`);
  });
  (match.ocrFoundPageCounts || [])
    .filter(page => !(match.foundPages || []).includes(page.pageNumber))
    .forEach(page => {
      details.push(`Page ${page.pageNumber}: drawing OCR review`);
    });
  return details;
}

function getConverterPageText(match) {
  const pages = Array.from(new Set([
    ...(match.foundPages || []),
    ...(match.ocrFoundPages || [])
  ])).sort((a, b) => a - b);
  return pages.length ? pages.join(", ") : "Not detected";
}

function renderConverterAfterEditPanel() {
  const panel = document.getElementById("converterAfterEditPanel");
  if (!panel) return;
  const foundMatches = converterMatches.filter(match => (match.foundPages || []).length || (match.ocrFoundPages || []).length);
  if (!foundMatches.length) {
    panel.innerHTML = `<p class="converter-muted">Preview changes first to edit new part numbers here.</p>`;
    return;
  }
  panel.innerHTML = `
    <div class="converter-after-edit-header">Manual New Part # Edits</div>
    <div class="converter-after-edit-list">
      ${foundMatches.map(match => {
        const value = getManualConverterValue(match.oldPart) || match.itemCode;
        return `
          <label class="converter-after-edit-row">
            <span>${escapeConverterHTML(match.oldPart)}</span>
            <input
              value="${escapeConverterHTML(value)}"
              onchange="updateConverterManualPart('${escapeConverterHTML(match.oldPart)}', this.value)"
            />
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function previewPartNumberChanges() {
  return runConverterTask(
    previewPartNumberChangesImpl,
    "Preview changes failed."
  );
}

async function previewPartNumberChangesImpl() {
  if (converterScanPromise) return converterScanPromise;

  converterScanPromise = previewPartNumberChangesScan();

  try {
    return await converterScanPromise;
  } finally {
    converterScanPromise = null;
  }
}

async function previewPartNumberChangesScan() {
  if (!converterPdfFile) {
    alert("Upload a PDF first.");
    return;
  }

  if (!converterExcelFiles.length && !converterExcelFile) {
    alert("Upload an Excel file first.");
    return;
  }

  updateConverterStatus("Reading Excel and scanning PDF...");

  const map = await readExcelConverterMap();

  if (!map.length) {
    updateConverterStatus("No Old Part # / Item Code or New Part # rows found in the Excel file.");
    alert("No valid rows found. Make sure the Excel columns include Old Part # / Item Code, or Old/Obsolete Part Number / New Part Number.");
    return;
  }

  const pages = await extractPDFTextByPage(converterPdfFile);
  converterBuildCache = null;
  converterLastScannedPages = pages;
  converterLastOcrPages = [];
  converterMatches = buildConverterMatches(getEffectiveConverterMap(map), pages);
  renderConverterPreview();

  let ocrPages = [];

  try {
    ocrPages = await extractDrawingPageOCRText(converterPdfFile, pages);
  } catch (error) {
    console.warn("Drawing-page OCR scan failed:", error);
    updateConverterStatus(
      "PDF text preview is ready. Drawing-page OCR stopped before it finished."
    );
  }

  if (ocrPages.length) {
    converterLastOcrPages = ocrPages;
    converterMatches = buildConverterMatches(getEffectiveConverterMap(map), pages, ocrPages);
    renderConverterPreview();
  }

  const foundCount = converterMatches.filter(item =>
    item.foundPages.length || item.ocrFoundPages.length
  ).length;
  const ocrFoundCount = converterMatches.filter(item =>
    item.ocrFoundPages.length
  ).length;
  const ocrText = ocrFoundCount
    ? ` ${ocrFoundCount} part number(s) also appeared on drawing/OCR page(s).`
    : "";
  updateConverterStatus(`Preview complete. Found ${foundCount} matching part number(s).${ocrText}`);

  if (getDetectedChangeRows().some(row => !row.locationText.includes("drawing OCR"))) {
    updateConverterStatus("Confirming visible replacements...");
    await buildConvertedPDFBytes(false);
    renderConverterPreview();
    updateConverterStatus(
      converterReplacementDetails.length
        ? `Preview complete. Confirmed ${converterReplacementDetails.length} visible replacement(s).`
        : "Preview complete. No visible replacement areas were confirmed."
    );
  }
}

function warmConverterBuildCache() {
  if (converterBuildCache || converterBuildPromise) return;

  converterBuildPromise = buildConvertedPDFBytes(false)
    .catch(error => {
      console.warn("Could not prebuild converted PDF preview:", error);
      return null;
    })
    .finally(() => {
      converterBuildPromise = null;
    });
}

function buildConverterMatches(map, pages, ocrPages = []) {
  return map.map(item => {
    const foundPageCounts = pages
      .map(page => ({
        pageNumber: page.pageNumber,
        count: countTextOccurrences(page.text, item.oldPart)
      }))
      .filter(page => page.count > 0);
    const foundPages = foundPageCounts.map(page => page.pageNumber);
    const ocrFoundPageCounts = ocrPages
      .map(page => ({
        pageNumber: page.pageNumber,
        count: countTextOccurrences(page.text, item.oldPart)
      }))
      .filter(page => page.count > 0);
    const ocrFoundPages = ocrFoundPageCounts
      .map(page => page.pageNumber)
      .filter(pageNumber => !foundPages.includes(pageNumber));

    return {
      ...item,
      foundPages,
      foundPageCounts,
      foundCount: foundPageCounts.reduce((sum, page) => sum + page.count, 0),
      ocrFoundPages,
      ocrFoundPageCounts
    };
  });
}

function getConverterPageRows() {
  const pageNumbers = converterLastScannedPages.length
    ? converterLastScannedPages.map(page => page.pageNumber)
    : Array.from(new Set(getDetectedChangeRows().map(row => row.pageNumber))).sort((a, b) => a - b);

  return pageNumbers.map(pageNumber => {
    const changes = [];

    converterMatches.forEach(match => {
      const pdfPage = (match.foundPageCounts || []).find(page => page.pageNumber === pageNumber);
      if (pdfPage) {
        const visibleCount = getVisibleConverterReplacementCount(pageNumber, match.oldPart);
        if (!hasVisibleReplacementFilter() || visibleCount > 0) {
          changes.push({
            pageNumber,
            oldPart: match.oldPart,
            itemCode: getManualConverterValue(match.oldPart) || match.itemCode,
            count: visibleCount || pdfPage.count,
            source: "PDF text",
            locationText: `${visibleCount || pdfPage.count} visible PDF text mention(s)`
          });
        }
      }

      const hasPdfMatch = Boolean(pdfPage);
      const ocrPage = (match.ocrFoundPageCounts || []).find(page => page.pageNumber === pageNumber);
      if (ocrPage && !hasPdfMatch) {
        changes.push({
          pageNumber,
          oldPart: match.oldPart,
          itemCode: getManualConverterValue(match.oldPart) || match.itemCode,
          count: ocrPage.count,
          source: "Drawing OCR",
          locationText: "drawing OCR review"
        });
      }
    });

    return { pageNumber, changes };
  });
}

function hasVisibleReplacementFilter() {
  return Boolean(converterBuildCache || converterReplacementDetails.length);
}

function getVisibleConverterReplacementCount(pageNumber, oldPart) {
  return converterReplacementDetails.filter(detail =>
    detail.pageNumber === pageNumber &&
    detail.oldPart === oldPart &&
    !isConverterReplacementSkipped(detail)
  ).length;
}

function getConverterReplacementKey(detail) {
  return [
    detail.pageNumber,
    detail.oldPart,
    detail.itemCode,
    Math.round(Number(detail.rectX || 0) * 10) / 10,
    Math.round(Number(detail.rectY || 0) * 10) / 10,
    Math.round(Number(detail.rectWidth || 0) * 10) / 10,
    Math.round(Number(detail.rectHeight || 0) * 10) / 10,
    Math.round(Number(detail.angle || 0))
  ].join("|");
}

function isConverterReplacementSkipped(detail) {
  const key = getConverterReplacementKey(detail);
  return converterSkippedReplacements.some(item => item.key === key);
}

function encodeConverterReplacementDetail(detail) {
  return encodeURIComponent(JSON.stringify({
    key: getConverterReplacementKey(detail),
    pageNumber: detail.pageNumber,
    oldPart: detail.oldPart,
    itemCode: detail.itemCode,
    rectX: detail.rectX,
    rectY: detail.rectY,
    rectWidth: detail.rectWidth,
    rectHeight: detail.rectHeight,
    angle: detail.angle || 0
  }));
}

function decodeConverterReplacementDetail(encodedDetail) {
  try {
    return JSON.parse(decodeURIComponent(encodedDetail));
  } catch (error) {
    console.warn("Could not read converter replacement detail:", error);
    return null;
  }
}

function skipConverterReplacement(encodedDetail) {
  const detail = decodeConverterReplacementDetail(encodedDetail);
  if (!detail) return;

  const key = detail.key || getConverterReplacementKey(detail);
  if (!converterSkippedReplacements.some(item => item.key === key)) {
    converterSkippedReplacements.push({ ...detail, key });
  }

  converterActiveReplacementKey = "";
  applyConverterSkipStateImmediately();
  rebuildConverterAfterSkipChange("Change canceled. It will not be included in the build.");
}

function restoreConverterReplacement(encodedDetail) {
  const detail = decodeConverterReplacementDetail(encodedDetail);
  if (!detail) return;

  const key = detail.key || getConverterReplacementKey(detail);
  converterSkippedReplacements = converterSkippedReplacements.filter(item => item.key !== key);

  converterActiveReplacementKey = key;
  rebuildConverterAfterSkipChange("Change restored. It will be included again.");
}

function toggleConverterReplacementSkip(encodedDetail) {
  const detail = decodeConverterReplacementDetail(encodedDetail);
  if (!detail) return;

  const key = detail.key || getConverterReplacementKey(detail);
  const isSkipped = converterSkippedReplacements.some(item => item.key === key);
  if (isSkipped) {
    restoreConverterReplacement(encodedDetail);
  } else {
    skipConverterReplacement(encodedDetail);
  }
}

function rebuildConverterAfterSkipChange(message) {
  converterBuildCache = null;
  converterBuildPromise = null;
  converterRenderedPreviewKey = "";

  buildConvertedPDFBytes(false)
    .then(() => {
      renderConverterPreview();
      renderConverterPreviewJumpList(converterReplacementDetails);
      return refreshOpenConverterAfterPreview();
    })
    .then(() => updateConverterStatus(message))
    .catch(error => {
      console.error("Could not update skipped converter change:", error);
      updateConverterStatus("Could not update that skipped change. Please try again.");
    });
}

function applyConverterSkipStateImmediately() {
  document.querySelectorAll(".converter-preview-highlight").forEach(marker => {
    if (converterSkippedReplacements.some(item => item.key === marker.dataset.replacementKey)) {
      marker.classList.add("canceled");
    }
    marker.classList.remove("focused");
  });
  renderConverterPreviewJumpList(converterReplacementDetails);
  renderConverterPreview();
}

function renderConverterPreview() {
  const tbody = document.getElementById("converterPreviewBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const pageRows = getConverterPageRows();
  const changedPageCount = pageRows.filter(row => row.changes.length).length;
  updateDetectedChangeCount(changedPageCount);

  if (!pageRows.length) {
    resetConverterPreview();
    renderConverterAfterEditPanel();
    return;
  }

  pageRows.forEach(pageRow => {
    const row = document.createElement("tr");

    if (!pageRow.changes.length) {
      row.innerHTML = `
        <td>${pageRow.pageNumber}</td>
        <td><span class="converter-muted">No old part # found</span></td>
        <td><span class="converter-muted">No change</span></td>
        <td><span class="converter-muted">No detected changes</span></td>
      `;
      tbody.appendChild(row);
      return;
    }

    const detailId = `converter-page-details-${pageRow.pageNumber}`;
    const oldSummary = pageRow.changes.map(change => change.oldPart).join(", ");
    const newSummary = pageRow.changes.map(change => change.itemCode).join(", ");

    row.className = "converter-page-change-row";
    row.innerHTML = `
      <td>
        <button class="converter-page-jump-btn" type="button" onclick="openConverterPdfPreview(${pageRow.pageNumber})">
          ${pageRow.pageNumber}
        </button>
      </td>
      <td>${escapeConverterHTML(oldSummary)}</td>
      <td>${escapeConverterHTML(newSummary)}</td>
      <td>
        <button class="converter-row-toggle" type="button" onclick="toggleConverterPageDetails('${detailId}', this)">
          <span>${pageRow.changes.length} change${pageRow.changes.length === 1 ? "" : "s"}</span>
          <span class="converter-row-toggle-arrow" aria-hidden="true"></span>
        </button>
      </td>
    `;
    tbody.appendChild(row);

    const detailRow = document.createElement("tr");
    detailRow.id = detailId;
    detailRow.className = "converter-page-detail-row hidden";
    detailRow.innerHTML = `
      <td colspan="4">
        <div class="converter-page-change-list">
          <div class="converter-page-change-heading">
            <span>Old Part #</span>
            <span>New Part #</span>
            <span>Detected Change</span>
          </div>
          ${pageRow.changes.map(change => `
            <label class="converter-page-change-edit">
              <span>${escapeConverterHTML(change.oldPart)}</span>
              <input
                class="converter-part-edit-input"
                value="${escapeConverterHTML(change.itemCode)}"
                onchange="updateConverterManualPart('${escapeConverterHTML(change.oldPart)}', this.value)"
              />
              <button
                class="converter-change-preview-btn"
                type="button"
                onclick="openConverterPdfPreview(${change.pageNumber}, decodeURIComponent('${encodeURIComponent(change.oldPart)}'))"
              >
                ${escapeConverterHTML(change.locationText)}
              </button>
            </label>
          `).join("")}
        </div>
      </td>
    `;
    tbody.appendChild(detailRow);
  });

  renderConverterAfterEditPanel();
}

function toggleConverterPageDetails(detailId, button) {
  const detail = document.getElementById(detailId);
  if (!detail) return;
  const isOpen = detail.classList.toggle("hidden") === false;
  button?.classList.toggle("open", isOpen);
}

function getDetectedChangeRows() {
  const rows = [];

  converterMatches.forEach(match => {
    (match.foundPageCounts || []).forEach(page => {
      rows.push({
        pageNumber: page.pageNumber,
        oldPart: match.oldPart,
        itemCode: match.itemCode,
        locationText: `Page ${page.pageNumber} - ${page.count} PDF text mention(s)`
      });
    });

    (match.ocrFoundPageCounts || [])
      .filter(page => !(match.foundPages || []).includes(page.pageNumber))
      .forEach(page => {
        rows.push({
          pageNumber: page.pageNumber,
          oldPart: match.oldPart,
          itemCode: match.itemCode,
          locationText: `Page ${page.pageNumber} - drawing OCR review`
        });
      });
  });

  return rows.sort((a, b) =>
    a.pageNumber - b.pageNumber ||
    a.oldPart.localeCompare(b.oldPart)
  );
}

function getConverterFoundText(match) {
  const textParts = [];

  if (match.foundPages.length) {
    textParts.push(
      `PDF text: ${match.foundCount} mention(s) on page(s) ${match.foundPages.join(", ")}`
    );
  }

  if (match.ocrFoundPages?.length) {
    textParts.push(
      `Drawing OCR: page(s) ${match.ocrFoundPages.join(", ")} - review manually`
    );
  }

  return textParts.length ? textParts.join(" | ") : "No";
}

function generateConvertedPDF() {
  return runConverterTask(
    generateConvertedPDFImpl,
    "Converted PDF could not be generated."
  );
}

async function generateConvertedPDFImpl() {
  const result = await buildConvertedPDFBytes(true);
  if (!result) return;

  const outputName = converterPdfFile.name.replace(
    /\.pdf$/i,
    " - Converted.pdf"
  );

  downloadConverterFile(result.bytes, outputName, "application/pdf");
}

async function buildConvertedPDFBytes(showFinalStatus = false) {
  if (converterBuildPromise && !showFinalStatus) {
    return converterBuildPromise;
  }

  if (!converterPdfFile) {
    alert("Upload a PDF first.");
    return null;
  }

  if (!converterExcelFiles.length && !converterExcelFile) {
    alert("Upload an Excel file first.");
    return null;
  }

  updateConverterStatus("Generating converted PDF...");

  const baseMap = converterMap.length
    ? converterMap
    : await readExcelConverterMap();
  const map = getEffectiveConverterMap(baseMap);

  if (!map.length) {
    alert("No valid Old Part # / Item Code or New Part # rows were found.");
    updateConverterStatus("Could not generate PDF because no valid Excel rows were found.");
    return null;
  }

  if (converterBuildCache) {
    if (showFinalStatus) {
      const pageText = converterBuildCache.changedPages.length
        ? ` on page(s) ${converterBuildCache.changedPages.join(", ")}`
        : "";
      updateConverterStatus(
        getConverterVerificationStatus(
          converterBuildCache.replacementDetails.length,
          pageText,
          converterBuildCache.verification
        )
      );
    }

    return converterBuildCache;
  }

  if (converterBuildPromise) {
    const pendingResult = await converterBuildPromise;
    if (pendingResult) {
      if (showFinalStatus) {
        const pageText = pendingResult.changedPages.length
          ? ` on page(s) ${pendingResult.changedPages.join(", ")}`
          : "";
        updateConverterStatus(
          getConverterVerificationStatus(
            pendingResult.replacementDetails.length,
            pageText,
            pendingResult.verification
          )
        );
      }

      return pendingResult;
    }
  }

  if (!showFinalStatus) {
    converterBuildPromise = buildConvertedPDFBytesImpl(showFinalStatus)
      .finally(() => {
        converterBuildPromise = null;
      });
    return converterBuildPromise;
  }

  return buildConvertedPDFBytesImpl(showFinalStatus);
}

async function buildConvertedPDFBytesImpl(showFinalStatus = false) {
  const baseMap = converterMap.length
    ? converterMap
    : await readExcelConverterMap();
  const map = getEffectiveConverterMap(baseMap);

  const originalBytes = await converterPdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(originalBytes);
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
  };

  const pdfForText = await pdfjsLib.getDocument({
    data: originalBytes.slice(0)
  }).promise;

  let replacementCount = 0;
  const changedPages = new Set();
  const replacementDetails = [];
  const backgroundSamplers = new Map();
  const expectedReplacementCounts = new Map(
    map.map(item => [item.oldPart, 0])
  );

  for (let pageIndex = 0; pageIndex < pdfDoc.getPageCount(); pageIndex++) {
    const pdfLibPage = pdfDoc.getPage(pageIndex);
    const page = await pdfForText.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();
    const pageSize = pdfLibPage.getSize();

    for (const textItem of textContent.items) {
      const text = textItem.str;
      if (!text) continue;

      const replacements = getTextItemReplacements(text, map);
      if (!replacements.length) continue;

      const replacementFont = getReplacementFont(textItem, fonts);

      for (const replacement of replacements) {
        for (const match of replacement.matches) {
          const placement = getTextItemReplacementPlacement(
            textItem,
            text,
            match,
            replacement.itemCode,
            replacementFont
          );
          const isVisible = await isVisibleTextReplacement(
            page,
            pageIndex,
            placement,
            pageSize,
            backgroundSamplers
          );
          if (!isVisible) continue;

          const replacementDetail = {
            pageNumber: pageIndex + 1,
            oldPart: replacement.oldPart,
            itemCode: replacement.itemCode,
            rectX: placement.rectX,
            rectY: placement.rectY,
            rectWidth: placement.rectWidth,
            rectHeight: placement.rectHeight,
            angle: placement.angle
          };
          if (isConverterReplacementSkipped(replacementDetail)) continue;

          const backgroundColor = await getTextItemBackgroundColor(
            page,
            pageIndex,
            placement,
            pageSize,
            backgroundSamplers
          );
          const rotate = degrees(placement.angle);

          pdfLibPage.drawRectangle({
            x: placement.rectX,
            y: placement.rectY,
            width: placement.rectWidth,
            height: placement.rectHeight,
            rotate,
            color: backgroundColor
          });

          pdfLibPage.drawText(replacement.itemCode, {
            x: placement.textX,
            y: placement.textY,
            size: placement.fontSize,
            font: replacementFont,
            rotate,
            color: rgb(0, 0, 0)
          });

          replacementCount++;
          expectedReplacementCounts.set(
            replacement.oldPart,
            (expectedReplacementCounts.get(replacement.oldPart) || 0) + 1
          );
          changedPages.add(pageIndex + 1);
          replacementDetails.push(replacementDetail);
        }
      }
    }
  }

  let convertedBytes = await pdfDoc.save();
  converterChangedPages = Array.from(changedPages).sort((a, b) => a - b);
  converterReplacementDetails = replacementDetails;
  const overlayVerification = await verifyConvertedPDF(
    convertedBytes,
    map,
    expectedReplacementCounts
  );
  convertedBytes = await flattenChangedPDFPages(
    convertedBytes,
    converterChangedPages
  );
  const finalVerification = await verifyNoSelectableOldParts(
    convertedBytes,
    map
  );
  const verification = {
    ...overlayVerification,
    ...finalVerification,
    flattenedPages: converterChangedPages
  };

  if (showFinalStatus) {
    const pageText = converterChangedPages.length
      ? ` on page(s) ${converterChangedPages.join(", ")}`
      : "";
    updateConverterStatus(
      getConverterVerificationStatus(replacementCount, pageText, verification)
    );
  }

  converterBuildCache = {
    bytes: convertedBytes,
    changedPages: converterChangedPages,
    replacementDetails,
    verification
  };

  return converterBuildCache;
}

function getTextItemReplacements(text, map) {
  return map
    .filter(item => text.includes(item.oldPart))
    .map(item => ({
      ...item,
      matches: findExactMatchesInTextItem(text, item.oldPart)
    }))
    .filter(item => item.matches.length > 0);
}

function getReplacementFont(textItem, fonts) {
  const fontName = String(textItem.fontName || "").toLowerCase();

  if (fontName.includes("bold") && fontName.includes("italic")) {
    return fonts.boldItalic;
  }

  if (fontName.includes("bold")) return fonts.bold;
  if (fontName.includes("italic") || fontName.includes("oblique")) {
    return fonts.italic;
  }

  return fonts.regular;
}

function getTextItemReplacementPlacement(textItem, originalText, match, replacementText, font) {
  const transform = textItem.transform || [1, 0, 0, 8, 0, 0];
  const [a = 1, b = 0, c = 0, d = 8] = transform;
  const baseX = transform[4] || 0;
  const baseY = transform[5] || 0;
  const fontSize = Math.max(
    6,
    Math.hypot(c, d) || Math.hypot(a, b) || textItem.height || 8
  );
  const pdfTextWidth = textItem.width || 0;
  const measuredFullWidth = font.widthOfTextAtSize(originalText, fontSize);
  const widthScale = measuredFullWidth
    ? Math.max((pdfTextWidth || measuredFullWidth) / measuredFullWidth, 0.9)
    : 1;
  const prefixText = originalText.slice(0, match.startIndex);
  const oldText = originalText.slice(match.startIndex, match.endIndex);
  const prefixWidth = font.widthOfTextAtSize(prefixText, fontSize) * widthScale;
  const oldTextWidth = Math.max(
    font.widthOfTextAtSize(oldText, fontSize) * widthScale,
    oldText.length * fontSize * 0.52,
    4
  );
  const angle = Math.atan2(b, a) * 180 / Math.PI;
  const textVectorLength = Math.hypot(a, b) || 1;
  const dirX = a / textVectorLength;
  const dirY = b / textVectorLength;
  const normalX = -dirY;
  const normalY = dirX;
  const matchBaseX = baseX + dirX * prefixWidth;
  const matchBaseY = baseY + dirY * prefixWidth;
  const coverPaddingStart = 3.5;
  const coverPaddingEnd = 8;
  const coverWidth = oldTextWidth + coverPaddingStart + coverPaddingEnd;
  const replacementWidthAtOriginalSize = font.widthOfTextAtSize(replacementText, fontSize);
  let replacementFontSize = Math.min(
    fontSize * 0.94,
    replacementWidthAtOriginalSize
      ? fontSize * ((oldTextWidth + 2) / replacementWidthAtOriginalSize)
      : fontSize * 0.94
  );
  replacementFontSize = Math.max(Math.min(6, fontSize * 0.82), replacementFontSize);
  let replacementTextWidth = font.widthOfTextAtSize(
    replacementText,
    replacementFontSize
  );

  while (replacementTextWidth > coverWidth && replacementFontSize > 5) {
    replacementFontSize -= 0.25;
    replacementTextWidth = font.widthOfTextAtSize(
      replacementText,
      replacementFontSize
    );
  }

  const textInset = Math.max(0.8, fontSize * 0.08);
  const baselineLift = (fontSize - replacementFontSize) * 0.18;
  const rectNormalPadding = fontSize * 0.24;
  const rectHeight = fontSize * 1.12;

  return {
    angle,
    fontSize: replacementFontSize,
    textX: matchBaseX + dirX * textInset + normalX * baselineLift,
    textY: matchBaseY + dirY * textInset + normalY * baselineLift,
    rectX: matchBaseX - dirX * coverPaddingStart - normalX * rectNormalPadding,
    rectY: matchBaseY - dirY * coverPaddingStart - normalY * rectNormalPadding,
    rectWidth: Math.max(coverWidth, replacementTextWidth + coverPaddingStart + coverPaddingEnd),
    rectHeight
  };
}

async function getTextItemBackgroundColor(
  page,
  pageIndex,
  placement,
  pageSize,
  backgroundSamplers
) {
  const sampler = await getPageBackgroundSampler(page, pageIndex, backgroundSamplers);
  if (!sampler) return rgb(1, 1, 1);

  const points = getRotatedPlacementCorners(placement);
  const colors = points
    .map(point => sampler.sample(point.x, pageSize.height - point.y))
    .filter(Boolean);

  if (!colors.length) return rgb(1, 1, 1);

  const average = colors.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b
    }),
    { r: 0, g: 0, b: 0 }
  );

  return rgb(
    average.r / colors.length / 255,
    average.g / colors.length / 255,
    average.b / colors.length / 255
  );
}

function getRotatedPlacementCorners(placement) {
  const angle = Number(placement.angle || 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const normalX = -sin;
  const normalY = cos;
  const start = { x: placement.rectX, y: placement.rectY };
  const end = {
    x: start.x + cos * placement.rectWidth,
    y: start.y + sin * placement.rectWidth
  };

  return [
    start,
    end,
    {
      x: end.x + normalX * placement.rectHeight,
      y: end.y + normalY * placement.rectHeight
    },
    {
      x: start.x + normalX * placement.rectHeight,
      y: start.y + normalY * placement.rectHeight
    }
  ];
}

async function isVisibleTextReplacement(
  page,
  pageIndex,
  placement,
  pageSize,
  backgroundSamplers
) {
  const sampler = await getPageBackgroundSampler(page, pageIndex, backgroundSamplers);
  if (!sampler?.inkRatio) return true;

  const corners = getRotatedPlacementCorners(placement)
    .map(point => ({
      x: point.x,
      y: pageSize.height - point.y
    }));
  const minX = Math.min(...corners.map(point => point.x));
  const maxX = Math.max(...corners.map(point => point.x));
  const minY = Math.min(...corners.map(point => point.y));
  const maxY = Math.max(...corners.map(point => point.y));
  const ratio = sampler.inkRatio({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  });

  return ratio >= 0.025;
}

async function getPageBackgroundSampler(page, pageIndex, backgroundSamplers) {
  if (backgroundSamplers.has(pageIndex)) {
    return backgroundSamplers.get(pageIndex);
  }

  try {
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });

    await page.render({ canvasContext: context, viewport }).promise;

    const sampler = {
      sample(x, y) {
        const pixelX = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
        const pixelY = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
        const [r, g, b] = context.getImageData(pixelX, pixelY, 1, 1).data;
        return { r, g, b };
      },
      inkRatio(rect) {
        const x = Math.max(0, Math.floor(rect.x - 1));
        const y = Math.max(0, Math.floor(rect.y - 1));
        const width = Math.max(1, Math.min(canvas.width - x, Math.ceil(rect.width + 2)));
        const height = Math.max(1, Math.min(canvas.height - y, Math.ceil(rect.height + 2)));
        const image = context.getImageData(x, y, width, height).data;
        let inkPixels = 0;
        const totalPixels = width * height;

        for (let index = 0; index < image.length; index += 4) {
          const r = image[index];
          const g = image[index + 1];
          const b = image[index + 2];
          const alpha = image[index + 3];
          const brightness = (r + g + b) / 3;
          const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);

          if (alpha > 20 && (brightness < 245 || colorSpread > 18)) {
            inkPixels++;
          }
        }

        return inkPixels / totalPixels;
      }
    };

    backgroundSamplers.set(pageIndex, sampler);
    return sampler;
  } catch (error) {
    console.warn("Could not sample PDF background color:", error);
    backgroundSamplers.set(pageIndex, null);
    return null;
  }
}

async function verifyConvertedPDF(convertedBytes, map, expectedReplacementCounts) {
  const pdf = await pdfjsLib.getDocument({
    data: convertedBytes.slice(0)
  }).promise;
  const expectedCounts = Array.from(expectedReplacementCounts.entries()).map(
    ([oldPart, count]) => ({ oldPart, count })
  );
  const missingNewParts = [];
  const foundNewParts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str || "").join(" ");

    map.forEach(item => {
      const newCount = countTextOccurrences(pageText, item.itemCode);

      if (newCount > 0) {
        foundNewParts.push({
          pageNumber,
          itemCode: item.itemCode,
          count: newCount
        });
      }
    });
  }

  expectedCounts.forEach(expected => {
    if (expected.count === 0) return;

    const item = map.find(row => row.oldPart === expected.oldPart);
    const foundCount = foundNewParts
      .filter(found => found.itemCode === item.itemCode)
      .reduce((sum, found) => sum + found.count, 0);

    if (foundCount < expected.count) {
      missingNewParts.push({
        oldPart: expected.oldPart,
        itemCode: item.itemCode,
        expected: expected.count,
        found: foundCount
      });
    }
  });

  return {
    expectedCounts,
    missingNewParts,
    foundNewParts
  };
}

async function flattenChangedPDFPages(bytes, changedPageNumbers) {
  if (!changedPageNumbers.length) return bytes;

  updateConverterStatus("Flattening changed pages so old part numbers cannot be copied...");

  const changedPageSet = new Set(changedPageNumbers);
  const sourceDoc = await PDFDocument.load(bytes);
  const outputDoc = await PDFDocument.create();
  const pdfForRender = await pdfjsLib.getDocument({
    data: bytes.slice(0)
  }).promise;

  for (let pageIndex = 0; pageIndex < sourceDoc.getPageCount(); pageIndex++) {
    const pageNumber = pageIndex + 1;
    const sourcePage = sourceDoc.getPage(pageIndex);
    const { width, height } = sourcePage.getSize();

    if (!changedPageSet.has(pageNumber)) {
      const [copiedPage] = await outputDoc.copyPages(sourceDoc, [pageIndex]);
      outputDoc.addPage(copiedPage);
      continue;
    }

    const renderedPage = await pdfForRender.getPage(pageNumber);
    const viewport = renderedPage.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });

    await renderedPage.render({
      canvasContext: context,
      viewport
    }).promise;

    const imageBytes = dataURLToUint8Array(canvas.toDataURL("image/png"));
    const pageImage = await outputDoc.embedPng(imageBytes);
    const outputPage = outputDoc.addPage([width, height]);

    outputPage.drawImage(pageImage, {
      x: 0,
      y: 0,
      width,
      height
    });
  }

  return outputDoc.save();
}

function dataURLToUint8Array(dataURL) {
  const base64 = dataURL.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function verifyNoSelectableOldParts(bytes, map) {
  const pdf = await pdfjsLib.getDocument({
    data: bytes.slice(0)
  }).promise;
  const selectableOldParts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str || "").join(" ");

    map.forEach(item => {
      const oldCount = countTextOccurrences(pageText, item.oldPart);

      if (oldCount > 0) {
        selectableOldParts.push({
          pageNumber,
          oldPart: item.oldPart,
          count: oldCount
        });
      }
    });
  }

  return { selectableOldParts };
}

function countTextOccurrences(text, value) {
  if (!value) return 0;

  let count = 0;
  let startIndex = 0;

  while (true) {
    const index = text.indexOf(value, startIndex);
    if (index === -1) break;
    count++;
    startIndex = index + value.length;
  }

  return count;
}

function getConverterVerificationStatus(replacementCount, pageText, verification) {
  if (
    verification.missingNewParts.length === 0 &&
    verification.selectableOldParts.length === 0
  ) {
    return `Converted PDF downloaded. ${replacementCount} replacement(s) applied${pageText}. Verification passed: changed pages were flattened and no selectable old part numbers remain.`;
  }

  const missingNewParts = verification.missingNewParts
    .slice(0, 5)
    .map(item => `${item.oldPart} expected ${item.expected}, found ${item.found}`)
    .join("; ");
  const selectableOldParts = verification.selectableOldParts
    .slice(0, 5)
    .map(item => `${item.oldPart} on page ${item.pageNumber}`)
    .join("; ");
  const checkItems = [missingNewParts, selectableOldParts].filter(Boolean);

  return `Converted PDF downloaded. ${replacementCount} replacement(s) applied${pageText}. Check needed: ${checkItems.join("; ")}.`;
}

function findExactMatchesInTextItem(text, oldPart) {
  const matches = [];
  let startIndex = 0;

  while (true) {
    const index = text.indexOf(oldPart, startIndex);
    if (index === -1) break;

    matches.push({
      startIndex: index,
      endIndex: index + oldPart.length
    });

    startIndex = index + oldPart.length;
  }

  return matches;
}

function openConverterPdfPreview(pageNumber = null, oldPart = "") {
  converterPreviewFocusPage = pageNumber
    ? { pageNumber, oldPart: String(oldPart || "") }
    : null;

  return runConverterTask(
    openConverterPdfPreviewImpl,
    "PDF preview could not be created."
  );
}

async function openConverterPdfPreviewImpl() {
  if (!converterPdfFile) {
    alert("Upload a PDF first.");
    return;
  }

  if (!converterExcelFiles.length && !converterExcelFile) {
    alert("Upload an Excel file first.");
    return;
  }

  const modal = document.getElementById("converterPreviewModal");
  const status = document.getElementById("converterPreviewModalStatus");
  const beforeContainer = document.getElementById("converterBeforePreview");
  const afterContainer = document.getElementById("converterAfterPreview");
  const jumpList = document.getElementById("converterPreviewJumpList");

  if (modal) modal.classList.remove("hidden");
  if (status) status.textContent = "Building before and after preview...";
  if (jumpList) jumpList.innerHTML = "";

  if (!getDetectedChangeRows().length) {
    if (status) status.textContent = "Scanning for detected changes first...";
    await previewPartNumberChangesImpl();
  }

  const originalBytes = await converterPdfFile.arrayBuffer();
  if (status) {
    status.textContent = converterBuildCache
      ? "Loading cached before and after preview..."
      : "Building before and after preview...";
  }
  const result = await buildConvertedPDFBytes(false);

  if (!result) {
    if (status) status.textContent = "Preview could not be created.";
    return;
  }

  const pagesToPreview = result.changedPages.length
    ? result.changedPages
    : getPreviewPagesFromMatches();
  renderConverterPreviewJumpList(result.replacementDetails || []);
  const previewKey = getConverterPreviewKey(result, pagesToPreview);

  if (
    converterRenderedPreviewKey === previewKey &&
    beforeContainer?.childElementCount &&
    afterContainer?.childElementCount
  ) {
    if (status) {
      status.textContent = pagesToPreview.length
        ? `Preview ready. Showing cached changed page(s): ${pagesToPreview.join(", ")}.`
        : "Preview ready. No changed pages were found.";
    }
    focusConverterPreviewSelection();
    return;
  }

  if (beforeContainer) beforeContainer.innerHTML = "";
  if (afterContainer) afterContainer.innerHTML = "";

  await renderPdfPreviewBytes(originalBytes, beforeContainer, pagesToPreview, {
    highlights: result.replacementDetails || [],
    highlightType: "before"
  });
  await renderPdfPreviewBytes(result.bytes, afterContainer, pagesToPreview, {
    highlights: result.replacementDetails || [],
    highlightType: "after"
  });
  converterRenderedPreviewKey = previewKey;

  if (status) {
    status.textContent = pagesToPreview.length
      ? `Preview ready. Showing changed page(s): ${pagesToPreview.join(", ")}.`
      : "Preview ready. No changed pages were found.";
  }
  focusConverterPreviewSelection();
}

function renderConverterPreviewJumpList(details = converterReplacementDetails) {
  const list = document.getElementById("converterPreviewJumpList");
  if (!list) return;

  const activeChanges = [];
  const seen = new Set();
  details.forEach(detail => {
    const key = getConverterReplacementKey(detail);
    if (seen.has(key)) return;
    seen.add(key);
    if (converterSkippedReplacements.some(item => item.key === key)) return;
    activeChanges.push({ ...detail, key });
  });
  const skippedChanges = converterSkippedReplacements.filter(detail =>
    !activeChanges.some(active => active.key === detail.key)
  );

  if (!activeChanges.length && !skippedChanges.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = `
    <span>Jump to change</span>
    ${activeChanges.map(detail => `
      <span class="converter-jump-chip">
        <button
          type="button"
          onclick="focusConverterReplacement('${encodeConverterReplacementDetail(detail)}')"
        >
          ${getConverterJumpChipHTML(detail)}
        </button>
        <button
          class="converter-jump-cancel"
          type="button"
          title="Cancel this replacement"
          onclick="skipConverterReplacement('${encodeConverterReplacementDetail(detail)}')"
        >
          Cancel
        </button>
      </span>
    `).join("")}
    ${skippedChanges.map(detail => `
      <span class="converter-jump-chip skipped">
        <button type="button" disabled>
          ${getConverterJumpChipHTML(detail)}
        </button>
        <button
          class="converter-jump-restore"
          type="button"
          title="Restore this replacement"
          onclick="restoreConverterReplacement('${encodeConverterReplacementDetail(detail)}')"
        >
          Restore
        </button>
      </span>
    `).join("")}
  `;
}

function getConverterJumpChipHTML(detail) {
  return `
    <span class="converter-jump-page">Page ${detail.pageNumber}</span>
    <span class="converter-jump-change">
      <span>${escapeConverterHTML(detail.oldPart)}</span>
      <span>${escapeConverterHTML(detail.itemCode)}</span>
    </span>
  `;
}

function scrollConverterPreviewToChange(pageNumber, oldPart = "") {
  const pageWrap = document.querySelector(`.converter-preview-page-wrap[data-page-number="${pageNumber}"]`);
  if (!pageWrap) return;

  document.querySelectorAll(".converter-preview-highlight.focused")
    .forEach(item => item.classList.remove("focused"));

  const highlights = Array.from(pageWrap.querySelectorAll(".converter-preview-highlight"));
  const highlight = oldPart
    ? highlights.find(item => item.dataset.oldPart === oldPart)
    : highlights[0];
  highlight?.classList.add("focused");

  pageWrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

function focusConverterReplacement(encodedDetail) {
  const detail = decodeConverterReplacementDetail(encodedDetail);
  if (!detail) return;

  converterActiveReplacementKey = detail.key || getConverterReplacementKey(detail);
  document.querySelectorAll(".converter-preview-highlight.focused")
    .forEach(item => item.classList.remove("focused"));
  const marker = document.querySelector(`.converter-preview-highlight[data-replacement-key="${converterActiveReplacementKey}"]`);
  if (marker) {
    marker.classList.add("focused");
    marker.closest(".converter-preview-page-wrap")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    return;
  }

  scrollConverterPreviewToChange(detail.pageNumber, detail.oldPart);
}

function focusConverterPreviewSelection() {
  if (!converterPreviewFocusPage) return;

  requestAnimationFrame(() => {
    scrollConverterPreviewToChange(
      converterPreviewFocusPage.pageNumber,
      converterPreviewFocusPage.oldPart
    );
  });
}

function getConverterPreviewKey(result, pagesToPreview) {
  return [
    converterPdfFile?.name || "",
    converterPdfFile?.size || 0,
    converterExcelFiles.map(file => file.name).join(",") || converterExcelFile?.name || "",
    converterExcelFiles.reduce((sum, file) => sum + file.size, 0) || converterExcelFile?.size || 0,
    result.bytes?.byteLength || result.bytes?.length || 0,
    pagesToPreview.join(",")
  ].join("|");
}

function closeConverterPdfPreview() {
  document.getElementById("converterPreviewModal")?.classList.add("hidden");
}

async function refreshOpenConverterAfterPreview() {
  const modal = document.getElementById("converterPreviewModal");
  if (!modal || modal.classList.contains("hidden")) return;

  const status = document.getElementById("converterPreviewModalStatus");
  const beforeContainer = document.getElementById("converterBeforePreview");
  const afterContainer = document.getElementById("converterAfterPreview");
  if (!afterContainer) return;

  if (status) status.textContent = "Updating after preview with manual edit...";
  const result = await buildConvertedPDFBytes(false);
  if (!result) return;

  const pagesToPreview = result.changedPages.length
    ? result.changedPages
    : getPreviewPagesFromMatches();

  const originalBytes = await converterPdfFile.arrayBuffer();
  if (beforeContainer) {
    beforeContainer.innerHTML = "";
    await renderPdfPreviewBytes(originalBytes, beforeContainer, pagesToPreview, {
      highlights: result.replacementDetails || [],
      highlightType: "before"
    });
  }

  afterContainer.innerHTML = "";
  await renderPdfPreviewBytes(result.bytes, afterContainer, pagesToPreview, {
    highlights: result.replacementDetails || [],
    highlightType: "after"
  });
  renderConverterPreviewJumpList(result.replacementDetails || []);
  converterRenderedPreviewKey = "";

  if (status) {
    status.textContent = pagesToPreview.length
      ? `After preview updated. Showing page(s): ${pagesToPreview.join(", ")}.`
      : "After preview updated. No changed pages were found.";
  }
}

function getPreviewPagesFromMatches() {
  return Array.from(
    new Set(
      getDetectedChangeRows().map(row => row.pageNumber)
    )
  ).sort((a, b) => a - b);
}

async function renderPdfPreviewBytes(bytes, container, pageNumbers = [], options = {}) {
  if (!container) return;

  const pdf = await pdfjsLib.getDocument({
    data: bytes.slice(0)
  }).promise;

  const pagesToRender = (pageNumbers.length
    ? pageNumbers
    : Array.from({ length: Math.min(pdf.numPages, 5) }, (_, index) => index + 1)
  ).filter(pageNumber => pageNumber >= 1 && pageNumber <= pdf.numPages);

  for (const pageNumber of pagesToRender) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 0.8 });

    const label = document.createElement("div");
    label.className = "page-preview-label";
    label.textContent = `Page ${pageNumber}`;
    container.appendChild(label);

    const pageWrap = document.createElement("div");
    pageWrap.className = "converter-preview-page-wrap";
    pageWrap.dataset.pageNumber = String(pageNumber);
    pageWrap.style.width = `${viewport.width}px`;
    pageWrap.style.maxWidth = "100%";

    const canvas = document.createElement("canvas");
    canvas.className = "converter-preview-page";
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    pageWrap.appendChild(canvas);
    container.appendChild(pageWrap);

    await page.render({
      canvasContext: canvas.getContext("2d", { willReadFrequently: true }),
      viewport
    }).promise;

    renderConverterPreviewHighlights(
      pageWrap,
      viewport,
      pageNumber,
      options.highlights || [],
      options.highlightType || "after"
    );
  }

  if (!pageNumbers.length && pdf.numPages > pagesToRender.length) {
    const note = document.createElement("p");
    note.textContent = `Showing first ${pagesToRender.length} page(s) only.`;
    container.appendChild(note);
  }
}

function clearConverterFiles() {
  converterPdfFile = null;
  converterExcelFile = null;
  converterExcelFiles = [];
  converterMap = [];
  converterMatches = [];
  converterChangedPages = [];
  converterReplacementDetails = [];
  converterBuildCache = null;
  converterScanPromise = null;
  converterBuildPromise = null;
  converterRenderedPreviewKey = "";
  converterManualOverrides = [];
  converterLastScannedPages = [];
  converterLastOcrPages = [];
  converterPreviewFocusPage = null;
  converterSkippedReplacements = [];
  converterActiveReplacementKey = "";

  const pdfInput = document.getElementById("converterPdfUpload");
  const excelInput = document.getElementById("converterExcelUpload");
  const selectedPdf = document.getElementById("selectedConverterPdf");
  const selectedExcel = document.getElementById("selectedConverterExcel");

  if (pdfInput) pdfInput.value = "";
  if (excelInput) excelInput.value = "";

  if (selectedPdf) selectedPdf.textContent = "No PDF selected yet.";
  if (selectedExcel) selectedExcel.textContent = "No Excel selected yet.";

  document.getElementById("converterBeforePreview")?.replaceChildren();
  document.getElementById("converterAfterPreview")?.replaceChildren();
  document.getElementById("converterPreviewJumpList")?.replaceChildren();

  resetConverterPreview();
  updateConverterStatus("No files selected yet.");
}

function resetConverterPreview() {
  const tbody = document.getElementById("converterPreviewBody");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">No changes previewed yet.</td>
      </tr>
    `;
  }
  updateDetectedChangeCount(0);
}

function updateDetectedChangeCount(count = 0) {
  const countLabel = document.getElementById("detectedChangeCount");
  if (countLabel) {
    countLabel.textContent = `(${count})`;
  }
}

function downloadConverterFile(bytes, fileName, mimeType) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function escapeConverterHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderConverterPreviewHighlights(pageWrap, viewport, pageNumber, highlights, highlightType) {
  const pageHighlights = highlights.filter(detail =>
    detail.pageNumber === pageNumber &&
    Number.isFinite(detail.rectX) &&
    Number.isFinite(detail.rectY) &&
    Number.isFinite(detail.rectWidth) &&
    Number.isFinite(detail.rectHeight)
  );

  pageHighlights.forEach(detail => {
    const polygon = getConverterPreviewHighlightPolygon(detail, viewport);
    if (!polygon) return;

    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `converter-preview-highlight ${highlightType}`;
    marker.dataset.oldPart = detail.oldPart;
    marker.dataset.replacementKey = getConverterReplacementKey(detail);
    marker.title = `${detail.oldPart} -> ${detail.itemCode}. Click to cancel this replacement.`;
    marker.onclick = () => skipConverterReplacement(encodeConverterReplacementDetail(detail));
    if (marker.dataset.replacementKey === converterActiveReplacementKey) {
      marker.classList.add("focused");
    }
    marker.style.left = `${(polygon.left / viewport.width) * 100}%`;
    marker.style.top = `${(polygon.top / viewport.height) * 100}%`;
    marker.style.width = `${(polygon.width / viewport.width) * 100}%`;
    marker.style.height = `${(polygon.height / viewport.height) * 100}%`;
    marker.style.clipPath = polygon.clipPath;
    pageWrap.appendChild(marker);
  });
}

function getConverterPreviewHighlightPolygon(detail, viewport) {
  const corners = getRotatedPlacementCorners(detail)
    .map(point => {
      const [x, y] = viewport.convertToViewportPoint(point.x, point.y);
      return { x, y };
    });
  const minX = Math.min(...corners.map(point => point.x));
  const maxX = Math.max(...corners.map(point => point.x));
  const minY = Math.min(...corners.map(point => point.y));
  const maxY = Math.max(...corners.map(point => point.y));
  const width = Math.max(maxX - minX, 10);
  const height = Math.max(maxY - minY, 10);

  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const points = corners.map(point => {
    const x = ((point.x - minX) / width) * 100;
    const y = ((point.y - minY) / height) * 100;
    return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
  });

  return {
    left: minX,
    top: minY,
    width,
    height,
    clipPath: `polygon(${points.join(", ")})`
  };
}

