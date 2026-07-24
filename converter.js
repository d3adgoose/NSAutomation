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
let converterPdfVersion = 0;
let converterRenderedPreviewKey = "";
let converterManualOverrides = [];
let converterDraftManualOverrides = [];
let converterLastScannedPages = [];
let converterLastOcrPages = [];
let converterPreviewFocusPage = null;
let converterSkippedReplacements = [];
let converterReplacementOrder = new Map();
let converterActiveReplacementKey = "";
let converterPlacementAdjustments = [];
let converterDraftPlacementAdjustments = [];
let converterPlacementRepeatDelay = null;
let converterPlacementRepeatTimer = null;
let converterMasterPartLookup = null;
let converterMasterPartLookupKey = "";
let converterMasterPartCorrectionCount = 0;
let converterMasterPartPageMatchCount = 0;
let converterTextScanFailedPages = [];
let converterTaskStartedAt = 0;
let converterTaskTimer = null;
let converterLastStatusMessage = "";

const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;

function showConverterMessage(title = "Action Needed", message = "") {
  let modal = document.getElementById("converterMessageModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "converterMessageModal";
    modal.className = "modal hidden";
    modal.innerHTML = `
      <div class="modal-content app-prompt-modal-content">
        <h2 id="converterMessageTitle">Action Needed</h2>
        <p id="converterMessageText" class="app-prompt-message"></p>
        <div class="button-row app-prompt-actions">
          <button id="converterMessageOk" type="button">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const titleEl = document.getElementById("converterMessageTitle");
  const messageEl = document.getElementById("converterMessageText");
  const okButton = document.getElementById("converterMessageOk");

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (okButton) {
    okButton.onclick = () => modal.classList.add("hidden");
  }

  modal.classList.remove("hidden");
  okButton?.focus();
}

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
    showConverterMessage("PDF Required", "Please drop or choose a PDF file in the PDF box.");
    return;
  }

  converterPdfFile = file;
  converterPdfVersion++;
  converterMatches = [];
  converterChangedPages = [];
  converterReplacementDetails = [];
  converterBuildCache = null;
  converterScanPromise = null;
  converterBuildPromise = null;
  converterRenderedPreviewKey = "";
  converterManualOverrides = [];
  converterDraftManualOverrides = [];
  converterLastScannedPages = [];
  converterLastOcrPages = [];
  converterPreviewFocusPage = null;
  converterSkippedReplacements = [];
  converterReplacementOrder = new Map();
  converterActiveReplacementKey = "";
  converterPlacementAdjustments = [];
  converterDraftPlacementAdjustments = [];
  converterMasterPartCorrectionCount = 0;
  converterMasterPartPageMatchCount = 0;

  const selected = document.getElementById("selectedConverterPdf");
  if (selected) {
    selected.textContent = `Selected PDF: ${file.name}`;
  }

  resetConverterPreview();
  updateConverterStatus();

  const pdfInput = document.getElementById("converterPdfUpload");
  if (pdfInput) pdfInput.value = "";

  document.getElementById("converterBeforePreview")?.replaceChildren();
  document.getElementById("converterAfterPreview")?.replaceChildren();
  document.getElementById("converterPreviewJumpList")?.replaceChildren();
  renderConverterPlacementEditor();
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
    showConverterMessage("Excel or CSV Required", "Please drop or choose one or more Excel or CSV files in the Excel box.");
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
  converterDraftManualOverrides = [];
  converterLastScannedPages = [];
  converterLastOcrPages = [];
  converterPreviewFocusPage = null;
  converterSkippedReplacements = [];
  converterReplacementOrder = new Map();
  converterActiveReplacementKey = "";
  converterPlacementAdjustments = [];
  converterDraftPlacementAdjustments = [];
  converterMasterPartCorrectionCount = 0;
  converterMasterPartPageMatchCount = 0;

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
  status.textContent = message || "";
  const progress = document.getElementById("converterProgress");
  progress?.classList.toggle("hidden", !message && !converterTaskStartedAt);

  if (message && message !== converterLastStatusMessage) {
    converterLastStatusMessage = message;
    const histories = [
      document.getElementById("converterMessageHistory"),
      document.getElementById("converterModalMessageHistory")
    ].filter(Boolean);
    histories.forEach(history => {
      const item = document.createElement("li");
      const elapsed = converterTaskStartedAt
        ? formatConverterElapsed(performance.now() - converterTaskStartedAt)
        : "ready";
      item.innerHTML = `<time>${elapsed}</time><span>${escapeConverterHTML(message)}</span>`;
      history.appendChild(item);
      while (history.children.length > 30) history.firstElementChild?.remove();
    });
  }
}

function formatConverterElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateConverterElapsedTime() {
  if (!converterTaskStartedAt) return;
  const text = formatConverterElapsed(performance.now() - converterTaskStartedAt);
  const elapsed = document.getElementById("converterElapsedTime");
  const modalElapsed = document.getElementById("converterModalElapsedTime");
  if (elapsed) elapsed.textContent = text;
  if (modalElapsed) modalElapsed.textContent = `Elapsed ${text}`;
}

function startConverterTaskTimer(label) {
  converterTaskStartedAt = performance.now();
  converterLastStatusMessage = "";
  document.getElementById("converterMessageHistory")?.replaceChildren();
  document.getElementById("converterModalMessageHistory")?.replaceChildren();
  document.getElementById("converterProgress")?.classList.remove("hidden");
  clearInterval(converterTaskTimer);
  updateConverterElapsedTime();
  converterTaskTimer = setInterval(updateConverterElapsedTime, 250);
  updateConverterStatus(label);
}

function stopConverterTaskTimer() {
  if (!converterTaskStartedAt) return;
  updateConverterElapsedTime();
  clearInterval(converterTaskTimer);
  converterTaskTimer = null;
  converterTaskStartedAt = 0;
}

function runConverterTask(task, failureMessage, taskLabel = "") {
  if (taskLabel) startConverterTaskTimer(taskLabel);
  return Promise.resolve()
    .then(task)
    .catch(error => {
      console.error(failureMessage, error);
      updateConverterStatus(
        `${failureMessage} ${error?.message || "Please try again."}`
      );
    })
    .finally(() => {
      if (taskLabel) stopConverterTaskTimer();
    });
}

function isCurrentConverterPdf(file, version) {
  return converterPdfFile === file && converterPdfVersion === version;
}

async function readExcelConverterMap() {
  if (!converterExcelFiles.length && converterExcelFile) {
    converterExcelFiles = [converterExcelFile];
  }

  if (!converterExcelFiles.length) {
    showConverterMessage("Excel Required", "Upload an Excel file first.");
    return [];
  }

  const combinedMap = [];
  const workbookRecords = [];
  converterMasterPartCorrectionCount = 0;
  converterMasterPartPageMatchCount = 0;

  let excelFilesRead = 0;
  const loadedWorkbooks = await Promise.all(converterExcelFiles.map(async file => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    excelFilesRead++;
    updateConverterStatus(
      `Step 1 of 5: Reading Excel files (${excelFilesRead} of ${converterExcelFiles.length})...`
    );
    return { file, workbook };
  }));
  workbookRecords.push(...loadedWorkbooks);

  const masterLookup = getConverterMasterPartLookup(workbookRecords);

  workbookRecords.forEach(({ file, workbook }) => {
    const usesMasterListLogic = isConverterMasterListWorkbook(file, workbook);

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: ""
      });

      rows.forEach(row => {
        let oldPart = getExcelRowValue(row, [
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
          "Old PN #",
          "Use Old Part",
          "Use Old Part Number",
          "Use Old PN",
          "Current Part Number",
          "Current Part #",
          "Current PN",
          "Existing Part Number",
          "Existing Part #",
          "Existing PN",
          "Original Part Number",
          "Original Part #",
          "Original PN",
          "Previous Part Number",
          "Previous Part #",
          "Previous PN",
          "From Part Number",
          "From Part #",
          "From PN",
          "Merge From",
          "Merged From"
        ]);

        const legacyPart = usesMasterListLogic
          ? getExcelSafeLegacyPart(row, [
              "Sage PN",
              "Sage Part Number",
              "Sage Part #",
              "Legacy PN",
              "Legacy Part Number",
              "Legacy Part #",
              "Comments",
              "Comment",
              "Legacy Comments"
            ])
          : "";
        if (!oldPart && legacyPart) oldPart = legacyPart;

        const itemCode = getExcelRowValue(row, [
          "current_part_number",
          "Current Part Number",
          "Current Part #",
          "Current PN",
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
          "Part Number",
          "Master Part Number",
          "Master Part #",
          "Official Part Number",
          "Official Part #",
          "Correct Part Number",
          "Correct Part #",
          "Replacement Part Number",
          "Replacement Part #",
          "Replacement PN",
          "To Part Number",
          "To Part #",
          "To PN",
          "NS Part Number",
          "NS Part #"
        ]);

        const description = getExcelRowValue(row, [
          "Description",
          "Part Description",
          "Item Description",
          "Product Description",
          "Desc"
        ]);
        const masterCorrection = getMasterPartCorrection(
          description,
          itemCode,
          masterLookup
        );
        const correctedItemCode = masterCorrection?.partNumber || itemCode;

        if (oldPart && correctedItemCode && oldPart !== correctedItemCode) {
          if (masterCorrection) converterMasterPartCorrectionCount++;

          combinedMap.push({
            oldPart,
            itemCode: correctedItemCode,
            sourceFile: file.name,
            sourceSheet: sheetName,
            description,
            masterPartCorrection: masterCorrection || null
          });
        }
      });
    });
  });

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

function getExcelSafeLegacyPart(row, aliases) {
  const normalizedAliases = aliases.map(normalizeExcelHeader);
  for (const key of Object.keys(row)) {
    if (!normalizedAliases.includes(normalizeExcelHeader(key))) continue;
    const safeValue = getSafeConverterLegacyPart(row[key], normalizeExcelHeader(key));
    if (safeValue) return safeValue;
  }
  return "";
}

function getSafeConverterLegacyPart(value, normalizedHeader = "") {
  const cleanValue = String(value || "").trim();
  const oldPartMatch = cleanValue.match(/\b\d{3}-\d{4}\b/);
  if (!oldPartMatch) return "";

  if (String(normalizedHeader || "").includes("comment")) {
    return oldPartMatch[0];
  }

  return cleanValue === oldPartMatch[0] ? oldPartMatch[0] : "";
}

function normalizeExcelHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[#/\\]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getConverterMasterPartLookup(workbookRecords) {
  const lookupKey = workbookRecords
    .map(({ file }) => getConverterExcelFileKey(file))
    .join("||");

  if (converterMasterPartLookup && converterMasterPartLookupKey === lookupKey) {
    return converterMasterPartLookup;
  }

  const entriesByDescription = new Map();
  const entriesByToken = new Map();
  const entries = [];

  workbookRecords
    .filter(({ file, workbook }) => isConverterMasterListWorkbook(file, workbook))
    .forEach(({ file, workbook }) => {
      workbook.SheetNames
        .filter(sheetName => !shouldIgnoreMasterPartSheet(sheetName, workbook.Sheets[sheetName]))
        .forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

          rows.forEach(row => {
            const partNumber = getExcelRowValue(row, [
              "current_part_number",
              "Current Part Number",
              "Current Part #",
              "Current PN",
              "Part Number",
              "Part #",
              "Part#",
              "PN",
              "P/N",
              "Item Code",
              "Item Number"
            ]);
            const description = getExcelRowValue(row, [
              "Description",
              "Part Description",
              "Item Description",
              "Product Description",
              "Desc"
            ]);
            if (!partNumber) return;

            getConverterDescriptionVariants(description).forEach(descriptionVariant => {
              const normalizedDescription = normalizePartDescription(descriptionVariant);
              if (!isSpecificMasterDescription(normalizedDescription)) return;

              const entry = {
                partNumber,
                description: descriptionVariant,
                normalizedDescription,
                sourceFile: file.name,
                sourceSheet: sheetName
              };
              entries.push(entry);

              if (!entriesByDescription.has(normalizedDescription)) {
                entriesByDescription.set(normalizedDescription, new Map());
              }

              const partMap = entriesByDescription.get(normalizedDescription);
              if (!partMap.has(partNumber)) {
                partMap.set(partNumber, entry);
              }

              new Set(normalizedDescription.split(" "))
                .forEach(token => {
                  if (token.length < 4) return;
                  if (!entriesByToken.has(token)) entriesByToken.set(token, []);
                  entriesByToken.get(token).push(entry);
                });
            });
          });
        });
    });

  converterMasterPartLookup = { entries, entriesByDescription, entriesByToken };
  converterMasterPartLookupKey = lookupKey;
  return converterMasterPartLookup;
}

function isConverterMasterListWorkbook(file, workbook) {
  const fileName = String(file?.name || "").toLowerCase();
  if (/\b(master|pn master|part list|parts list|parts library|part library)\b/.test(fileName)) return true;
  if (workbook?.SheetNames?.some(name => /^(master parts|old part number map|drawing usage)$/i.test(String(name || "").trim()))) return true;

  const numericSheetCount = workbook.SheetNames.filter(sheetName =>
    /^\d{4}/.test(String(sheetName || "").trim())
  ).length;

  return numericSheetCount >= 2;
}

function shouldIgnoreMasterPartSheet(sheetName, worksheet) {
  const normalizedName = normalizeExcelHeader(sheetName);
  if (!worksheet) return true;
  if (/^(notes?|instructions?|read me|summary|cover|index|toc)$/.test(normalizedName)) {
    return true;
  }

  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  return range.e.r <= range.s.r;
}

function normalizePartDescription(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getConverterDescriptionVariants(description) {
  const variants = [
    String(description || "").trim(),
    ...String(description || "")
      .split(/\s*(?:\r?\n|\|)\s*/)
      .map(value => value.trim())
  ].filter(Boolean);
  const seen = new Set();
  return variants.filter(value => {
    const key = normalizePartDescription(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isSpecificMasterDescription(normalizedDescription) {
  const tokens = String(normalizedDescription || "")
    .split(" ")
    .filter(Boolean);

  return (
    normalizedDescription.length >= 10 &&
    tokens.length >= 2 &&
    tokens.some(token => token.length >= 4)
  );
}

function isMasterDescriptionMatchForPdfLine(lineText, entry) {
  const normalizedDescription = entry?.normalizedDescription || "";
  if (!isSpecificMasterDescription(normalizedDescription)) return false;

  const lineDescription = normalizePdfLineDescriptionForMasterMatch(lineText);
  if (!isSpecificMasterDescription(lineDescription)) return false;

  if (lineDescription === normalizedDescription) return true;

  const descriptionTokens = new Set(normalizedDescription.split(" ").filter(Boolean));
  const lineTokens = new Set(lineDescription.split(" ").filter(Boolean));
  const matchedTokens = Array.from(descriptionTokens)
    .filter(token => lineTokens.has(token))
    .length;
  const tokenCoverage = descriptionTokens.size
    ? matchedTokens / descriptionTokens.size
    : 0;
  const similarity = getPartDescriptionSimilarity(lineDescription, normalizedDescription);

  return tokenCoverage >= 0.85 && similarity >= 0.9;
}

function normalizePdfLineDescriptionForMasterMatch(lineText) {
  return normalizePartDescription(
    String(lineText || "")
      .replace(/\b\d{4}[-\s]\d{4}\b/g, " ")
      .replace(/\b\d{2,4}-\d{3,4}\b/g, " ")
  );
}

function getMasterPartCorrection(description, currentPartNumber, lookup) {
  const normalizedDescription = normalizePartDescription(description);
  const currentPart = String(currentPartNumber || "").trim();

  if (!isSpecificMasterDescription(normalizedDescription) || !currentPart || !lookup?.entries?.length) {
    return null;
  }

  const exactMatches = getUniqueMasterPartMatches(
    lookup.entriesByDescription.get(normalizedDescription)
  );
  const exactCorrection = getSingleMasterPartCorrection(
    exactMatches,
    currentPart,
    "exact"
  );
  if (exactCorrection) return exactCorrection;
  if (exactMatches.length > 0) return null;

  const fuzzyMatches = getFuzzyMasterPartMatches(normalizedDescription, lookup.entries);
  return getSingleMasterPartCorrection(fuzzyMatches, currentPart, "fuzzy");
}

function getUniqueMasterPartMatches(partMap) {
  if (!partMap) return [];
  return Array.from(partMap.values());
}

function getSingleMasterPartCorrection(matches, currentPartNumber, matchType) {
  if (matches.length !== 1) return null;

  const match = matches[0];
  if (normalizePartNumber(match.partNumber) === normalizePartNumber(currentPartNumber)) {
    return null;
  }

  return {
    partNumber: match.partNumber,
    description: match.description,
    sourceFile: match.sourceFile,
    sourceSheet: match.sourceSheet,
    matchType,
    note: "Corrected Part Number using Master List"
  };
}

function getFuzzyMasterPartMatches(normalizedDescription, entries) {
  const threshold = 0.97;
  let bestScore = 0;
  let bestEntries = [];
  const sourceTokens = new Set(normalizedDescription.split(" ").filter(Boolean));

  entries.forEach(entry => {
    const entryDescription = entry.normalizedDescription || "";
    const lengthRatio = Math.min(normalizedDescription.length, entryDescription.length) /
      Math.max(normalizedDescription.length, entryDescription.length);
    if (lengthRatio < 0.8) return;

    const entryTokens = new Set(entryDescription.split(" ").filter(Boolean));
    const matchedTokens = Array.from(sourceTokens)
      .filter(token => entryTokens.has(token))
      .length;
    const tokenCoverage = sourceTokens.size ? matchedTokens / sourceTokens.size : 0;
    if (tokenCoverage < 0.85) return;

    const score = getPartDescriptionSimilarity(
      normalizedDescription,
      entryDescription
    );

    if (score < threshold) return;

    if (score > bestScore + 0.001) {
      bestScore = score;
      bestEntries = [entry];
    } else if (Math.abs(score - bestScore) <= 0.001) {
      bestEntries.push(entry);
    }
  });

  const uniqueParts = new Map();
  bestEntries.forEach(entry => {
    uniqueParts.set(entry.partNumber, entry);
  });

  return Array.from(uniqueParts.values());
}

function getPartDescriptionSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const distance = getLevenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return maxLength ? 1 - distance / maxLength : 0;
}

function getLevenshteinDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const temp = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = temp;
    }
  }

  return previous[b.length];
}

function normalizePartNumber(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

async function extractPDFTextByPage(file) {
  const bytes = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: bytes.slice(0)
  }).promise;

  if (pdf.numPages >= 300 || file.size >= 100 * 1024 * 1024) {
    updateConverterStatus(
      `Large PDF notice: ${pdf.numPages} pages and ${(file.size / (1024 * 1024)).toFixed(1)} MB. The scan may take longer and use more browser memory.`
    );
    await waitForConverterPaint();
  }

  const pages = new Array(pdf.numPages);
  const failedPages = [];

  let nextPageNumber = 1;
  let completedPages = 0;
  const scanPage = async pageNumber => {
    try {
      pages[pageNumber - 1] = await withTimeout((async () => {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const textItems = [];
        const textParts = [];
        for (let itemIndex = 0; itemIndex < textContent.items.length; itemIndex++) {
          const item = textContent.items[itemIndex];
          textItems.push({
            text: item.str,
            str: item.str,
            transform: item.transform,
            width: item.width,
            height: item.height,
            fontName: item.fontName
          });
          textParts.push(item.str);
          if (itemIndex > 0 && itemIndex % 1000 === 0) {
            await waitForConverterIdle();
          }
        }
        page.cleanup?.();
        return {
          pageNumber,
          text: textParts.join(" "),
          textItems
        };
      })(), 15000, `PDF page ${pageNumber} text scan`);
    } catch (error) {
      console.warn(`Could not scan PDF page ${pageNumber}:`, error);
      failedPages.push(pageNumber);
      pages[pageNumber - 1] = {
        pageNumber,
        text: "",
        textItems: [],
        scanError: error?.message || "Page scan failed"
      };
    }
    completedPages++;
    const warning = failedPages.length
      ? ` Skipped page(s) ${failedPages.join(", ")} after a scan error or timeout.`
      : "";
    if (completedPages === 1 || completedPages % 25 === 0 || completedPages === pdf.numPages) {
      updateConverterStatus(`Step 2 of 5: Scanning PDF pages (${completedPages} of ${pdf.numPages})...${warning}`);
    }
  };

  // Two workers reduce scan time without flooding the UI thread on large drawings.
  const workerCount = Math.min(2, pdf.numPages);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextPageNumber <= pdf.numPages) {
      const pageNumber = nextPageNumber++;
      await waitForConverterPaint();
      await scanPage(pageNumber);
      await waitForConverterIdle();
    }
  });
  await Promise.all(workers);

  converterTextScanFailedPages = [...new Set(failedPages)].sort((a, b) => a - b);
  return pages;
}

async function extractDrawingPageOCRText(file, textPages) {
  const hasOCR = await ensureTesseractLoaded();
  if (!hasOCR) {
    updateConverterStatus(
      "Image-only page scanning could not load, so only normal selectable PDF text was scanned."
    );
    return [];
  }

  const drawingCandidates = textPages
    .filter(isDrawingLikeTextPage)
    .slice(0, 8);
  if (!drawingCandidates.length) return [];

  updateConverterStatus(`Step 3 of 5: Preparing to read ${drawingCandidates.length} image-only page(s)...`);

  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: bytes.slice(0)
  }).promise;
  const results = [];

  for (const [candidateIndex, candidate] of drawingCandidates.entries()) {
    try {
      await waitForConverterIdle();
      updateConverterStatus(
        `Step 3 of 5: Reading image-only page ${candidate.pageNumber} (${candidateIndex + 1} of ${drawingCandidates.length})...`
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

function withTimeout(promise, timeoutMs, label = "Operation") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds.`)),
      timeoutMs
    );
    Promise.resolve(promise).then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function waitForConverterPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
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

