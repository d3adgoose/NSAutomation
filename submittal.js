/* --------------------------------------------------------------------------
   Packet builder state and reusable TOC templates

   This file intentionally exposes functions globally because submittal.html and
   om.html call them from existing event handlers. Keep those public names stable.
   -------------------------------------------------------------------------- */

let pdfLibrary = [];
let pendingBuild = false;
let finalBuildPreviewAccepted = false;
let finalBuildPreviewCache = null;
let customSectionLabels = {};
const sourcePDFBytesCache = new WeakMap();
let romanCoverPageBytesPromise = null;
let warrantyPromptHandled = false;
let selectedManagedPages = new Set();
let currentBuildPdfDoc = null;
const builderUndoStack = [];
const builderRedoStack = [];
let builderHistoryFieldSnapshots = new Map();
const BUILDER_HISTORY_LIMIT = 50;
let editingTOCEntryId = "";
const PDF_PARENT_TOC_ID = "__pdf_parent__";
const TOC_ENTRY_TEMPLATES = [
  {
    id: "brush-module-3100",
    name: "Brush module 3100",
    entries: [
      { title: "Brush module 3100", tocLevel: 0 },
      { title: "1.5hp system-3M brush motor (3/4\" shaft)", tocLevel: 1 },
      { title: "3M gear reducer (15:1 & 40:1 ratios)", tocLevel: 1 },
      { title: "1-1/2\" 2-bolt normal duty bearing", tocLevel: 1 },
      { title: "Brush module 3100 spray pipes", tocLevel: 1 },
      { title: "5010 brass check valve nozzle", tocLevel: 2 },
      { title: "1\" 250psi rubber hose", tocLevel: 1 },
      { title: "1\" S.S. hose clamp", tocLevel: 1 },
      { title: "3M-12 wrap brush", tocLevel: 1 },
      { title: "Series 3000 wrap brush configuration - 12' Veh. Clr.", tocLevel: 2 },
      { title: "Wrap brush adjustment", tocLevel: 2 },
      { title: "Medium duty flange coupler", tocLevel: 2 },
      { title: "Medium duty flange coupler installation", tocLevel: 2 },
      { title: "3M dual roof mop", tocLevel: 1 }
    ]
  },
  {
    id: "activation-eyes",
    name: "Activation Eyes",
    entries: [
      { title: "Activation Eyes", tocLevel: 0 },
      { title: "Activation Sensors", tocLevel: 1 },
      { title: "Entrance Light", tocLevel: 1 },
      { title: "Signal Light", tocLevel: 1 }
    ]
  },
  {
    id: "brush-module-5m-400",
    name: "Brush module 5M-400",
    entries: [
      { title: "Brush module 5M-400", tocLevel: 0 },
      { title: "2hp system-5M brush motor", tocLevel: 1 },
      { title: "5M gear reducer (15:1 & 40:1 ratios)", tocLevel: 1 },
      { title: "1-1/2\" 2-bolt heavy duty bearing", tocLevel: 1 },
      { title: "5M-400-12.5 spray pipe", tocLevel: 1 },
      { title: "5010 brass 1/4\" mnpt nozzle", tocLevel: 2 },
      { title: "5M-12.5 ECO-motion bristle wrap brush", tocLevel: 1 },
      { title: "wrap brush adjustment", tocLevel: 2 },
      { title: "Heavy duty flange coupler", tocLevel: 2 },
      { title: "Heavy duty flange coupler installation", tocLevel: 2 },
      { title: "13-1/2\" shock absorber", tocLevel: 2 },
      { title: "alum. 5M angled 50-slotted rack", tocLevel: 1 }
    ]
  },
  {
    id: "brush-module-5m-420",
    name: "Brush Module 5M-420",
    entries: [
      { title: "Brush Module 5M-420", tocLevel: 0 },
      { title: "2hp 5M brush motor", tocLevel: 1 },
      { title: "5M 15:1 ratio & 40:1 ratio gear reducers", tocLevel: 1 },
      { title: "1.5\" 2-bolt heavy duty bearing", tocLevel: 1 },
      { title: "5M-420 spray pipes", tocLevel: 1 },
      { title: "5010 brass 1/4\" mnpt nozzle", tocLevel: 2 },
      { title: "5M-12.5 ECO-motion bristle wrap-brush", tocLevel: 1 },
      { title: "Heavy duty flange coupler", tocLevel: 2 },
      { title: "13-1/2\" shock absorber", tocLevel: 2 },
      { title: "5M-12.5 ECO-motion bristle side-brush", tocLevel: 1 },
      { title: "Flange coupler", tocLevel: 2 },
      { title: "5M-420 heavy duty flange coupler & flange couple - installation", tocLevel: 1 },
      { title: "Alum. 5M angled 50-slotted rack", tocLevel: 1 }
    ]
  },
  {
    id: "brush-module-3250",
    name: "Brush module 3250",
    entries: [
      { title: "Brush module 3250", tocLevel: 0 },
      { title: "1.5hp 3M brush motor", tocLevel: 1 },
      { title: "3M 15:1 ratio gear reducer & 3M 40:1 ratio gear reducer", tocLevel: 1 },
      { title: "1.5\" 2-bolt normal duty bearing", tocLevel: 1 },
      { title: "Brush module 3250-14 spray pipes", tocLevel: 1 },
      { title: "5010 brass 1/4\" mnpt nozzle", tocLevel: 2 },
      { title: "3M-14 ECO-motion bristle wrap-brush", tocLevel: 1 },
      { title: "13.5\" shock absorber", tocLevel: 2 },
      { title: "3M wrap brush stabilizer & 13.5\" shock absorber", tocLevel: 2 },
      { title: "Medium duty flange coupler", tocLevel: 2 },
      { title: "3M-14 ECO-motion bristle side-brush", tocLevel: 1 },
      { title: "Flange coupler", tocLevel: 2 },
      { title: "Brush module 3250 - flange couplers - installation", tocLevel: 1 },
      { title: "3M dual roof mop - straight & angled racks", tocLevel: 1 }
    ]
  }
];