async function augmentConverterMapWithMasterDescriptionMatches(baseMap, pages) {
  const map = [...baseMap];
  const existingKeys = new Set(map.map(item => `${item.oldPart}=>${item.itemCode}`));
  const pendingByOldPart = new Map();
  let descriptionComparisons = 0;
  converterMasterPartPageMatchCount = 0;

  if (!converterMasterPartLookup?.entries?.length || !Array.isArray(pages)) {
    converterMap = map;
    return converterMap;
  }

  for (const [pageIndex, page] of pages.entries()) {
    if (pageIndex === 0 || pageIndex % 25 === 0 || pageIndex === pages.length - 1) {
      updateConverterStatus(`Step 2 of 5: Matching descriptions (${pageIndex + 1} of ${pages.length} pages)...`);
      await waitForConverterIdle();
    }
    const lines = getConverterTextItemLines(page.textItems || []);

    for (const line of lines) {
      const partCandidates = Array.from(new Set(getConverterPartNumberCandidates(line.text)));
      if (partCandidates.length !== 1) continue;

      const possibleEntries = getMasterDescriptionCandidatesForPdfLine(
        line.text,
        converterMasterPartLookup
      );
      if (!possibleEntries.length) continue;

      for (const entry of possibleEntries) {
        descriptionComparisons++;
        if (descriptionComparisons % 2000 === 0) {
          await waitForConverterIdle();
        }
        if (!isMasterDescriptionMatchForPdfLine(line.text, entry)) continue;

        const candidates = partCandidates
          .filter(part => normalizePartNumber(part) !== normalizePartNumber(entry.partNumber));
        const uniqueCandidates = Array.from(new Set(candidates));
        if (uniqueCandidates.length !== 1) continue;

        const oldPart = uniqueCandidates[0];
        const existing = pendingByOldPart.get(oldPart);
        if (existing && existing.itemCode !== entry.partNumber) {
          pendingByOldPart.set(oldPart, null);
          continue;
        }

        pendingByOldPart.set(oldPart, {
          oldPart,
          itemCode: entry.partNumber,
          sourceFile: entry.sourceFile,
          sourceSheet: entry.sourceSheet,
          description: entry.description,
          masterPartCorrection: {
            partNumber: entry.partNumber,
            description: entry.description,
            sourceFile: entry.sourceFile,
            sourceSheet: entry.sourceSheet,
            matchType: "pdf-line",
            note: "Corrected Part Number using Master List"
          }
        });
      }
    }
  }

  pendingByOldPart.forEach(item => {
    if (!item) return;
    const key = `${item.oldPart}=>${item.itemCode}`;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    map.push(item);
    converterMasterPartPageMatchCount++;
  });

  converterMap = map;
  return converterMap;
}