/* --------------------------------------------------------------------------
   Shared dialogs, imports, and uploaded-PDF normalization
   -------------------------------------------------------------------------- */

function normalizeDuplicateName(value = "") {
  return String(value)
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function promptDuplicatePDFAction(fileName, existingItem) {
  const existingName = existingItem?.displayTitle || existingItem?.fileName || "existing PDF";
  return await showChoiceModal({
    title: "Duplicate PDF",
    message: `A PDF named "${fileName}" already exists as "${existingName}".`,
    actions: [
      { label: "Replace Existing", value: "replace" },
      { label: "Add Both", value: "add", className: "secondary" },
      { label: "Skip", value: "skip", className: "remove-pdf-btn" }
    ]
  }) || "skip";
}

async function promptDuplicateTOCEntryAction(title, existingEntry) {
  const existingName = existingEntry?.title || "existing TOC entry";
  return await showChoiceModal({
    title: "Duplicate TOC Entry",
    message: `A TOC entry named "${title}" already exists as "${existingName}".`,
    actions: [
      { label: "Replace Existing", value: "replace" },
      { label: "Add Both", value: "add", className: "secondary" },
      { label: "Skip", value: "skip", className: "remove-pdf-btn" }
    ]
  }) || "skip";
}

function openAppModal({
  title = "Action Needed",
  message = "",
  input = null,
  actions = []
} = {}) {
  return new Promise(resolve => {
    const modal = document.getElementById("appPromptModal");
    const titleEl = document.getElementById("appPromptTitle");
    const messageEl = document.getElementById("appPromptMessage");
    const inputGroup = document.getElementById("appPromptInputGroup");
    const inputLabel = document.getElementById("appPromptInputLabel");
    const inputEl = document.getElementById("appPromptInput");
    const actionsEl = document.getElementById("appPromptActions");

    if (!modal || !titleEl || !messageEl || !inputGroup || !inputLabel || !inputEl || !actionsEl) {
      resolve(null);
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    actionsEl.innerHTML = "";

    inputGroup.classList.toggle("hidden", !input);
    if (input) {
      inputLabel.textContent = input.label || "Value";
      inputEl.type = input.type || "text";
      inputEl.value = input.value || "";
      inputEl.placeholder = input.placeholder || "";
    } else {
      inputEl.value = "";
    }

    const close = result => {
      modal.classList.add("hidden");
      actionsEl.innerHTML = "";
      resolve(result);
    };

    actions.forEach(action => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      if (action.className) button.className = action.className;
      button.addEventListener("click", () => {
        close({
          action: action.value,
          value: input ? inputEl.value : ""
        });
      });
      actionsEl.appendChild(button);
    });

    modal.classList.remove("hidden");
    if (input) {
      inputEl.focus();
      inputEl.select();
      inputEl.onkeydown = event => {
        if (event.key === "Enter" && actions[0]) {
          close({ action: actions[0].value, value: inputEl.value });
        }
      };
    } else {
      inputEl.onkeydown = null;
    }
  });
}

async function showTextModal({ title, message, label, value = "", placeholder = "", confirmLabel = "Save" }) {
  const result = await openAppModal({
    title,
    message,
    input: { label, value, placeholder },
    actions: [
      { label: confirmLabel, value: "confirm" },
      { label: "Cancel", value: "cancel", className: "secondary" }
    ]
  });

  return result?.action === "confirm" ? result.value : null;
}

async function showChoiceModal({ title, message, actions }) {
  const result = await openAppModal({ title, message, actions });
  return result?.action || null;
}

async function showMessageModal(title, message) {
  await openAppModal({
    title,
    message,
    actions: [{ label: "OK", value: "ok" }]
  });
}

async function showConfirmModal(title, message, confirmLabel = "Continue") {
  const result = await openAppModal({
    title,
    message,
    actions: [
      { label: confirmLabel, value: "confirm" },
      { label: "Cancel", value: "cancel", className: "secondary" }
    ]
  });

  return result?.action === "confirm";
}
const pdfUpload = document.getElementById("pdfUpload");
if (pdfUpload) {
  pdfUpload.addEventListener("change", handlePDFUpload);
}

function getPacketPDFJSOptions(data) {
  return {
    data,
    cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/",
    verbosity: pdfjsLib.VerbosityLevel?.ERRORS ?? 0
  };
}


function importSpecificationProjectFields() {
  if (new URLSearchParams(window.location.search).get("fromSpec") !== "1") return;
  try {
    const fields = JSON.parse(localStorage.getItem("ns-specification-packet-transfer-v1") || "null");
    if (!fields) return;
    ["projectNumber", "projectName", "washType", "systemName", "revision"].forEach(id => {
      const field = document.getElementById(id);
      if (field && fields[id] != null) field.value = fields[id];
    });
    setPacketDraftStatus("Specification project information imported. Autosave is on.", "is-saved");
    schedulePacketDraftAutosave();
  } catch (error) {
    console.warn("Could not import specification project information:", error);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const dropZone = document.getElementById("dropZone");
  renderPacketHistory();
  setupBuilderHistoryControls();
  await restorePacketDraft();
  setupPacketDraftAutosave();
  importSpecificationProjectFields();
  importPendingDatabasePDFsForBuilder();

  if (!dropZone) return;

  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    handleDroppedFiles(e.dataTransfer.files);
  });
});


function handlePDFUpload(event) {
  handleDroppedFiles(event.target.files);
}

async function handleDroppedFiles(fileList) {
  const files = Array.from(fileList)
    .filter(file => file.type === "application/pdf");
  let addedFileCount = 0;
  let replacedFileCount = 0;
  let skippedFileCount = 0;

  for (const file of files) {
    const cleanName = file.name.replace(/\.pdf$/i, "");
    const fileSignature = `${file.name}|${file.size}|${file.lastModified}`;
    const duplicateItem = pdfLibrary.find(item => {
      const itemSignature = `${item.fileName || item.file?.name}|${item.file?.size}|${item.file?.lastModified}`;
      const sameSignature = itemSignature === fileSignature;
      const sameName = normalizeDuplicateName(item.displayTitle || item.fileName) === normalizeDuplicateName(cleanName);
      return sameSignature || sameName;
    });

    const newItem = {
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      uploadDate: new Date(file.lastModified || Date.now()).toLocaleDateString(),
      displayTitle: cleanName,
      documentType: guessDocumentType(file.name),
      packetSection: guessPacketSection(file.name),
      tocLevel: 0,
      include: true,
      notes: "",
      datasheetOrder: null,
      tocEntries: [],
      tocEntriesReviewed: false,
      hideParentTOC: false
    };

    if (duplicateItem) {
      const action = await promptDuplicatePDFAction(cleanName, duplicateItem);

      if (action === "skip") {
        skippedFileCount += 1;
        continue;
      }

      if (action === "replace") {
        const previousTOCEntries = duplicateItem.tocEntries || [];
        const hasOnlyScannedEntries =
          previousTOCEntries.length > 0 &&
          previousTOCEntries.every(entry => entry.detectedTOCEntry);
        const keepPreviousTOCEntries = previousTOCEntries.length > 0 && !hasOnlyScannedEntries;

        Object.assign(duplicateItem, {
          ...newItem,
          id: duplicateItem.id,
          tocEntries: keepPreviousTOCEntries ? previousTOCEntries : [],
          tocEntriesReviewed: keepPreviousTOCEntries ? !!duplicateItem.tocEntriesReviewed : false,
          hideParentTOC: !!duplicateItem.hideParentTOC,
          include: true
        });
        replacedFileCount += 1;
        continue;
      }
    }

    pdfLibrary.push(newItem);
    addedFileCount += 1;
  }

  if (addedFileCount > 0 || replacedFileCount > 0) {
    warrantyPromptHandled = false;
    packetLargeBuildConfirmed = false;
  }

  sortLibraryBySection();
  renderUploadedPdfList();

  const statusParts = [];
  if (addedFileCount > 0) statusParts.push(`${addedFileCount} PDF(s) added`);
  if (replacedFileCount > 0) statusParts.push(`${replacedFileCount} PDF(s) replaced`);
  if (skippedFileCount > 0) statusParts.push(`${skippedFileCount} duplicate PDF(s) skipped`);

  if (statusParts.length > 0) {
    updateUploadedPdfCount(`${statusParts.join(". ")}. ${pdfLibrary.length} total.`);
  } else if (files.length > 0) {
    updateUploadedPdfCount("No PDFs added.");
  }
}