function getMasterDescriptionCandidatesForPdfLine(lineText, lookup) {
  const normalizedLine = normalizePdfLineDescriptionForMasterMatch(lineText);
  if (!isSpecificMasterDescription(normalizedLine)) return [];

  const exactMatches = lookup.entriesByDescription?.get(normalizedLine);
  if (exactMatches?.size) return Array.from(exactMatches.values());

  const tokenBuckets = Array.from(new Set(normalizedLine.split(" ")))
    .filter(token => token.length >= 4)
    .map(token => lookup.entriesByToken?.get(token))
    .filter(bucket => bucket?.length)
    .sort((a, b) => a.length - b.length);

  // The rarest shared descriptive token provides a small fuzzy-match shortlist.
  // Full similarity and token-coverage checks still validate every candidate.
  return tokenBuckets[0] || [];
}

function getConverterTextItemLines(textItems) {
  const lineMap = new Map();

  textItems.forEach(item => {
    const y = Math.round(Number(item.transform?.[5] || 0) / 3) * 3;
    if (!lineMap.has(y)) lineMap.set(y, []);
    lineMap.get(y).push(item);
  });

  return Array.from(lineMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => ({
      text: items
        .sort((a, b) => Number(a.transform?.[4] || 0) - Number(b.transform?.[4] || 0))
        .map(item => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    }))
    .filter(line => line.text);
}

function getConverterPartNumberCandidates(text) {
  const matches = String(text || "").match(/\b\d{4}[-\s]\d{4}\b/g) || [];
  return matches.map(match => match.replace(/\s+/, "-"));
}

function getManualConverterValue(oldPart) {
  return converterManualOverrides.find(item => item.oldPart === oldPart)?.itemCode || "";
}

function getDraftConverterValue(oldPart) {
  const draftValue = converterDraftManualOverrides.find(item => item.oldPart === oldPart)?.itemCode;
  if (draftValue) return draftValue;
  return getManualConverterValue(oldPart);
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

function updateConverterDraftPart(oldPart, value) {
  const itemCode = String(value || "").trim();
  converterDraftManualOverrides = converterDraftManualOverrides.filter(item => item.oldPart !== oldPart);
  if (itemCode) converterDraftManualOverrides.push({ oldPart, itemCode });

  const detail = converterReplacementDetails.find(item => item.oldPart === oldPart);
  if (detail) {
    renderConverterPlacementEditor({ ...detail, key: getConverterReplacementKey(detail) });
  }
  converterBuildCache = null;
  converterBuildPromise = null;
  converterRenderedPreviewKey = "";
  updateConverterStatus("Preview number edited. Click Done to apply it.");
}


function getConverterChangeDetails(match) {
  const details = [];
  (match.foundPageCounts || []).forEach(page => {
    details.push(`Page ${page.pageNumber}: ${page.count} PDF text mention(s)`);
  });
  (match.ocrFoundPageCounts || [])
    .filter(page => !(match.foundPages || []).includes(page.pageNumber))
    .forEach(page => {
      details.push(`Page ${page.pageNumber}: image-only page review`);
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

function getConverterMappingReview(match, replacementValue) {
  const normalizedReplacement = normalizePartNumber(replacementValue);
  const masterEntry = converterMasterPartLookup?.entries?.find(entry =>
    normalizePartNumber(entry.partNumber) === normalizedReplacement
  );
  const excelDescription = String(match.description || "").trim();
  const replacementDescription = String(
    masterEntry?.description || match.masterPartCorrection?.description || excelDescription
  ).trim();

  return {
    excelDescription,
    replacementDescription,
    source: [match.sourceFile, match.sourceSheet].filter(Boolean).join(" › "),
    correctedByMaster: Boolean(match.masterPartCorrection)
  };
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
    <div class="converter-after-edit-header">Review Excel Mappings</div>
    <p class="converter-mapping-help">Confirm the old number, replacement number, and description against the source Excel row before building.</p>
    <div class="converter-after-edit-list">
      ${foundMatches.map(match => {
        const value = getManualConverterValue(match.oldPart) || match.itemCode;
        const review = getConverterMappingReview(match, value);
        return `
          <div class="converter-mapping-review-card">
            <div class="converter-mapping-number-grid">
              <div class="converter-mapping-number converter-mapping-old-number">
                <span class="converter-mapping-label">Old part number</span>
                <strong>${escapeConverterHTML(match.oldPart)}</strong>
              </div>
              <span class="converter-mapping-arrow" aria-hidden="true">→</span>
              <label class="converter-mapping-number converter-mapping-new-number">
                <span class="converter-mapping-label">Change to</span>
                <input value="${escapeConverterHTML(value)}" onchange="updateConverterManualPart('${escapeConverterHTML(match.oldPart)}', this.value)" />
              </label>
            </div>
            <div class="converter-mapping-description">
              <span class="converter-mapping-label">Excel description</span>
              <span>${escapeConverterHTML(review.excelDescription || "No description was provided in the mapping row.")}</span>
            </div>
            ${review.replacementDescription && review.replacementDescription !== review.excelDescription ? `
              <div class="converter-mapping-description converter-master-description">
                <span class="converter-mapping-label">Replacement description from Master List</span>
                <span>${escapeConverterHTML(review.replacementDescription)}</span>
              </div>
            ` : ""}
            <div class="converter-mapping-source">
              ${review.source ? `Source: ${escapeConverterHTML(review.source)}` : "Source workbook row"}
              ${review.correctedByMaster ? `<span class="converter-master-note"> · Replacement verified/corrected by Master List</span>` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function previewPartNumberChanges() {
  return runConverterTask(
    previewPartNumberChangesImpl,
    "Preview changes failed.",
    "Starting PDF scan and change preview..."
  );
}

async function previewPartNumberChangesImpl() {
  if (converterScanPromise) return converterScanPromise;

  const scanPromise = previewPartNumberChangesScan();
  converterScanPromise = scanPromise;

  try {
    return await scanPromise;
  } finally {
    if (converterScanPromise === scanPromise) {
      converterScanPromise = null;
    }
  }
}

async function previewPartNumberChangesScan() {
  const scanPdfFile = converterPdfFile;
  const scanPdfVersion = converterPdfVersion;
  converterTextScanFailedPages = [];

  if (!scanPdfFile) {
    showConverterMessage("PDF Required", "Upload a PDF first.");
    return;
  }

  if (!converterExcelFiles.length && !converterExcelFile) {
    showConverterMessage("Excel Required", "Upload an Excel file first.");
    return;
  }

  const sourceSize = scanPdfFile.size + converterExcelFiles.reduce((sum, file) => sum + file.size, 0);
  if (sourceSize >= 100 * 1024 * 1024) {
    updateConverterStatus(
      `Large-file notice: ${(sourceSize / (1024 * 1024)).toFixed(1)} MB of PDF and spreadsheet files selected.`
    );
    await waitForConverterPaint();
  }

  updateConverterStatus("Step 1 of 5: Reading conversion spreadsheets...");

  const map = await readExcelConverterMap();
  if (!isCurrentConverterPdf(scanPdfFile, scanPdfVersion)) return;

  const pages = await extractPDFTextByPage(scanPdfFile);
  if (!isCurrentConverterPdf(scanPdfFile, scanPdfVersion)) return;

  updateConverterStatus("Step 2 of 5: Matching spreadsheet parts to scanned text...");
  const effectiveMap = await augmentConverterMapWithMasterDescriptionMatches(map, pages);

  if (!effectiveMap.length) {
    converterBuildCache = null;
    converterLastScannedPages = pages;
    converterLastOcrPages = [];
    converterMatches = [];
    renderConverterPreview();
    updateConverterStatus("No convertible part numbers were found. Files without conversion columns are skipped unless a master-list description appears with one clear different part number in the PDF.");
    return;
  }

  converterBuildCache = null;
  converterLastScannedPages = pages;
  converterLastOcrPages = [];
  converterMatches = await buildConverterMatchesAsync(getEffectiveConverterMap(effectiveMap), pages);
  renderConverterPreview();

  let ocrPages = [];
  const useDeepDrawingOcr = document.getElementById("converterDeepOcr")?.checked === true;

  if (useDeepDrawingOcr) {
    try {
      ocrPages = await extractDrawingPageOCRText(scanPdfFile, pages);
    } catch (error) {
      console.warn("Image-only page scan failed:", error);
      updateConverterStatus(
        "PDF text preview is ready. Image-only page scanning stopped before it finished."
      );
    }
  } else {
    updateConverterStatus(
      "Step 3 of 5: Image-only page scanning is off for a faster preview. Turn it on when part numbers are inside scanned drawings or pictures."
    );
  }

  if (!isCurrentConverterPdf(scanPdfFile, scanPdfVersion)) return;

  if (ocrPages.length) {
    converterLastOcrPages = ocrPages;
    converterMatches = await buildConverterMatchesAsync(getEffectiveConverterMap(converterMap), pages, ocrPages);
    renderConverterPreview();
  }

  const foundCount = converterMatches.filter(item =>
    item.foundPages.length || item.ocrFoundPages.length
  ).length;
  const ocrFoundCount = converterMatches.filter(item =>
    item.ocrFoundPages.length
  ).length;
  const ocrText = ocrFoundCount
    ? ` ${ocrFoundCount} part number(s) also appeared on image-only page(s).`
    : "";
  const correctionText = converterMasterPartCorrectionCount
    ? ` ${converterMasterPartCorrectionCount} row part number(s) corrected using Master List.`
    : "";
  const masterMatchText = converterMasterPartPageMatchCount
    ? ` ${converterMasterPartPageMatchCount} PDF part number(s) matched by Master List description.`
    : "";
  const scanWarningText = converterTextScanFailedPages.length
    ? ` Warning: page(s) ${converterTextScanFailedPages.join(", ")} could not be text-scanned and were skipped.`
    : "";
  updateConverterStatus(`Preview complete. Found ${foundCount} matching part number(s).${ocrText}${correctionText}${masterMatchText}${scanWarningText}`);

  if (getDetectedChangeRows().some(row => !row.locationText.includes("image-only page"))) {
    updateConverterStatus("Step 4 of 5: Confirming visible replacements...");
    await buildConvertedPDFBytes(false);
    renderConverterPreview();
    updateConverterStatus(
      converterReplacementDetails.length
        ? `Preview complete. Confirmed ${converterReplacementDetails.length} visible replacement(s).${scanWarningText}`
        : `Preview complete. No visible replacement areas were confirmed.${scanWarningText}`
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
  return map.map(item => buildConverterMatch(item, pages, ocrPages));
}

async function buildConverterMatchesAsync(map, pages, ocrPages = []) {
  const matches = [];
  for (let index = 0; index < map.length; index++) {
    if (index % 25 === 0) {
      updateConverterStatus(`Step 2 of 5: Matching part numbers (${index + 1} of ${map.length})...`);
      await waitForConverterIdle();
    }
    matches.push(buildConverterMatch(map[index], pages, ocrPages));
  }
  return matches;
}

function buildConverterMatch(item, pages, ocrPages = []) {
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
            masterPartCorrection: match.masterPartCorrection || null,
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
          masterPartCorrection: match.masterPartCorrection || null,
          count: ocrPage.count,
          source: "Image-only page scan",
          locationText: "image-only page review"
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
  if (detail.baseKey) return detail.baseKey;
  if (detail.key) return detail.key;

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

function getConverterPlacementAdjustment(key, source = converterDraftPlacementAdjustments) {
  let adjustment = source.find(item => item.key === key);
  if (!adjustment) {
    adjustment = {
      key,
      dx: 0,
      dy: 0,
      dw: 0,
      dh: 0,
      fontDelta: 0
    };
    source.push(adjustment);
  }
  return adjustment;
}

function applyConverterPlacementAdjustment(key, placement, source = converterDraftPlacementAdjustments) {
  const adjustment = source.find(item => item.key === key);
  if (!adjustment) return placement;

  const angle = Number(placement.angle || 0) * Math.PI / 180;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const normalX = -dirY;
  const normalY = dirX;
  const dx = Number(adjustment.dx || 0);
  const dy = Number(adjustment.dy || 0);
  const dw = Number(adjustment.dw || 0);
  const dh = Number(adjustment.dh || 0);
  const fontDelta = Number(adjustment.fontDelta || 0);
  const baseTextX = Number.isFinite(Number(placement.textX)) ? Number(placement.textX) : Number(placement.rectX || 0);
  const baseTextY = Number.isFinite(Number(placement.textY)) ? Number(placement.textY) : Number(placement.rectY || 0);
  const baseFontSize = Number.isFinite(Number(placement.fontSize))
    ? Number(placement.fontSize)
    : Math.max(4, Number(placement.rectHeight || 8) * 0.8);

  return {
    ...placement,
    textX: baseTextX + dx,
    textY: baseTextY + dy,
    rectX: placement.rectX + dx - dirX * Math.min(0, dw / 2) - normalX * Math.min(0, dh / 2),
    rectY: placement.rectY + dy - dirY * Math.min(0, dw / 2) - normalY * Math.min(0, dh / 2),
    rectWidth: Math.max(4, Number(placement.rectWidth || 0) + dw),
    rectHeight: Math.max(4, Number(placement.rectHeight || 0) + dh),
    fontSize: Math.max(4, baseFontSize + fontDelta)
  };
}

function adjustConverterPlacement(encodedDetail, changes) {
  const detail = decodeConverterReplacementDetail(encodedDetail);
  if (!detail) return;

  const key = detail.key || getConverterReplacementKey(detail);
  const adjustment = getConverterPlacementAdjustment(key, converterDraftPlacementAdjustments);
  Object.entries(changes || {}).forEach(([name, amount]) => {
    adjustment[name] = Number(adjustment[name] || 0) + Number(amount || 0);
  });

  converterActiveReplacementKey = key;
  renderConverterPlacementEditor({ ...detail, key });
  refreshConverterDraftHighlights();
  updateConverterStatus("Preview edit ready. Click Done to apply it.");
}

function startConverterPlacementRepeat(encodedDetail, changes, event = null) {
  if (event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
  }

  stopConverterPlacementRepeat();
  adjustConverterPlacement(encodedDetail, changes);

  converterPlacementRepeatDelay = setTimeout(() => {
    converterPlacementRepeatTimer = setInterval(() => {
      adjustConverterPlacement(encodedDetail, changes);
    }, 85);
  }, 280);

  window.addEventListener("pointerup", stopConverterPlacementRepeat, { once: true });
  window.addEventListener("pointercancel", stopConverterPlacementRepeat, { once: true });
}

function stopConverterPlacementRepeat() {
  if (converterPlacementRepeatDelay) {
    clearTimeout(converterPlacementRepeatDelay);
    converterPlacementRepeatDelay = null;
  }
  if (converterPlacementRepeatTimer) {
    clearInterval(converterPlacementRepeatTimer);
    converterPlacementRepeatTimer = null;
  }
}

function resetConverterPlacement(encodedDetail) {
  const detail = decodeConverterReplacementDetail(encodedDetail);
  if (!detail) return;

  const key = detail.key || getConverterReplacementKey(detail);
  converterDraftPlacementAdjustments = converterDraftPlacementAdjustments.filter(item => item.key !== key);
  converterActiveReplacementKey = key;
  renderConverterPlacementEditor({ ...detail, key });
  refreshConverterDraftHighlights();
  updateConverterStatus("Preview edit reset. Click Done to apply current edits.");
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
    angle: detail.angle || 0,
    listIndex: Number.isFinite(Number(detail.listIndex))
      ? Number(detail.listIndex)
      : getConverterReplacementOrder(detail)
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
  rebuildConverterAfterSkipChange("Change unselected. It will not be included in the build.");
}

function restoreConverterReplacement(encodedDetail) {
  const detail = decodeConverterReplacementDetail(encodedDetail);
  if (!detail) return;

  const key = detail.key || getConverterReplacementKey(detail);
  converterSkippedReplacements = converterSkippedReplacements.filter(item => item.key !== key);

  converterActiveReplacementKey = key;
  rebuildConverterAfterSkipChange("Change selected. It will be included again.");
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
      marker.classList.add("unselected");
      marker.classList.remove("canceled");
    } else {
      marker.classList.remove("unselected", "canceled");
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
              ${change.masterPartCorrection ? '<span class="converter-master-note">Corrected Part Number using Master List</span>' : ''}
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
        masterPartCorrection: match.masterPartCorrection || null,
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
          masterPartCorrection: match.masterPartCorrection || null,
          locationText: `Page ${page.pageNumber} - image-only page review`
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
      `Image-only page scan: page(s) ${match.ocrFoundPages.join(", ")} - review manually`
    );
  }

  return textParts.length ? textParts.join(" | ") : "No";
}

function generateConvertedPDF() {
  return runConverterTask(
    generateConvertedPDFImpl,
    "Converted PDF could not be generated.",
    "Starting converted PDF build..."
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
    showConverterMessage("PDF Required", "Upload a PDF first.");
    return null;
  }

  if (!converterExcelFiles.length && !converterExcelFile) {
    showConverterMessage("Excel Required", "Upload an Excel file first.");
    return null;
  }

  updateConverterStatus("Step 4 of 5: Generating converted PDF...");

  const baseMap = converterMap.length
    ? converterMap
    : await readExcelConverterMap();
  let map = getEffectiveConverterMap(baseMap);

  if (!map.length && !converterMasterPartLookup?.entries?.length) {
    updateConverterStatus("No convertible part numbers were found in the selected Excel files.");
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
    const buildPromise = buildConvertedPDFBytesImpl(showFinalStatus)
      .finally(() => {
        if (converterBuildPromise === buildPromise) {
          converterBuildPromise = null;
        }
      });
    converterBuildPromise = buildPromise;
    return buildPromise;
  }

  return buildConvertedPDFBytesImpl(showFinalStatus);
}

async function buildConvertedPDFBytesImpl(showFinalStatus = false) {
  const buildPdfFile = converterPdfFile;
  const buildPdfVersion = converterPdfVersion;

  if (!buildPdfFile) return null;

  const baseMap = converterMap.length
    ? converterMap
    : await readExcelConverterMap();
  let map = getEffectiveConverterMap(baseMap);

  if (!isCurrentConverterPdf(buildPdfFile, buildPdfVersion)) return null;

  const originalBytes = await buildPdfFile.arrayBuffer();
  if (!isCurrentConverterPdf(buildPdfFile, buildPdfVersion)) return null;

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

  if (!map.length && converterMasterPartLookup?.entries?.length) {
    const pages = await extractPDFTextByPage(buildPdfFile);
    if (!isCurrentConverterPdf(buildPdfFile, buildPdfVersion)) return null;
    map = getEffectiveConverterMap(
      await augmentConverterMapWithMasterDescriptionMatches(baseMap, pages)
    );
  }

  if (!map.length) {
    updateConverterStatus("No convertible part numbers were found in the selected Excel files.");
    return null;
  }

  let replacementCount = 0;
  const changedPages = new Set();
  const replacementDetails = [];
  const backgroundSamplers = new Map();
  const expectedReplacementCounts = new Map(
    map.map(item => [item.oldPart, 0])
  );

  const pageIndexesToCheck = getConverterBuildPageIndexes(pdfDoc.getPageCount(), map);
  updateConverterStatus(
    `Step 4 of 5: Checking ${pageIndexesToCheck.length} candidate page(s) instead of all ${pdfDoc.getPageCount()} pages...`
  );

  for (const [candidateIndex, pageIndex] of pageIndexesToCheck.entries()) {
    if (candidateIndex > 0 && candidateIndex % 10 === 0) {
      updateConverterStatus(
        `Step 4 of 5: Checking candidate pages (${candidateIndex + 1} of ${pageIndexesToCheck.length})...`
      );
      await waitForConverterIdle();
    }
    const pdfLibPage = pdfDoc.getPage(pageIndex);
    const page = await pdfForText.getPage(pageIndex + 1);
    const cachedTextItems = converterLastScannedPages[pageIndex]?.pageNumber === pageIndex + 1
      ? converterLastScannedPages[pageIndex].textItems
      : null;
    const textContent = cachedTextItems?.length
      ? { items: cachedTextItems }
      : await page.getTextContent();
    const pageSize = pdfLibPage.getSize();

    const pageReplacements = getPageTextReplacements(textContent.items, map);
    for (const replacement of pageReplacements) {
      const replacementFont = getReplacementFont(replacement.items[0].item, fonts);
      const placement = getTextItemReplacementPlacement(
        replacement,
        replacementFont
      );
      const baseDetail = {
        pageNumber: pageIndex + 1,
        oldPart: replacement.oldPart,
        itemCode: replacement.itemCode,
        rectX: placement.rectX,
        rectY: placement.rectY,
        rectWidth: placement.rectWidth,
        rectHeight: placement.rectHeight,
        angle: placement.angle
      };
      const baseKey = getConverterReplacementKey(baseDetail);
      const adjustedPlacement = applyConverterPlacementAdjustment(baseKey, placement, converterPlacementAdjustments);
      const isVisible = await isVisibleTextReplacement(
        page,
        pageIndex,
        adjustedPlacement,
        pageSize,
        backgroundSamplers
      );
      if (!isVisible) continue;

      const replacementDetail = {
        pageNumber: pageIndex + 1,
        oldPart: replacement.oldPart,
        itemCode: replacement.itemCode,
        baseKey,
        textX: adjustedPlacement.textX,
        textY: adjustedPlacement.textY,
        fontSize: adjustedPlacement.fontSize,
        rectX: adjustedPlacement.rectX,
        rectY: adjustedPlacement.rectY,
        rectWidth: adjustedPlacement.rectWidth,
        rectHeight: adjustedPlacement.rectHeight,
        angle: adjustedPlacement.angle
      };
      if (isConverterReplacementSkipped(replacementDetail)) continue;

      const backgroundColor = await getTextItemBackgroundColor(
        page,
        pageIndex,
        adjustedPlacement,
        pageSize,
        backgroundSamplers
      );
      const rotate = degrees(adjustedPlacement.angle);

      pdfLibPage.drawRectangle({
        x: adjustedPlacement.rectX,
        y: adjustedPlacement.rectY,
        width: adjustedPlacement.rectWidth,
        height: adjustedPlacement.rectHeight,
        rotate,
        color: backgroundColor,
        opacity: 1
      });

      pdfLibPage.drawText(replacement.itemCode, {
        x: adjustedPlacement.textX,
        y: adjustedPlacement.textY,
        size: adjustedPlacement.fontSize,
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

  if (!isCurrentConverterPdf(buildPdfFile, buildPdfVersion)) return null;

  let convertedBytes = await pdfDoc.save();
  if (!isCurrentConverterPdf(buildPdfFile, buildPdfVersion)) return null;

  converterChangedPages = Array.from(changedPages).sort((a, b) => a - b);
  converterReplacementDetails = replacementDetails;
  updateConverterStatus("Step 5 of 5: Verifying converted part numbers...");
  const overlayVerification = await verifyConvertedPDF(
    convertedBytes,
    map,
    expectedReplacementCounts
  );
  updateConverterStatus(
    converterChangedPages.length
      ? `Step 5 of 5: Securing ${converterChangedPages.length} changed page(s)...`
      : "Step 5 of 5: Completing verification..."
  );
  convertedBytes = await flattenChangedPDFPages(
    convertedBytes,
    converterChangedPages
  );
  const finalVerification = await verifyNoSelectableOldParts(
    convertedBytes,
    map
  );
  if (!isCurrentConverterPdf(buildPdfFile, buildPdfVersion)) return null;
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

function getConverterBuildPageIndexes(pageCount, map) {
  const allPageIndexes = Array.from({ length: pageCount }, (_, index) => index);
  if (converterLastScannedPages.length !== pageCount) return allPageIndexes;

  return allPageIndexes.filter(pageIndex => {
    const scannedPage = converterLastScannedPages[pageIndex];
    if (!scannedPage || scannedPage.scanError) return true;
    return getPageTextReplacements(scannedPage.textItems || [], map).length > 0;
  });
}

function getPageTextReplacements(textItems, map) {
  const runs = [];
  let currentIndex = 0;

  textItems.forEach(item => {
    const text = String(item.str || "");
    const start = currentIndex;
    const end = start + text.length;

    runs.push({
      item,
      text,
      start,
      end
    });

    currentIndex = end;
  });

  const pageText = runs.map(run => run.text).join("");

  return map.flatMap(item => {
    const oldPart = String(item.oldPart || "");
    if (!oldPart) return [];

    const replacements = [];
    let searchIndex = 0;

    while (true) {
      const index = pageText.indexOf(oldPart, searchIndex);
      if (index === -1) break;

      const matchEnd = index + oldPart.length;
      const coveredItems = [];
      let runIndex = runs.findIndex(run => index < run.end);

      while (runIndex !== -1 && runIndex < runs.length && runs[runIndex].start < matchEnd) {
        const run = runs[runIndex];
        const segmentStart = Math.max(0, index - run.start);
        const segmentEnd = Math.min(run.text.length, matchEnd - run.start);

        coveredItems.push({
          item: run.item,
          text: run.text.slice(segmentStart, segmentEnd),
          startInItem: segmentStart,
          endInItem: segmentEnd,
          prefixText: run.text.slice(0, segmentStart)
        });

        runIndex += 1;
      }

      if (coveredItems.length) {
        replacements.push({
          oldPart,
          itemCode: item.itemCode,
          replacementText: item.itemCode,
          items: coveredItems
        });
      }

      searchIndex = matchEnd;
    }

    return replacements;
  });
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

function getTextItemReplacementPlacement(replacement, font) {
  const firstSegment = replacement.items[0];
  const firstTextItem = firstSegment.item;
  const firstTransform = firstTextItem.transform || [1, 0, 0, 8, 0, 0];
  const [a = 1, b = 0, c = 0, d = 8] = firstTransform;
  const fontSize = Math.max(
    6,
    Math.hypot(c, d) || Math.hypot(a, b) || firstTextItem.height || 8
  );

  const textVectorLength = Math.hypot(a, b) || 1;
  const dirX = a / textVectorLength;
  const dirY = b / textVectorLength;
  const normalX = -dirY;
  const normalY = dirX;
  const angle = Math.atan2(b, a) * 180 / Math.PI;

  const firstPrefixWidth = font.widthOfTextAtSize(
    String(firstSegment.prefixText || ""),
    fontSize
  ) * getTextWidthScaleForItem(firstTextItem, fontSize, font);
  const firstSegmentStartX = (firstTransform[4] || 0) + dirX * firstPrefixWidth;
  const firstSegmentStartY = (firstTransform[5] || 0) + dirY * firstPrefixWidth;

  const totalTextWidth = replacement.items.reduce((sum, segment) => {
    const itemText = String(segment.text || "");
    const scale = getTextWidthScaleForItem(segment.item, fontSize, font);
    return sum + font.widthOfTextAtSize(itemText, fontSize) * scale;
  }, 0);

  const coverPaddingStart = Math.max(0.6, fontSize * 0.08);
  const coverPaddingEnd = Math.max(1.0, fontSize * 0.1);
  const coverWidth = totalTextWidth + coverPaddingStart + coverPaddingEnd;

  const replacementWidthAtOriginalSize = font.widthOfTextAtSize(replacement.replacementText, fontSize);
  let replacementFontSize = Math.min(
    fontSize * 0.92,
    replacementWidthAtOriginalSize
      ? fontSize * ((totalTextWidth + coverPaddingStart) / replacementWidthAtOriginalSize)
      : fontSize * 0.92
  );
  replacementFontSize = Math.max(Math.min(6, fontSize * 0.92), replacementFontSize);

  let replacementTextWidth = font.widthOfTextAtSize(
    replacement.replacementText,
    replacementFontSize
  );
  while (replacementTextWidth > coverWidth && replacementFontSize > 4.0) {
    replacementFontSize -= 0.25;
    replacementTextWidth = font.widthOfTextAtSize(
      replacement.replacementText,
      replacementFontSize
    );
  }

  const textInset = Math.max(0.15, fontSize * 0.05);
  const baselineLift = (fontSize - replacementFontSize) * 0.32;
  const rectPadding = Math.max(fontSize * 0.08, 1.0);
  const itemHeight = Math.max(Math.abs(firstTextItem.height || fontSize), replacementFontSize);
  const rectHeight = Math.max(itemHeight * 1.02, replacementFontSize * 1.03, fontSize * 1.0) + rectPadding * 1.6;

  const rectX = firstSegmentStartX - dirX * coverPaddingStart - normalX * rectPadding;
  const rectY = firstSegmentStartY - itemHeight * 0.22 - rectPadding;
  const rectWidth = Math.max(coverWidth, replacementTextWidth + coverPaddingStart + coverPaddingEnd);

  return {
    angle,
    fontSize: replacementFontSize,
    textX: firstSegmentStartX + dirX * textInset + normalX * baselineLift,
    textY: firstSegmentStartY + dirY * textInset + normalY * baselineLift,
    rectX,
    rectY,
    rectWidth,
    rectHeight
  };
}

function getTextWidthScaleForItem(textItem, fontSize, font) {
  const itemText = String(textItem.str || "");
  const measuredWidth = fontSize && font
    ? font.widthOfTextAtSize(itemText, fontSize)
    : 0;
  const itemWidth = textItem.width || 0;
  if (!measuredWidth || !itemWidth) {
    return 1;
  }
  return Math.max(itemWidth / measuredWidth, 0.8);
}

function isLikelyInkColor(color) {
  const brightness = (color.r + color.g + color.b) / 3;
  const contrast = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
  return brightness < 205 && contrast > 45;
}

function getDominantBackgroundSamples(samples) {
  if (!samples.length) return [];

  const buckets = new Map();
  samples.forEach(sample => {
    const key = getColorBucketKey(sample.color);
    const bucket = buckets.get(key) || { samples: [], weight: 0 };
    bucket.samples.push(sample);
    bucket.weight += sample.weight;
    buckets.set(key, bucket);
  });

  const dominant = Array.from(buckets.values())
    .sort((a, b) => b.weight - a.weight)[0];

  return dominant?.samples?.length
    ? dominant.samples
    : samples.slice(0, Math.max(1, Math.ceil(samples.length * 0.4)));
}

function getColorBucketKey(color) {
  return [
    Math.round(color.r / 10) * 10,
    Math.round(color.g / 10) * 10,
    Math.round(color.b / 10) * 10
  ].join("|");
}

function getBackgroundSampleOffsets() {
  const offsets = [
    { u: 0.18, v: 0.5, weight: 4.2, distance: 0 },
    { u: 0.5, v: 0.5, weight: 4.6, distance: 0 },
    { u: 0.82, v: 0.5, weight: 4.2, distance: 0 },
    { u: 0.35, v: 0.32, weight: 3.4, distance: 0.03 },
    { u: 0.65, v: 0.68, weight: 3.4, distance: 0.03 }
  ];
  const rings = [
    { distance: 0.05, weight: 3.0 },
    { distance: 0.12, weight: 2.0 },
    { distance: 0.22, weight: 1.0 }
  ];

  rings.forEach(ring => {
    offsets.push(
      { u: -ring.distance, v: 0.5, weight: ring.weight, distance: ring.distance },
      { u: 1 + ring.distance, v: 0.5, weight: ring.weight, distance: ring.distance },
      { u: 0.5, v: -ring.distance, weight: ring.weight, distance: ring.distance },
      { u: 0.5, v: 1 + ring.distance, weight: ring.weight, distance: ring.distance },
      { u: -ring.distance, v: -ring.distance, weight: ring.weight * 0.65, distance: ring.distance },
      { u: 1 + ring.distance, v: -ring.distance, weight: ring.weight * 0.65, distance: ring.distance },
      { u: -ring.distance, v: 1 + ring.distance, weight: ring.weight * 0.65, distance: ring.distance },
      { u: 1 + ring.distance, v: 1 + ring.distance, weight: ring.weight * 0.65, distance: ring.distance }
    );
  });

  return offsets;
}

function itemBackgroundScore(sample) {
  const distancePenalty = Number(sample.distance || 0) * 38;
  const confidenceBoost = Number(sample.weight || 1) * 5;
  const inkPenalty = isLikelyInkColor(sample.color) ? 100 : 0;
  return confidenceBoost - distancePenalty - inkPenalty;
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

  const angle = Number(placement.angle || 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const widthVec = {
    x: cos * placement.rectWidth,
    y: sin * placement.rectWidth
  };
  const heightVec = {
    x: -sin * placement.rectHeight,
    y: cos * placement.rectHeight
  };

  const sampleOffsets = getBackgroundSampleOffsets();

  const samples = sampleOffsets.flatMap(offset => {
    const x = placement.rectX + widthVec.x * offset.u + heightVec.x * offset.v;
    const y = placement.rectY + widthVec.y * offset.u + heightVec.y * offset.v;
    const patch = sampler.samplePatch(x, pageSize.height - y, Math.max(2, Math.min(5, placement.rectHeight * 0.24)));
    return patch
      ? [{ color: patch.color, weight: offset.weight * patch.confidence, distance: offset.distance }]
      : [];
  });

  if (!samples.length) return rgb(1, 1, 1);

  const nonInkSamples = samples.filter(item => !isLikelyInkColor(item.color));
  const usefulSamples = nonInkSamples.length ? nonInkSamples : samples;

  const scored = usefulSamples.map(item => ({
    ...item,
    brightness: (item.color.r + item.color.g + item.color.b) / 3,
    spread: Math.max(item.color.r, item.color.g, item.color.b) - Math.min(item.color.r, item.color.g, item.color.b)
  })).sort((a, b) => {
    const scoreA = itemBackgroundScore(a);
    const scoreB = itemBackgroundScore(b);
    return scoreB - scoreA;
  });

  const topColors = getDominantBackgroundSamples(scored);
  const average = topColors.reduce(
    (sum, sample) => ({
      r: sum.r + sample.color.r * sample.weight,
      g: sum.g + sample.color.g * sample.weight,
      b: sum.b + sample.color.b * sample.weight,
      w: sum.w + sample.weight
    }),
    { r: 0, g: 0, b: 0, w: 0 }
  );

  const finalColor = {
    r: average.r / average.w,
    g: average.g / average.w,
    b: average.b / average.w
  };

  const brightness = (finalColor.r + finalColor.g + finalColor.b) / 3;
  if (brightness > 248) {
    return rgb(1, 1, 1);
  }

  return rgb(
    Math.min(1, Math.max(0, finalColor.r / 255)),
    Math.min(1, Math.max(0, finalColor.g / 255)),
    Math.min(1, Math.max(0, finalColor.b / 255))
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
      samplePatch(x, y, size = 5) {
        const half = Math.max(1, Math.floor(size / 2));
        const left = Math.max(0, Math.min(canvas.width - 1, Math.round(x) - half));
        const top = Math.max(0, Math.min(canvas.height - 1, Math.round(y) - half));
        const width = Math.max(1, Math.min(canvas.width - left, half * 2 + 1));
        const height = Math.max(1, Math.min(canvas.height - top, half * 2 + 1));
        const image = context.getImageData(left, top, width, height).data;
        const colors = [];

        for (let index = 0; index < image.length; index += 4) {
          const color = {
            r: image[index],
            g: image[index + 1],
            b: image[index + 2]
          };
          if (!isLikelyInkColor(color)) {
            colors.push(color);
          }
        }

        if (!colors.length) return null;

        const buckets = new Map();
        colors.forEach(color => {
          const key = getColorBucketKey(color);
          const bucket = buckets.get(key) || { colors: [] };
          bucket.colors.push(color);
          buckets.set(key, bucket);
        });
        const dominantColors = Array.from(buckets.values())
          .sort((a, b) => b.colors.length - a.colors.length)[0]?.colors || colors;

        const average = dominantColors.reduce(
          (sum, color) => ({
            r: sum.r + color.r,
            g: sum.g + color.g,
            b: sum.b + color.b
          }),
          { r: 0, g: 0, b: 0 }
        );

        return {
          color: {
            r: average.r / dominantColors.length,
            g: average.g / dominantColors.length,
            b: average.b / dominantColors.length
          },
          confidence: colors.length / (width * height)
        };
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
    "PDF preview could not be created.",
    "Starting before and after PDF preview..."
  );
}

async function openConverterPdfPreviewImpl() {
  if (!converterPdfFile) {
    showConverterMessage("PDF Required", "Upload a PDF first.");
    return;
  }

  if (!converterExcelFiles.length && !converterExcelFile) {
    showConverterMessage("Excel Required", "Upload an Excel file first.");
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
  renderConverterPlacementEditor();

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

  const changesByKey = new Map();
  details.forEach((detail, index) => {
    const key = getConverterReplacementKey(detail);
    if (!changesByKey.has(key)) {
      changesByKey.set(key, {
        ...detail,
        key,
        listIndex: getConverterReplacementOrder({ ...detail, key }, index)
      });
    }
  });

  converterSkippedReplacements.forEach(detail => {
    const key = detail.key || getConverterReplacementKey(detail);
    const listIndex = getConverterReplacementOrder(detail, detail.listIndex);
    if (changesByKey.has(key)) {
      changesByKey.set(key, { ...changesByKey.get(key), ...detail, key, listIndex, skipped: true });
    } else {
      changesByKey.set(key, { ...detail, key, skipped: true, listIndex });
    }
  });

  const orderedChanges = Array.from(changesByKey.values())
    .sort((a, b) => getConverterJumpSortValue(a) - getConverterJumpSortValue(b));

  if (!orderedChanges.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = `
    <span>Jump to change</span>
    ${orderedChanges.map(detail => {
      const encoded = encodeConverterReplacementDetail(detail);
      const isUnselected = !!detail.skipped;
      const key = detail.key || getConverterReplacementKey(detail);
      const isActive = key === converterActiveReplacementKey;
      return `
        <span
          class="converter-jump-chip ${isUnselected ? "unselected" : ""} ${isActive ? "active" : ""}"
          data-replacement-key="${escapeConverterHTML(key)}"
        >
          <button
            type="button"
            ${isUnselected ? "disabled" : `onclick="focusConverterReplacement('${encoded}')"`}
          >
            ${getConverterJumpChipHTML(detail)}
          </button>
          <button
            class="${isUnselected ? "converter-jump-select" : "converter-jump-unselect"}"
            type="button"
            title="${isUnselected ? "Select this replacement" : "Unselect this replacement"}"
            onclick="${isUnselected ? "restoreConverterReplacement" : "skipConverterReplacement"}('${encoded}')"
          >
            ${isUnselected ? "Select" : "Unselect"}
          </button>
        </span>
      `;
    }).join("")}
  `;

  focusConverterJumpChip(converterActiveReplacementKey);
}

function getConverterJumpSortValue(detail) {
  return getConverterReplacementOrder(detail, detail.listIndex);
}

function getConverterReplacementOrder(detail, fallbackIndex = null) {
  const key = detail?.key || getConverterReplacementKey(detail || {});
  if (converterReplacementOrder.has(key)) {
    return converterReplacementOrder.get(key);
  }

  const fallback = Number.isFinite(Number(fallbackIndex))
    ? Number(fallbackIndex)
    : converterReplacementOrder.size;
  converterReplacementOrder.set(key, fallback);
  return fallback;
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

function focusConverterReplacement(encodedDetail, options = {}) {
  const detail = decodeConverterReplacementDetail(encodedDetail);
  if (!detail) return;

  syncConverterDraftManualOverrides();
  converterActiveReplacementKey = detail.key || getConverterReplacementKey(detail);
  const shouldScrollToChip = !!options.scrollToChip;
  focusConverterJumpChip(converterActiveReplacementKey, shouldScrollToChip);

  if (!converterDraftPlacementAdjustments.some(item => item.key === converterActiveReplacementKey)) {
    const applied = converterPlacementAdjustments.find(item => item.key === converterActiveReplacementKey);
    if (applied) converterDraftPlacementAdjustments.push({ ...applied });
  }
  document.querySelectorAll(".converter-preview-highlight.focused")
    .forEach(item => item.classList.remove("focused"));
  const markers = Array.from(document.querySelectorAll(".converter-preview-highlight"))
    .filter(item => item.dataset.replacementKey === converterActiveReplacementKey);
  markers.forEach(item => item.classList.add("focused"));
  const marker = markers[0];
  renderConverterPlacementEditor({ ...detail, key: converterActiveReplacementKey });
  if (marker) {
    if (!shouldScrollToChip) {
      marker.closest(".converter-preview-page-wrap")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
    return;
  }

  if (!shouldScrollToChip) {
    scrollConverterPreviewToChange(detail.pageNumber, detail.oldPart);
  }
}

function focusConverterJumpChip(key, shouldScroll = false) {
  const chips = Array.from(document.querySelectorAll(".converter-jump-chip"));
  let activeChip = null;

  chips.forEach(chip => {
    const isActive = !!key && chip.dataset.replacementKey === key;
    chip.classList.toggle("active", isActive);
    if (isActive) activeChip = chip;
  });

  if (!shouldScroll || !activeChip) return;

  document.getElementById("converterPreviewJumpList")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
  activeChip.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center"
  });
  activeChip.querySelector(".converter-jump-select, .converter-jump-unselect")?.focus({
    preventScroll: true
  });
}

function syncConverterDraftManualOverrides() {
  if (!converterDraftManualOverrides.length && converterManualOverrides.length) {
    converterDraftManualOverrides = converterManualOverrides.map(item => ({ ...item }));
  }
}

function renderConverterPlacementEditor(detail = null) {
  const panel = document.getElementById("converterPlacementEditor");
  if (!panel) return;

  if (!detail) {
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="converter-placement-summary">
        <span>Preview Edit</span>
        <strong>Select a change chip or highlight to edit its preview placement.</strong>
      </div>
    `;
    return;
  }

  const key = detail.key || getConverterReplacementKey(detail);
  const adjustment = converterDraftPlacementAdjustments.find(item => item.key === key) || {};
  const encoded = encodeConverterReplacementDetail({ ...detail, key });

  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="converter-placement-summary">
      <span>Preview Edit</span>
      <strong>Page ${detail.pageNumber}: ${escapeConverterHTML(detail.oldPart)} to ${escapeConverterHTML(detail.itemCode)}</strong>
    </div>
    <div class="converter-placement-controls">
      <div class="converter-placement-group">
        <span>Move</span>
        <div class="converter-nudge-grid">
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { dy: 0.5 })">Up</button>
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { dx: -0.5 })">Left</button>
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { dx: 0.5 })">Right</button>
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { dy: -0.5 })">Down</button>
        </div>
      </div>
      <div class="converter-placement-group">
        <span>Text</span>
        <div class="converter-button-pair">
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { fontDelta: -0.25 })">Smaller</button>
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { fontDelta: 0.25 })">Larger</button>
        </div>
      </div>
      <div class="converter-placement-group">
        <span>Cover</span>
        <div class="converter-button-pair">
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { dw: -1 })">Narrower</button>
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { dw: 1 })">Wider</button>
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { dh: -0.5 })">Shorter</button>
          <button type="button" onclick="adjustConverterPlacement('${encoded}', { dh: 0.5 })">Taller</button>
        </div>
      </div>
      <button class="secondary converter-placement-reset" type="button" onclick="resetConverterPlacement('${encoded}')">Reset</button>
    </div>
    <div class="converter-placement-values">
      These controls only edit the preview. Click Done to apply.
      Move X ${formatConverterAdjustment(adjustment.dx)} / Y ${formatConverterAdjustment(adjustment.dy)}
      · Text ${formatConverterAdjustment(adjustment.fontDelta)}
      · Cover W ${formatConverterAdjustment(adjustment.dw)} / H ${formatConverterAdjustment(adjustment.dh)}
    </div>
  `;
}

function formatConverterAdjustment(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number.toFixed(2)}` : number.toFixed(2);
}

function renderConverterPlacementEditorV2(detail = null) {
  const panel = document.getElementById("converterPlacementEditor");
  if (!panel) return;

  if (!detail) {
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="converter-editor-empty">
        <span>Preview edit</span>
        <strong>Select a change chip or highlight</strong>
        <p>Use the side panel to review the replacement and fine tune its preview placement before clicking Done.</p>
      </div>
    `;
    return;
  }

  const key = detail.key || getConverterReplacementKey(detail);
  const adjustment = converterDraftPlacementAdjustments.find(item => item.key === key) || {};
  const encoded = encodeConverterReplacementDetail({ ...detail, key });
  const adjustedDetail = applyConverterPlacementAdjustment(key, detail, converterDraftPlacementAdjustments);
  const sizePreview = Number(adjustedDetail.fontSize || detail.fontSize || detail.rectHeight || 10);
  const previewFontSize = Math.max(13, Math.min(22, sizePreview * 1.4));
  const draftItemCode = getDraftConverterValue(detail.oldPart) || detail.itemCode;

  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="converter-editor-header">
      <span>Preview edit</span>
      <strong>Page ${detail.pageNumber}</strong>
    </div>
    <div class="converter-editor-card">
      <span class="converter-editor-label">Before</span>
      <div class="converter-editor-before">${escapeConverterHTML(detail.oldPart)}</div>
      <span class="converter-editor-label">After</span>
      <input
        class="converter-editor-after"
        style="font-size:${previewFontSize}px"
        value="${escapeConverterHTML(draftItemCode)}"
        onchange="updateConverterDraftPart('${escapeConverterHTML(detail.oldPart)}', this.value)"
      />
    </div>
    <p class="converter-editor-note">
      These are preview-only edits. The PDF is updated after you click Done.
    </p>
    <div class="converter-placement-controls">
      <div class="converter-placement-group">
        <span>Position</span>
        <div class="converter-nudge-grid">
          <button class="converter-nudge-up" type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { dy: 0.5 }, event)" title="Hold to move up">Up</button>
          <button class="converter-nudge-left" type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { dx: -0.5 }, event)" title="Hold to move left">Left</button>
          <button class="converter-nudge-right" type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { dx: 0.5 }, event)" title="Hold to move right">Right</button>
          <button class="converter-nudge-down" type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { dy: -0.5 }, event)" title="Hold to move down">Down</button>
        </div>
      </div>
      <div class="converter-placement-group">
        <span>Text size</span>
        <div class="converter-button-pair">
          <button type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { fontDelta: -0.25 }, event)" title="Hold to shrink text">Smaller</button>
          <button type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { fontDelta: 0.25 }, event)" title="Hold to enlarge text">Larger</button>
        </div>
      </div>
      <div class="converter-placement-group">
        <span>Cover box</span>
        <div class="converter-button-pair converter-cover-row">
          <button type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { dw: -1 }, event)" title="Hold to make cover narrower">Narrower</button>
          <button type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { dw: 1 }, event)" title="Hold to make cover wider">Wider</button>
        </div>
        <div class="converter-button-pair converter-cover-row">
          <button type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { dh: -0.5 }, event)" title="Hold to make cover shorter">Shorter</button>
          <button type="button" onpointerdown="startConverterPlacementRepeat('${encoded}', { dh: 0.5 }, event)" title="Hold to make cover taller">Taller</button>
        </div>
      </div>
      <button class="secondary converter-placement-reset" type="button" onclick="resetConverterPlacement('${encoded}')">Reset</button>
    </div>
    <div class="converter-placement-values">
      Move X ${formatConverterAdjustment(adjustment.dx)} / Y ${formatConverterAdjustment(adjustment.dy)}
      / Text ${formatConverterAdjustment(adjustment.fontDelta)}
      / Cover W ${formatConverterAdjustment(adjustment.dw)} / H ${formatConverterAdjustment(adjustment.dh)}
    </div>
  `;
}

renderConverterPlacementEditor = renderConverterPlacementEditorV2;

function refreshConverterDraftHighlights() {
  document.querySelectorAll(".converter-preview-page-wrap").forEach(pageWrap => {
    const pageNumber = Number(pageWrap.dataset.pageNumber);
    const canvas = pageWrap.querySelector("canvas");
    if (!pageNumber || !canvas) return;

    pageWrap.querySelectorAll(".converter-preview-highlight, .converter-draft-cover, .converter-draft-box-sizing, .converter-draft-text").forEach(item => item.remove());
    const scale = Number(pageWrap.dataset.viewportScale || 0.8);
    const viewport = {
      width: canvas.width,
      height: canvas.height,
      convertToViewportPoint(x, y) {
        return [x * scale, canvas.height - y * scale];
      }
    };
    renderConverterPreviewHighlights(
      pageWrap,
      viewport,
      pageNumber,
      getConverterDraftReplacementDetails(),
      pageWrap.closest("#converterBeforePreview") ? "before" : "after"
    );
  });
}

function getConverterDraftReplacementDetails() {
  return converterReplacementDetails.map(detail => {
    const key = getConverterReplacementKey(detail);
    const adjustedDetail = applyConverterPlacementAdjustment(key, detail, converterDraftPlacementAdjustments);
    return {
      ...detail,
      originalTextX: detail.textX,
      originalTextY: detail.textY,
      originalFontSize: detail.fontSize,
      originalRectX: detail.rectX,
      originalRectY: detail.rectY,
      originalRectWidth: detail.rectWidth,
      originalRectHeight: detail.rectHeight,
      originalAngle: detail.angle,
      ...adjustedDetail,
      itemCode: getDraftConverterValue(detail.oldPart) || detail.itemCode,
      key,
      baseKey: key
    };
  });
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

function applyConverterPreviewSelections() {
  converterManualOverrides = converterDraftManualOverrides.map(item => ({ ...item }));
  converterPlacementAdjustments = converterDraftPlacementAdjustments.map(item => ({ ...item }));
  converterBuildCache = null;
  converterBuildPromise = null;
  converterRenderedPreviewKey = "";

  return runConverterTask(
    async () => {
      await refreshOpenConverterAfterPreview();
      updateConverterStatus("Preview edits applied. Build will use the current preview edits.");
    },
    "Preview edits could not be applied."
  );
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
    pageWrap.dataset.viewportScale = String(viewport.scale || 0.8);
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
  converterPdfVersion++;
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
  converterDraftManualOverrides = [];
  converterLastScannedPages = [];
  converterLastOcrPages = [];
  converterPreviewFocusPage = null;
  converterSkippedReplacements = [];
  converterReplacementOrder = new Map();
  converterActiveReplacementKey = "";
  converterPlacementAdjustments = [];
  converterDraftPlacementAdjustments = [];
  converterMasterPartCorrectionCount = 0;
  converterMasterPartPageMatchCount = 0;

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
  updateConverterStatus();
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
    const hasDraftPreview = highlightType === "after" && isConverterDraftPreviewDifferent(detail);

    if (hasDraftPreview) {
      renderConverterDraftReplacementPreview(pageWrap, viewport, detail, polygon);
    }

    const markerPolygon = hasDraftPreview
      ? getConverterPreviewTextPolygon(pageWrap, viewport, detail) || polygon
      : polygon;
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `converter-preview-highlight ${highlightType}`;
    marker.dataset.oldPart = detail.oldPart;
    marker.dataset.replacementKey = getConverterReplacementKey(detail);
    marker.title = `${detail.oldPart} -> ${detail.itemCode}. Click to find its Select/Unselect button.`;
    marker.onclick = () => focusConverterReplacement(
      encodeConverterReplacementDetail(detail),
      { scrollToChip: true }
    );
    if (marker.dataset.replacementKey === converterActiveReplacementKey) {
      marker.classList.add("focused");
    }
    if (hasDraftPreview) marker.classList.add("text-fit");
    marker.style.left = `${(markerPolygon.left / viewport.width) * 100}%`;
    marker.style.top = `${(markerPolygon.top / viewport.height) * 100}%`;
    marker.style.width = `${(markerPolygon.width / viewport.width) * 100}%`;
    marker.style.height = `${(markerPolygon.height / viewport.height) * 100}%`;
    marker.style.clipPath = markerPolygon.clipPath;
    pageWrap.appendChild(marker);
  });
}