function guessDocumentType(fileName) {
  return guessDocumentTypeFromName(fileName);
}

function guessPacketSection(fileName) {
  return guessPacketSectionFromName(fileName);
}

function normalizePacketTOCLevel(value) {
  const level = Number(value);
  return [0, 1, 2].includes(level) ? level : 0;
}

function getPDFParentTOCLevel(item) {
  return normalizePacketTOCLevel(item?.tocLevel);
}

function normalizeBuilderTOCEntry(entry = {}) {
  const tocLevel = normalizePacketTOCLevel(entry.tocLevel);

  return {
    ...entry,
    id: entry.id || crypto.randomUUID(),
    title: String(entry.title || "").trim(),
    sourcePage: Number(entry.sourcePage || 1),
    entryType: tocLevel === 0 ? "section" : "subsection",
    tocLevel,
    parentId: tocLevel === 0 ? "" : entry.parentId || "",
    detectedTOCEntry: !!entry.detectedTOCEntry
  };
}

function normalizeImportedBuilderTOCEntries(item) {
  if (!item || !Array.isArray(item.tocEntries)) return;

  item.tocEntries = item.tocEntries.map(normalizeBuilderTOCEntry);

  item.tocEntries.forEach(entry => {
    const level = normalizePacketTOCLevel(entry.tocLevel);

    if (
      level > 0 &&
      !entry.parentId &&
      level - 1 === getPDFParentTOCLevel(item) &&
      !item.hideParentTOC
    ) {
      entry.parentId = PDF_PARENT_TOC_ID;
    }
  });

  cleanInvalidTOCParents(item);
  item.tocEntries.sort(compareTOCEntries);
}