function isConverterDraftPreviewDifferent(detail) {
  const checks = [
    ["itemCode", ""],
    ["textX", "originalTextX"],
    ["textY", "originalTextY"],
    ["fontSize", "originalFontSize"],
    ["rectX", "originalRectX"],
    ["rectY", "originalRectY"],
    ["rectWidth", "originalRectWidth"],
    ["rectHeight", "originalRectHeight"],
    ["angle", "originalAngle"]
  ];

  return checks.some(([currentKey, originalKey]) => {
    if (currentKey === "itemCode") {
      const committed = converterReplacementDetails.find(item => getConverterReplacementKey(item) === getConverterReplacementKey(detail));
      return String(detail.itemCode || "") !== String(committed?.itemCode || "");
    }
    const current = Number(detail[currentKey]);
    const original = Number(detail[originalKey]);
    return Number.isFinite(current) && Number.isFinite(original) && Math.abs(current - original) > 0.01;
  });
}

function renderConverterDraftReplacementPreview(pageWrap, viewport, detail, polygon) {
  const originalDetail = {
    ...detail,
    textX: detail.originalTextX ?? detail.textX,
    textY: detail.originalTextY ?? detail.textY,
    fontSize: detail.originalFontSize ?? detail.fontSize,
    rectX: detail.originalRectX ?? detail.rectX,
    rectY: detail.originalRectY ?? detail.rectY,
    rectWidth: detail.originalRectWidth ?? detail.rectWidth,
    rectHeight: detail.originalRectHeight ?? detail.rectHeight,
    angle: detail.originalAngle ?? detail.angle
  };
  const originalPolygon = getConverterPreviewHighlightPolygon(originalDetail, viewport);
  const backgroundColor = getConverterPreviewBackgroundColor(pageWrap, polygon, originalPolygon);

  if (originalPolygon) {
    appendConverterDraftCover(pageWrap, viewport, originalPolygon, backgroundColor);
  }
  appendConverterDraftCover(pageWrap, viewport, polygon, backgroundColor);
  appendConverterDraftBoxSizing(pageWrap, viewport, polygon);
  appendConverterDraftText(pageWrap, viewport, detail, backgroundColor);
}

function appendConverterDraftCover(pageWrap, viewport, polygon, backgroundColor) {
  const cover = document.createElement("span");
  cover.className = "converter-draft-cover";
  cover.style.left = `${(polygon.left / viewport.width) * 100}%`;
  cover.style.top = `${(polygon.top / viewport.height) * 100}%`;
  cover.style.width = `${(polygon.width / viewport.width) * 100}%`;
  cover.style.height = `${(polygon.height / viewport.height) * 100}%`;
  cover.style.clipPath = polygon.clipPath;
  cover.style.background = backgroundColor;
  pageWrap.appendChild(cover);
}

function appendConverterDraftBoxSizing(pageWrap, viewport, polygon) {
  const outline = document.createElement("span");
  outline.className = "converter-draft-box-sizing";
  outline.title = "Cover box size";
  outline.style.left = `${(polygon.left / viewport.width) * 100}%`;
  outline.style.top = `${(polygon.top / viewport.height) * 100}%`;
  outline.style.width = `${(polygon.width / viewport.width) * 100}%`;
  outline.style.height = `${(polygon.height / viewport.height) * 100}%`;
  outline.style.clipPath = polygon.clipPath;
  pageWrap.appendChild(outline);
}

function appendConverterDraftText(pageWrap, viewport, detail, backgroundColor) {
  const text = String(detail.itemCode || "").trim();
  if (!text) return;

  const [x, y] = viewport.convertToViewportPoint(
    Number(detail.textX ?? detail.rectX ?? 0),
    Number(detail.textY ?? detail.rectY ?? 0)
  );
  const scale = Number(pageWrap.dataset.viewportScale || 0.8);
  const fontSize = Math.max(6, Number(detail.fontSize || detail.rectHeight || 8) * scale);
  const angle = -Number(detail.angle || 0);
  const textOverlay = document.createElement("span");
  textOverlay.className = "converter-draft-text";
  textOverlay.textContent = text;
  textOverlay.style.left = `${(x / viewport.width) * 100}%`;
  textOverlay.style.top = `${(y / viewport.height) * 100}%`;
  textOverlay.style.fontSize = `${fontSize}px`;
  textOverlay.style.lineHeight = `${fontSize}px`;
  textOverlay.style.transform = `translateY(-90%) rotate(${angle}deg)`;
  textOverlay.style.background = backgroundColor;
  pageWrap.appendChild(textOverlay);
}