async function importPendingDatabasePDFsForBuilder() {
  if (typeof getBuilderHandoffItems !== "function") return;

  const target = getPacketHistoryType();
  let handoffItems = [];

  try {
    handoffItems = await getBuilderHandoffItems(target);
  } catch (error) {
    console.warn("Could not read database builder handoff:", error);
    return;
  }

  if (!handoffItems.length) return;

  const importedIds = [];
  let addedCount = 0;
  let skippedCount = 0;

  handoffItems.forEach(entry => {
    importedIds.push(entry.id);

    if (!entry.blob) {
      skippedCount += 1;
      return;
    }

    const fileName = entry.fileName || "database-file.pdf";
    const cleanName = fileName.replace(/\.pdf$/i, "");
    const duplicateItem = pdfLibrary.find(item =>
      normalizeDuplicateName(item.displayTitle || item.fileName) ===
      normalizeDuplicateName(entry.displayTitle || cleanName)
    );

    if (duplicateItem) {
      skippedCount += 1;
      return;
    }

    const file = new File([entry.blob], fileName, {
      type: "application/pdf",
      lastModified: entry.createdAt || Date.now()
    });

    const importedItem = {
      id: crypto.randomUUID(),
      file,
      fileName,
      uploadDate: new Date(entry.createdAt || Date.now()).toLocaleDateString(),
      displayTitle: entry.displayTitle || cleanName,
      documentType: entry.documentType || guessDocumentType(fileName),
      packetSection: entry.packetSection || guessPacketSection(fileName),
      tocLevel: normalizePacketTOCLevel(entry.tocLevel),
      include: true,
      notes: entry.notes || "",
      datasheetOrder: null,
      tocEntries: Array.isArray(entry.tocEntries)
        ? entry.tocEntries.map(tocEntry => ({ ...tocEntry }))
        : [],
      tocEntriesReviewed: Array.isArray(entry.tocEntries) && entry.tocEntries.length > 0,
      hideParentTOC: !!entry.hideParentTOC,
      sourceLibraryId: entry.sourceLibraryId || ""
    };

    normalizeImportedBuilderTOCEntries(importedItem);
    pdfLibrary.push(importedItem);
    addedCount += 1;
  });

  if (typeof removeBuilderHandoffItems === "function") {
    try {
      await removeBuilderHandoffItems(importedIds);
    } catch (error) {
      console.warn("Could not clear database builder handoff:", error);
    }
  }

  if (addedCount > 0) {
    warrantyPromptHandled = false;
    sortLibraryBySection();
    renderUploadedPdfList();
  }

  const statusParts = [];
  if (addedCount > 0) statusParts.push(`${addedCount} database PDF(s) added`);
  if (skippedCount > 0) statusParts.push(`${skippedCount} database PDF(s) skipped`);

  if (statusParts.length > 0) {
    updateUploadedPdfCount(`${statusParts.join(". ")}. ${pdfLibrary.length} total.`);
  }
}

function sortLibraryBySection() {
  pdfLibrary.sort((a, b) => {
    if (a.packetSection !== b.packetSection) {
      return sectionOrder[a.packetSection] - sectionOrder[b.packetSection];
    }

    return getSectionFileOrder(a) - getSectionFileOrder(b);
  });
}

function getSectionFileOrder(item) {
  return Number.isFinite(Number(item?.datasheetOrder))
    ? Number(item.datasheetOrder)
    : 999;
}

async function renameTOCSections() {
  let sectionRenameUndoRecorded = false;
  const isOM =
    typeof isOMPacket === "function" &&
    isOMPacket();

  const sections = isOM
    ? OM_SECTION_ORDER
    : [
        "Warranty",
        "Datasheets",
        "Control Panel Components",
        "Shop Drawings",
        "Appendix"
      ];

  for (const section of sections) {
    const currentName = customSectionLabels[section] || section;

    const newName = await showTextModal({
      title: "Rename Roman Section",
      message: `Rename TOC section "${section}".`,
      label: "Section name",
      value: currentName,
      confirmLabel: "Save"
    });

    if (newName === null) continue;

    const cleanName = newName.trim();

    if (cleanName) {
      if (!sectionRenameUndoRecorded) {
        recordBuilderUndoState();
        sectionRenameUndoRecorded = true;
      }
      customSectionLabels[section] = cleanName;
    }
  }

  refreshSectionLabelDisplays();
  await showMessageModal("Section Names Updated", "Section names updated for this packet.");
}

function getSectionLabel(section) {
  return customSectionLabels[section] || section;
}

function refreshSectionLabelDisplays() {
  renderUploadedPdfList();

  const warrantyPrompt = document.getElementById("warrantyPromptModal");
  if (warrantyPrompt && !warrantyPrompt.classList.contains("hidden")) {
    const createWarranty =
      document.getElementById("createWarrantySheet")?.checked || false;
    renderBuildSummary("buildSummary", { createWarranty });
  }

  const orderModal = document.getElementById("datasheetOrderModal");
  if (orderModal && !orderModal.classList.contains("hidden")) {
    const sectionGroups = getSectionsNeedingOrganization();
    if (sectionGroups.length > 0) {
      openSectionOrderModal(sectionGroups);
    } else {
      renderBuildSummary("datasheetBuildSummary");
    }
  }
}