function getConverterPreviewTextPolygon(pageWrap, viewport, detail) {
  const text = String(detail.itemCode || "").trim();
  if (!text) return null;

  const scale = Number(pageWrap.dataset.viewportScale || 0.8);
  const fontSize = Math.max(6, Number(detail.fontSize || detail.rectHeight || 8));
  const textWidth = getConverterPreviewTextWidth(pageWrap, text, fontSize * scale) / scale;
  const height = Math.max(4, fontSize * 1.12);
  return getConverterPreviewHighlightPolygon(
    {
      rectX: Number(detail.textX ?? detail.rectX ?? 0),
      rectY: Number(detail.textY ?? detail.rectY ?? 0),
      rectWidth: Math.max(6, textWidth + 2),
      rectHeight: height,
      angle: Number(detail.angle || 0)
    },
    viewport
  );
}

function getConverterPreviewTextWidth(pageWrap, text, fontSize) {
  const canvas = pageWrap.querySelector("canvas");
  const fallback = text.length * fontSize * 0.58;
  if (!canvas) return fallback;

  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;

  ctx.save();
  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  const width = ctx.measureText(text).width;
  ctx.restore();
  return Number.isFinite(width) && width > 0 ? width : fallback;
}

function getConverterPreviewBackgroundColor(pageWrap, polygon, originalPolygon = null) {
  const canvas = pageWrap.querySelector("canvas");
  if (!canvas) return "rgb(255, 255, 255)";

  const samplePolygons = [polygon, originalPolygon].filter(Boolean);
  const colors = [];
  samplePolygons.forEach(samplePolygon => {
    colors.push(...sampleConverterPreviewCanvasColors(canvas, samplePolygon));
  });

  const lightColors = colors.filter(color => {
    const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
    const spread = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
    return brightness > 120 && spread < 80;
  });
  const source = lightColors.length ? lightColors : colors;
  if (!source.length) return "rgb(255, 255, 255)";

  const average = source.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b
    }),
    { r: 0, g: 0, b: 0 }
  );
  return `rgb(${Math.round(average.r / source.length)}, ${Math.round(average.g / source.length)}, ${Math.round(average.b / source.length)})`;
}

function sampleConverterPreviewCanvasColors(canvas, polygon) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  const insetX = Math.max(1, polygon.width * 0.18);
  const insetY = Math.max(1, polygon.height * 0.18);
  const points = [
    [polygon.left + insetX, polygon.top + insetY],
    [polygon.left + polygon.width - insetX, polygon.top + insetY],
    [polygon.left + insetX, polygon.top + polygon.height - insetY],
    [polygon.left + polygon.width - insetX, polygon.top + polygon.height - insetY],
    [polygon.left + polygon.width / 2, polygon.top + polygon.height / 2]
  ];

  return points.map(([x, y]) => {
    const pixel = ctx.getImageData(
      Math.max(0, Math.min(canvas.width - 1, Math.round(x))),
      Math.max(0, Math.min(canvas.height - 1, Math.round(y))),
      1,
      1
    ).data;
    return { r: pixel[0], g: pixel[1], b: pixel[2] };
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