function toRoman(value) {
  const numerals = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let remaining = Math.max(1, Number(value) || 1);
  let result = "";

  numerals.forEach(([number, numeral]) => {
    while (remaining >= number) {
      result += numeral;
      remaining -= number;
    }
  });

  return result;
}

function toLowerRoman(value) {
  return toRoman(value).toLowerCase();
}

async function renamePdfTitle(id) {
  const item = pdfLibrary.find(x => x.id === id);
  if (!item) return;

  const newTitle = await showTextModal({
    title: "Rename TOC Name",
    message: "Enter the name you want shown in the Table of Contents.",
    label: "TOC name",
    value: item.displayTitle,
    confirmLabel: "Save"
  });

  if (newTitle === null) return;

  const cleanTitle = newTitle.trim();

  if (!cleanTitle) {
    await showMessageModal("TOC Name Required", "The TOC name cannot be blank.");
    return;
  }

    recordBuilderUndoState();
    item.displayTitle = cleanTitle;

    const detectedSection = guessPacketSection(cleanTitle);
    const detectedType = guessDocumentType(cleanTitle);
    const previousSection = item.packetSection;

    item.packetSection = detectedSection;
    item.documentType = detectedType;

    if (previousSection !== detectedSection) {
      const entries = item.tocEntries || [];
      const hasOnlyScannedEntries = entries.length > 0 && entries.every(entry => entry.detectedTOCEntry);
      if (hasOnlyScannedEntries) {
        item.tocEntries = [];
        item.tocEntriesReviewed = false;
      } else if (entries.length === 0) {
        item.tocEntriesReviewed = false;
      }
    }

    if (detectedSection !== "Datasheets") {
      item.datasheetOrder = null;
    }

    sortLibraryBySection();
    renderUploadedPdfList();
}

function updateUploadedPDFSection(id, newSection) {
  const item = pdfLibrary.find(x => x.id === id);
  if (!item) return;

  if (item.packetSection === newSection) return;

  recordBuilderUndoState();
  const previousSection = item.packetSection;
  item.packetSection = newSection;
  item.documentType = guessDocumentType(newSection);

  if (previousSection !== newSection) {
    const entries = item.tocEntries || [];
    const hasOnlyScannedEntries = entries.length > 0 && entries.every(entry => entry.detectedTOCEntry);
    if (hasOnlyScannedEntries) {
      item.tocEntries = [];
      item.tocEntriesReviewed = false;
    } else if (entries.length === 0) {
      item.tocEntriesReviewed = false;
    }
  }

  if (newSection !== "Datasheets") {
    item.datasheetOrder = null;
  }

  sortLibraryBySection();
  renderUploadedPdfList();
}

function updateUploadedPDFTOCLevel(id, newLevel) {
  const item = pdfLibrary.find(x => x.id === id);
  if (!item) return;

  const cleanLevel = normalizePacketTOCLevel(newLevel);
  if (getPDFParentTOCLevel(item) === cleanLevel) return;

  recordBuilderUndoState();
  item.tocLevel = cleanLevel;
  cleanInvalidTOCParents(item);
  renderUploadedPdfList();
}

async function downloadUploadedPacketPDF(id) {
  const item = pdfLibrary.find(entry => entry.id === id);
  if (!item?.file) {
    await showMessageModal("PDF Not Found", "This uploaded PDF is no longer available in the builder.");
    return;
  }

  try {
    const fileName = item.fileName || item.file.name || `${item.displayTitle || "Uploaded PDF"}.pdf`;
    downloadFile(item.file, fileName, "application/pdf");
    updateUploadedPdfCount(`Download requested: ${fileName}. ${pdfLibrary.length} PDF(s) remain in the builder.`);
  } catch (error) {
    console.error("Could not download uploaded packet PDF:", error);
    await showMessageModal(
      "Download Failed",
      `${error?.message || "Could not download this PDF."} The builder has not been cleared.`
    );
  }
}

function renderUploadedPdfList() {
  const container = document.getElementById("uploadedPdfList");
  if (!container) return;

  container.innerHTML = "";

  pdfLibrary.forEach(item => {
    const row = document.createElement("div");
    row.className = "uploaded-pdf-row";

    const canFormatTOC = true;
    const sectionOptions = packetSections
      .filter(section =>
        !["Cover Page", "Table of Contents"].includes(section)
      )
      .map(section => `
        <option value="${section}" ${section === item.packetSection ? "selected" : ""}>
          ${getSectionLabel(section)}
        </option>
      `)
      .join("");
    const subsectionButton = canFormatTOC
      ? `
        <button onclick="openSubsectionModal('${item.id}')">
          Format Levels
        </button>
      `
      : "";

    const subsectionCount = canFormatTOC
      ? `
        <div class="subsection-count">
          ${formatTOCEntryCount(item.tocEntries || [])}
        </div>
      `
      : "";

    row.innerHTML = `
      <div>
        <div class="uploaded-pdf-name">
          ${item.fileName}
        </div>

        <div class="uploaded-pdf-title">
          TOC Name: ${item.displayTitle}
        </div>

        <label class="uploaded-pdf-section">
          Roman Section:
          <select onchange="updateUploadedPDFSection('${item.id}', this.value)">
            ${sectionOptions}
          </select>
        </label>

        ${subsectionCount}
      </div>

      <div class="button-row">
        <button onclick="renamePdfTitle('${item.id}')">
          Rename File
        </button>

        ${subsectionButton}

        <button onclick="downloadUploadedPacketPDF('${item.id}')">
          Download
        </button>

        <button
          class="remove-pdf-btn"
          onclick="removeUploadedPDF('${item.id}')">
          Remove
        </button>
      </div>
    `;

    container.appendChild(row);
  });

  updateUploadedPdfCount();
}

function updateUploadedPdfCount(message = "") {
  const countEl = document.getElementById("uploadedPdfCount");
  if (!countEl) return;

  if (message) {
    countEl.textContent = message;
    return;
  }

  const total = pdfLibrary.length;

  if (total === 0) {
    countEl.textContent = "";
    return;
  }

  const included = pdfLibrary.filter(item => item.include !== false).length;
  const tocCounts = pdfLibrary.reduce(
    (counts, item) => {
      const itemCounts = getTOCEntryCounts(item.tocEntries || []);
      counts.total += itemCounts.total;
      return counts;
    },
    { total: 0 }
  );

  countEl.textContent =
    `${total} PDF(s) uploaded | ${included} included | ${tocCounts.total} level(s)`;
}

function getTOCEntryCounts(entries = []) {
  return entries.reduce(
    (counts, entry) => {
      const level = normalizePacketTOCLevel(entry.tocLevel);
      counts.total += 1;
      counts.levels[level] += 1;
      return counts;
    },
    { total: 0, levels: [0, 0, 0] }
  );
}

function formatTOCEntryCount(entries = []) {
  const counts = getTOCEntryCounts(entries);
  return `${counts.total} level(s)`;
}

function removeUploadedPDF(id) {
  recordBuilderUndoState();
  const removedItem = pdfLibrary.find(item => item.id === id);
  pdfLibrary = pdfLibrary.filter(item => item.id !== id);

  if (removedItem?.packetSection === "Warranty") {
    warrantyPromptHandled = false;
  }

  renderUploadedPdfList();
  updateUploadedPdfCount(`Removed 1 PDF. ${pdfLibrary.length} total.`);
}

async function clearUploadedPDFs() {
  if (!(await showConfirmModal("Clear Uploaded PDFs", "Clear all uploaded PDFs from the packet builder?", "Clear"))) return;

  recordBuilderUndoState();
  pdfLibrary = [];

  const pdfUpload = document.getElementById("pdfUpload");
  if (pdfUpload) {
    pdfUpload.value = "";
  }

  const modal = document.getElementById("datasheetOrderModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  pendingBuild = false;
  finalBuildPreviewAccepted = false;
  finalBuildPreviewCache = null;
  warrantyPromptHandled = false;
  renderUploadedPdfList();
  updatePacketBuildStatus();
}
async function drawGeneratedCoverPage(pdfDoc) {
  const page = pdfDoc.addPage([612, 792]);

  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const projectName = document.getElementById("projectName")?.value || "";
  const projectLocation = document.getElementById("projectLocation")?.value || "";
  const washType = document.getElementById("washType")?.value || "Car Wash";
  const systemName = document.getElementById("systemName")?.value || "";
  const revision = document.getElementById("revision")?.value || "0";
  const dateMade = new Date().toLocaleDateString();

  const usableWidth = 425;
  const logoX = 430;

  try {
    const logoBytes = await loadCoverPageAsset("NSCoverLogo.png");
    const logoImage = await pdfDoc.embedPng(logoBytes);

    page.drawImage(logoImage, {
      x: logoX,
      y: 0,
      width: 182,
      height: 792
    });
  } catch (err) {
    console.warn("Unable to load cover page logo.", err);
  }

  function splitTextToFit(text, font, size, maxWidth) {
    const words = String(text).split(" ");
    const lines = [];
    let currentLine = "";

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  function centerWrappedText(text, startY, size, font, lineGap = 28) {
    const lines = splitTextToFit(text, font, size, usableWidth - 40);
    let y = startY;

    lines.forEach(line => {
      const textWidth = font.widthOfTextAtSize(line, size);

      page.drawText(line, {
        x: (usableWidth - textWidth) / 2,
        y,
        size,
        font,
        color: rgb(0, 0, 0)
      });

      y -= lineGap;
    });

    return y;
  }

  let y = 675;

  y = centerWrappedText(projectName, y, 22, timesBold, 28);
  y = centerWrappedText(washType, y - 8, 22, timesBold, 28);

  if (projectLocation) {
    centerWrappedText(projectLocation, y - 5, 18, times, 22);
  }

  const packetTitle =
    typeof getPacketTitle === "function"
      ? getPacketTitle()
      : "Product Submittal";

  const titleSize =
    packetTitle === "Operation & Maintenance Manual"
      ? 18
      : 22;

  centerWrappedText(
    packetTitle,
    465,
    titleSize,
    timesBold,
    28
  );

  centerWrappedText(systemName, 250, 20, timesBold, 24);
  centerWrappedText("Vehicle Wash System", 220, 18, timesBold, 22);

  page.drawText("By N/S Corporation", {
    x: 25,
    y: 120,
    size: 18,
    font: timesBold
  });

  page.drawText("28309 Avenue Crocker,", {
    x: 25,
    y: 98,
    size: 12,
    font: times
  });

  page.drawText("Valencia, CA 91355", {
    x: 25,
    y: 82,
    size: 12,
    font: times
  });

  page.drawText(`Revision: ${revision}`, {
    x: 25,
    y: 42,
    size: 12,
    font: times
  });

  page.drawText(dateMade, {
    x: 25,
    y: 25,
    size: 12,
    font: times
  });

  return page;
}

async function drawSectionDividerPage(pdfDoc, sectionTitle, packetSection = "") {
  let page;

  try {
    if (!romanCoverPageBytesPromise) {
      romanCoverPageBytesPromise = loadCoverPageAsset("RomanCoverPage.pdf");
    }

    const templateBytes = await romanCoverPageBytesPromise;
    const templatePdf = await PDFDocument.load(templateBytes);
    const [templatePage] = await pdfDoc.copyPages(templatePdf, [0]);

    page = pdfDoc.addPage(templatePage);
  } catch (error) {
    console.warn("Roman cover divider missing. Using plain divider page.", error);
    romanCoverPageBytesPromise = null;
    page = pdfDoc.addPage([612, 792]);
  }

  if (packetSection) {
    const PDFName = window.PDFLib.PDFName;
    const PDFString = window.PDFLib.PDFString;
    page.node.set(
      PDFName.of("PacketSection"),
      PDFString.of(packetSection)
    );
  }

  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const { width, height } = page.getSize();

  function splitTextToFit(text, font, size, maxWidth) {
    const words = String(text).split(" ");
    const lines = [];
    let currentLine = "";

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  function drawCenteredWrappedText(text) {
    let size = 28;
    let lines = splitTextToFit(text, timesBold, size, width - 100);

    while (lines.length > 4 && size > 16) {
      size -= 2;
      lines = splitTextToFit(text, timesBold, size, width - 100);
    }

    const lineGap = size + 8;
    const totalHeight = lines.length * lineGap;
    let y = (height / 2) + (totalHeight / 2) - lineGap;

    lines.forEach(line => {
      const textWidth = timesBold.widthOfTextAtSize(line, size);

      page.drawText(line, {
        x: (width - textWidth) / 2,
        y,
        size,
        font: timesBold,
        color: rgb(0, 0, 0)
      });

      y -= lineGap;
    });
  }

  drawCenteredWrappedText(sectionTitle);

  return page;
}
