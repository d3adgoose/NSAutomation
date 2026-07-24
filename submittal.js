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

/* --------------------------------------------------------------------------
   Build progress, autosave, local history, and undo/redo
   -------------------------------------------------------------------------- */

function getPacketBuildLabel() {
  return typeof isOMPacket === "function" && isOMPacket()
    ? "O&M manual"
    : "Submittal packet";
}

let packetBuildStartedAt = 0;
let packetBuildTimer = null;
let packetLastBuildMessage = "";
let lastPacketDownloadData = null;

function formatPacketBuildElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function updatePacketBuildElapsed() {
  if (!packetBuildStartedAt) return;
  const elapsedText = formatPacketBuildElapsed(performance.now() - packetBuildStartedAt);
  const mainElapsed = document.getElementById("packetBuildElapsed");
  const previewElapsed = document.getElementById("packetPreviewElapsed");
  if (mainElapsed) mainElapsed.textContent = elapsedText;
  if (previewElapsed) previewElapsed.textContent = `Elapsed ${elapsedText}`;
}

function recordPacketBuildMessage(message) {
  if (!message || message === packetLastBuildMessage) return;
  packetLastBuildMessage = message;
  const elapsedText = packetBuildStartedAt
    ? formatPacketBuildElapsed(performance.now() - packetBuildStartedAt)
    : "ready";
  ["packetBuildHistory", "packetPreviewBuildHistory"].forEach(id => {
    const history = document.getElementById(id);
    if (!history) return;
    const item = document.createElement("li");
    const time = document.createElement("time");
    const text = document.createElement("span");
    time.textContent = elapsedText;
    text.textContent = message;
    item.append(time, text);
    history.appendChild(item);
    while (history.children.length > 40) history.firstElementChild?.remove();
  });
}

function startPacketBuildTimer(message) {
  packetBuildStartedAt = performance.now();
  packetLastBuildMessage = "";
  document.getElementById("packetBuildHistory")?.replaceChildren();
  document.getElementById("packetPreviewBuildHistory")?.replaceChildren();
  document.getElementById("packetBuildProgress")?.classList.remove("hidden");
  clearInterval(packetBuildTimer);
  updatePacketBuildElapsed();
  packetBuildTimer = setInterval(updatePacketBuildElapsed, 250);
  updatePacketBuildStatus(message);
}

function stopPacketBuildTimer() {
  if (!packetBuildStartedAt) return;
  updatePacketBuildElapsed();
  clearInterval(packetBuildTimer);
  packetBuildTimer = null;
  packetBuildStartedAt = 0;
}

function setPacketDownloadRetryAvailable(isAvailable) {
  document.getElementById("retryPacketDownloadButton")?.classList.toggle("hidden", !isAvailable);
}

function requestPacketDownload(pdfBytes, outputName) {
  lastPacketDownloadData = { pdfBytes, outputName };
  setPacketDownloadRetryAvailable(true);

  if (navigator.userActivation && !navigator.userActivation.isActive) {
    updatePacketBuildStatus(
      "Download warning: browser click permission was no longer active. Use Retry download if the file does not appear."
    );
  }

  try {
    downloadFile(pdfBytes, outputName, "application/pdf");
    updatePacketBuildStatus(
      `Download requested: ${outputName}. If it does not appear, use Retry download.`
    );
  } catch (error) {
    const message = `Download failed to start: ${error?.message || "Browser download error."}`;
    console.error(message, error);
    updatePacketBuildStatus(message);
    throw new Error(message);
  }
}

function retryLastPacketDownload() {
  if (!lastPacketDownloadData) {
    updatePacketBuildStatus("No completed PDF is available to retry.");
    return;
  }

  try {
    downloadFile(
      lastPacketDownloadData.pdfBytes,
      lastPacketDownloadData.outputName,
      "application/pdf"
    );
    updatePacketBuildStatus(
      `Download requested again: ${lastPacketDownloadData.outputName}. Check the browser downloads list.`
    );
  } catch (error) {
    const message = `Retry failed: ${error?.message || "Browser download error."}`;
    console.error(message, error);
    updatePacketBuildStatus(message);
    showMessageModal("Download Failed", `${message} Check browser download permissions for this site.`);
  }
}

function updatePacketBuildStatus(message = "") {
  const status = document.getElementById("packetBuildStatus");
  if (!status) return;

  status.textContent = message || "";
  document.getElementById("packetBuildProgress")?.classList.toggle(
    "hidden",
    !message && !packetBuildStartedAt
  );
  recordPacketBuildMessage(message);
}

function getBuildErrorMessage(buildLabel, error, context = "") {
  const reason = error?.message || "Please try again.";
  return context
    ? `${buildLabel} could not be built while ${context}. ${reason}`
    : `${buildLabel} could not be built. ${reason}`;
}

const PACKET_HISTORY_DB_NAME = "ns-packet-history";
const PACKET_HISTORY_STORE_NAME = "packets";
const PACKET_HISTORY_LIMIT = 3;
const PACKET_DRAFT_AUTOSAVE_DELAY = 900;
let packetDraftAutosaveTimer = null;
let packetDraftReady = false;
let packetDraftSavePromise = Promise.resolve();
let packetLargeBuildConfirmed = false;

function getPacketDraftId() {
  return `draft-${getPacketHistoryType()}`;
}

function getPacketDraftFormState() {
  const fields = {};
  document.querySelectorAll("input[id], select[id], textarea[id]").forEach(field => {
    if (field.type === "file" || field.id.startsWith("appPrompt")) return;
    fields[field.id] = field.type === "checkbox" || field.type === "radio"
      ? { checked: field.checked, value: field.value }
      : { value: field.value };
  });
  return fields;
}

function applyPacketDraftFormState(fields = {}) {
  Object.entries(fields).forEach(([id, state]) => {
    const field = document.getElementById(id);
    if (!field || field.type === "file") return;
    if (field.type === "checkbox" || field.type === "radio") {
      field.checked = !!state.checked;
    } else {
      field.value = state.value ?? "";
    }
  });
}

function setPacketDraftStatus(message, className = "") {
  const status = document.getElementById("draftSaveStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `draft-save-status${className ? ` ${className}` : ""}`;
}

async function savePacketDraft({ manual = false } = {}) {
  if (!packetDraftReady && !manual) return;
  clearTimeout(packetDraftAutosaveTimer);
  const snapshot = getLivePacketBuilderSnapshot();
  const entry = {
    id: getPacketDraftId(),
    type: `draft-${getPacketHistoryType()}`,
    updatedAt: Date.now(),
    builderState: snapshot,
    formFields: getPacketDraftFormState()
  };

  setPacketDraftStatus(manual ? "Saving progress..." : "Autosaving...", "is-saving");
  packetDraftSavePromise = packetDraftSavePromise.catch(() => {}).then(() =>
    runPacketHistoryTransaction("readwrite", store => store.put(entry))
  );

  try {
    await packetDraftSavePromise;
    const time = new Date(entry.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setPacketDraftStatus(`${manual ? "Progress saved" : "Autosaved"} at ${time}.`, "is-saved");
  } catch (error) {
    console.warn("Could not save packet draft:", error);
    const storageFull = error?.name === "QuotaExceededError" || /quota|storage|space/i.test(error?.message || "");
    setPacketDraftStatus(
      storageFull
        ? "Browser storage is full. Clear local history, then try Save Progress again."
        : "Progress could not be saved. Try Save Progress again.",
      "is-error"
    );
    updatePacketStorageStatus();
  }
}

function schedulePacketDraftAutosave() {
  if (!packetDraftReady) return;
  clearTimeout(packetDraftAutosaveTimer);
  packetDraftAutosaveTimer = setTimeout(() => savePacketDraft(), PACKET_DRAFT_AUTOSAVE_DELAY);
}

async function restorePacketDraft() {
  try {
    const draft = await getPacketHistoryItem(getPacketDraftId());
    if (!draft?.builderState) return;
    applyPacketBuilderSnapshot(draft.builderState);
    applyPacketDraftFormState(draft.formFields);
    renderUploadedPdfList();
    const time = new Date(draft.updatedAt || draft.builderState.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setPacketDraftStatus(`Saved progress restored from ${time}. Autosave is on.`, "is-saved");
  } catch (error) {
    console.warn("Could not restore packet draft:", error);
    setPacketDraftStatus("Autosave is unavailable in this browser.", "is-error");
  }
}

function setupPacketDraftAutosave() {
  packetDraftReady = true;
  document.addEventListener("input", schedulePacketDraftAutosave);
  document.addEventListener("change", schedulePacketDraftAutosave);

  // Builder actions can change PDFs and TOC data without changing a form field.
  window.setInterval(schedulePacketDraftAutosave, 5000);

  document.querySelectorAll("#sideMenu a").forEach(link => {
    link.addEventListener("click", async event => {
      if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      await savePacketDraft();
      window.location.href = link.href;
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") savePacketDraft();
  });
}

function getPacketHistoryType() {
  return typeof isOMPacket === "function" && isOMPacket()
    ? "om"
    : "submittal";
}

function getPacketHistoryTitle() {
  return getPacketHistoryType() === "om"
    ? "O&M manual"
    : "submittal";
}

function getPacketHistoryStatusElement() {
  return document.getElementById("packetHistoryStatus");
}

function updatePacketHistoryStatus(message = "") {
  const status = getPacketHistoryStatusElement();
  if (status) status.textContent = message;
}

function formatPacketStorageBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

async function updatePacketStorageStatus() {
  const usageCard = document.getElementById("packetStorageUsage");
  if (!usageCard) return;
  const label = usageCard.querySelector(".storage-usage-label span");
  const bar = usageCard.querySelector(".storage-usage-bar span");
  const detail = usageCard.querySelector("p");
  usageCard.classList.remove("warning", "danger");

  if (!navigator.storage?.estimate) {
    if (label) label.textContent = "Usage unavailable";
    if (bar) bar.style.width = "0%";
    if (detail) detail.textContent = "This browser does not report local storage capacity.";
    return;
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const percent = quota ? Math.min(100, (usage / quota) * 100) : 0;
    if (label) label.textContent = quota
      ? `${formatPacketStorageBytes(usage)} of ${formatPacketStorageBytes(quota)} used`
      : `${formatPacketStorageBytes(usage)} used`;
    if (bar) bar.style.width = `${percent.toFixed(1)}%`;
    if (detail) detail.textContent = quota
      ? `Local drafts and history - ${percent.toFixed(1)}% used${percent >= 80 ? " - storage is running low" : ""}`
      : "Local drafts and history";
    usageCard.classList.toggle("warning", percent >= 75 && percent < 90);
    usageCard.classList.toggle("danger", percent >= 90);
  } catch (error) {
    if (label) label.textContent = "Usage unavailable";
    if (bar) bar.style.width = "0%";
    if (detail) detail.textContent = "Could not calculate local drafts and history storage.";
  }
}

function openPacketHistoryDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Local browser history is not supported in this browser."));
      return;
    }

    const request = indexedDB.open(PACKET_HISTORY_DB_NAME, 1);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(PACKET_HISTORY_STORE_NAME)) {
        const store = db.createObjectStore(PACKET_HISTORY_STORE_NAME, {
          keyPath: "id"
        });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local history."));
  });
}

function runPacketHistoryTransaction(mode, callback) {
  return openPacketHistoryDB().then(db =>
    new Promise((resolve, reject) => {
      const transaction = db.transaction(PACKET_HISTORY_STORE_NAME, mode);
      const store = transaction.objectStore(PACKET_HISTORY_STORE_NAME);
      const result = callback(store);

      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("Local history update failed."));
      };
    })
  );
}

async function getPacketHistoryItems(type = getPacketHistoryType()) {

  const items = await runPacketHistoryTransaction("readonly", store =>
    new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    })
  );

  return items
    .filter(item => item.type === type)
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function getPacketHistoryItem(id) {
  return runPacketHistoryTransaction("readonly", store =>
    new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    })
  );
}

function getPacketBuilderState(includedCount = 0) {
  const fieldIds = [
    "projectNumber",
    "projectName",
    "projectLocation",
    "projectAddress",
    "washType",
    "systemName",
    "revision"
  ];
  const fields = {};

  fieldIds.forEach(id => {
    const field = document.getElementById(id);
    if (field) fields[id] = field.value || "";
  });

  return {
    version: 1,
    savedAt: Date.now(),
    includedCount,
    fields,
    customSectionLabels: { ...customSectionLabels },
    pdfLibrary: pdfLibrary.map(item => ({
      ...item,
      file: item.file || null
    }))
  };
}

function cloneBuilderHistoryItem(item) {
  return {
    ...item,
    file: item.file || null,
    tocEntries: (item.tocEntries || []).map(entry => ({ ...entry }))
  };
}

function getLivePacketBuilderSnapshot() {
  const snapshot = getPacketBuilderState(pdfLibrary.filter(item => item.include !== false).length);
  snapshot.pdfLibrary = pdfLibrary.map(cloneBuilderHistoryItem);
  snapshot.pageNumberMode = getPageNumberMode();
  return snapshot;
}

function areBuilderSnapshotsEqual(a, b) {
  if (!a || !b) return false;
  const stripFiles = snapshot => JSON.stringify({
    fields: snapshot.fields || {},
    pageNumberMode: snapshot.pageNumberMode || "normal",
    customSectionLabels: snapshot.customSectionLabels || {},
    pdfLibrary: (snapshot.pdfLibrary || []).map(item => ({
      ...item,
      file: item.file ? "[file]" : null,
      tocEntries: (item.tocEntries || []).map(entry => ({ ...entry }))
    }))
  });
  return stripFiles(a) === stripFiles(b);
}

function updateBuilderHistoryControls() {
  const undoButton = document.getElementById("builderUndoButton");
  const redoButton = document.getElementById("builderRedoButton");
  const status = document.getElementById("builderHistoryStatus");

  if (undoButton) undoButton.disabled = builderUndoStack.length === 0;
  if (redoButton) redoButton.disabled = builderRedoStack.length === 0;
  if (status) {
    status.textContent = builderUndoStack.length || builderRedoStack.length
      ? `${builderUndoStack.length} undo / ${builderRedoStack.length} redo`
      : "";
  }
}

function recordBuilderUndoState() {
  const snapshot = getLivePacketBuilderSnapshot();
  const last = builderUndoStack[builderUndoStack.length - 1];
  if (areBuilderSnapshotsEqual(snapshot, last)) return;

  builderUndoStack.push(snapshot);
  if (builderUndoStack.length > BUILDER_HISTORY_LIMIT) builderUndoStack.shift();
  builderRedoStack.length = 0;
  updateBuilderHistoryControls();
}

function applyPacketBuilderSnapshot(snapshot) {
  if (!snapshot) return;

  pdfLibrary = (snapshot.pdfLibrary || []).map(item => ({
    ...item,
    id: item.id || crypto.randomUUID(),
    file: restoreFileFromHistory(item),
    tocEntries: (item.tocEntries || []).map(entry => ({ ...entry })),
    tocEntriesReviewed: !!item.tocEntriesReviewed,
    include: item.include !== false,
    hideParentTOC: !!item.hideParentTOC
  }));

  customSectionLabels = { ...(snapshot.customSectionLabels || {}) };
  pendingBuild = false;
  finalBuildPreviewAccepted = false;
  finalBuildPreviewCache = null;
  warrantyPromptHandled = false;
  selectedManagedPages = new Set();

  Object.entries(snapshot.fields || {}).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value || "";
  });

  const mode = snapshot.pageNumberMode || "normal";
  const modeInput = document.querySelector(`input[name="pageNumberMode"][value="${mode}"]`);
  if (modeInput) modeInput.checked = true;

  const activeId = document.getElementById("activeSubsectionPdfId")?.value;
  renderUploadedPdfList();
  if (activeId && pdfLibrary.some(item => item.id === activeId)) {
    renderCurrentSubsectionList();
    updateTOCParentDropdown();
  }
  updatePacketBuildStatus("Change restored. Review the builder before building.");
}

function undoBuilderAction() {
  if (builderUndoStack.length === 0) return;
  const current = getLivePacketBuilderSnapshot();
  const previous = builderUndoStack.pop();
  builderRedoStack.push(current);
  applyPacketBuilderSnapshot(previous);
  updateBuilderHistoryControls();
}

function redoBuilderAction() {
  if (builderRedoStack.length === 0) return;
  const current = getLivePacketBuilderSnapshot();
  const next = builderRedoStack.pop();
  builderUndoStack.push(current);
  applyPacketBuilderSnapshot(next);
  updateBuilderHistoryControls();
}

function resetBuilderHistory() {
  builderUndoStack.length = 0;
  builderRedoStack.length = 0;
  builderHistoryFieldSnapshots = new Map();
  updateBuilderHistoryControls();
}

function setupBuilderHistoryControls() {
  const fieldIds = [
    "projectNumber",
    "projectName",
    "projectLocation",
    "projectAddress",
    "washType",
    "systemName",
    "revision"
  ];

  fieldIds.forEach(id => {
    const field = document.getElementById(id);
    if (!field) return;

    const capture = () => builderHistoryFieldSnapshots.set(id, getLivePacketBuilderSnapshot());
    const commit = () => {
      const before = builderHistoryFieldSnapshots.get(id);
      const after = getLivePacketBuilderSnapshot();
      if (before && !areBuilderSnapshotsEqual(before, after)) {
        builderUndoStack.push(before);
        if (builderUndoStack.length > BUILDER_HISTORY_LIMIT) builderUndoStack.shift();
        builderRedoStack.length = 0;
        updateBuilderHistoryControls();
      }
      builderHistoryFieldSnapshots.delete(id);
    };

    field.addEventListener("focus", capture);
    field.addEventListener("change", commit);
    field.addEventListener("blur", commit);
  });

  document.querySelectorAll('input[name="pageNumberMode"]').forEach(input => {
    const capturePageMode = () => builderHistoryFieldSnapshots.set("pageNumberMode", getLivePacketBuilderSnapshot());
    input.addEventListener("focus", capturePageMode);
    input.addEventListener("pointerdown", capturePageMode);
    input.addEventListener("keydown", capturePageMode);
    input.addEventListener("change", () => {
      const before = builderHistoryFieldSnapshots.get("pageNumberMode") || getLivePacketBuilderSnapshot();
      builderUndoStack.push(before);
      if (builderUndoStack.length > BUILDER_HISTORY_LIMIT) builderUndoStack.shift();
      builderRedoStack.length = 0;
      builderHistoryFieldSnapshots.delete("pageNumberMode");
      updateBuilderHistoryControls();
    });
  });

  updateBuilderHistoryControls();
}

function hasActivePacketBuilderState() {
  const hasFiles = pdfLibrary.length > 0;
  const hasFields = [
    "projectNumber",
    "projectName",
    "projectLocation",
    "projectAddress",
    "systemName",
    "revision"
  ].some(id => {
    const field = document.getElementById(id);
    return field && field.value.trim();
  });

  return hasFiles || hasFields;
}

function restoreFileFromHistory(item) {
  if (!item?.file) return null;

  if (item.file instanceof File) return item.file;

  const fileName = item.fileName || item.file?.name || "history-file.pdf";
  const fileType = item.file?.type || "application/pdf";
  const lastModified = item.file?.lastModified || Date.now();

  return new File([item.file], fileName, {
    type: fileType,
    lastModified
  });
}

async function restorePacketBuilderState(builderState) {
  if (!builderState || !Array.isArray(builderState.pdfLibrary)) {
    throw new Error("This history item does not include editable source files.");
  }

  pdfLibrary = builderState.pdfLibrary.map(item => {
  const detectionName = item.displayTitle || item.fileName || "";

  return {
    ...item,
    id: item.id || crypto.randomUUID(),
    file: restoreFileFromHistory(item),
    documentType: guessDocumentType(detectionName),
    packetSection: guessPacketSection(detectionName),
    tocEntries: Array.isArray(item.tocEntries) ? item.tocEntries : [],
    tocEntriesReviewed: !!item.tocEntriesReviewed,
    include: item.include !== false,
    hideParentTOC: !!item.hideParentTOC
  };
});

  customSectionLabels = { ...(builderState.customSectionLabels || {}) };
  pendingBuild = false;
  finalBuildPreviewAccepted = false;
  finalBuildPreviewCache = null;
  warrantyPromptHandled = false;
  selectedManagedPages = new Set();

  Object.entries(builderState.fields || {}).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value || "";
  });

  const pdfUpload = document.getElementById("pdfUpload");
  if (pdfUpload) pdfUpload.value = "";

  [
    "warrantyPromptModal",
    "datasheetOrderModal",
    "finalBuildPreviewModal",
    "subsectionModal",
    "pageManagerModal"
  ].forEach(id => {
    document.getElementById(id)?.classList.add("hidden");
  });

  sortLibraryBySection();
  renderUploadedPdfList();
  updatePacketBuildStatus("History restored. You can edit and build again.");
}

async function savePacketHistoryEntry({ pdfBytes, fileName, includedCount }) {
  const type = getPacketHistoryType();
  const entry = {
    id: crypto.randomUUID(),
    type,
    fileName,
    projectNumber: document.getElementById("projectNumber")?.value || "",
    projectName: document.getElementById("projectName")?.value || "",
    revision: document.getElementById("revision")?.value || "",
    includedCount,
    createdAt: Date.now(),
    blob: new Blob([pdfBytes], { type: "application/pdf" }),
    builderState: getPacketBuilderState(includedCount)
  };

  await runPacketHistoryTransaction("readwrite", store => {
    store.put(entry);
  });

  const items = await getPacketHistoryItems();
  const oldItems = items.slice(PACKET_HISTORY_LIMIT);

  if (oldItems.length > 0) {
    await runPacketHistoryTransaction("readwrite", store => {
      oldItems.forEach(item => store.delete(item.id));
    });
  }

  await renderPacketHistory();
}

async function renderPacketHistory() {
  const list = document.getElementById("packetHistoryList");
  if (!list) return;

  list.innerHTML = "";
  updatePacketHistoryStatus("Loading local history...");
  updatePacketStorageStatus();

  try {
    const historyType = typeof isOMPacket === "function" && isOMPacket() && window.omPacketHistoryViewType
      ? window.omPacketHistoryViewType
      : getPacketHistoryType();
    const items = await getPacketHistoryItems(historyType);
    const label = historyType === "om" ? "O&M manual" : "submittal";
    const isSubmittalViewInOM = getPacketHistoryType() === "om" && historyType === "submittal";

    const heading = document.getElementById("packetHistoryHeading");
    const intro = document.getElementById("packetHistoryIntro");
    const toggle = document.getElementById("submittalHistoryToggle");
    if (heading) heading.textContent = isSubmittalViewInOM ? "Submittal History" : "Local History";
    if (intro) intro.textContent = isSubmittalViewInOM
      ? "Last 3 submittals built on this device. Edit one to load its packet-builder work into O&M."
      : "Last 3 O&M manuals built on this device.";
    if (toggle) toggle.textContent = isSubmittalViewInOM ? "O&M History" : "Submittal History";

    if (items.length === 0) {
      updatePacketHistoryStatus(`No local ${label} history yet.`);
      return;
    }

    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "packet-history-row";

      const createdAt = new Date(item.createdAt).toLocaleString();
      const meta = [
        item.projectNumber,
        item.projectName,
        item.revision ? `Rev ${item.revision}` : "",
        item.includedCount ? `${item.includedCount} PDF(s)` : ""
      ].filter(Boolean).join(" | ");

      row.innerHTML = `
        <div class="packet-history-info">
          <strong>${item.fileName}</strong>
          <span>${createdAt}</span>
          <span>${meta || "No project details saved."}</span>
        </div>

        <div class="button-row packet-history-actions">
          <button onclick="editPacketHistoryEntry('${item.id}')">Edit</button>
          <button onclick="downloadPacketHistoryEntry('${item.id}')">Download</button>
          <button onclick="renamePacketHistoryEntry('${item.id}')">Rename</button>
          <button class="delete-btn" onclick="removePacketHistoryEntry('${item.id}')">Remove</button>
        </div>
      `;

      list.appendChild(row);
    });

    updatePacketHistoryStatus(`Showing ${items.length} saved ${label}(s).`);
  } catch (error) {
    console.error("Could not render packet history:", error);
    updatePacketHistoryStatus(error.message || "Could not load local history.");
  }
}

async function clearCurrentPacketHistory() {
  const historyType = typeof isOMPacket === "function" && isOMPacket() && window.omPacketHistoryViewType
    ? window.omPacketHistoryViewType
    : getPacketHistoryType();
  const label = historyType === "om" ? "O&M" : "Submittal";
  if (!(await showConfirmModal("Clear Local History", `Remove all saved ${label} history from this browser? Your current draft will be kept.`, "Clear History"))) return;
  await runPacketHistoryTransaction("readwrite", store => {
    const request = store.getAll();
    request.onsuccess = () => (request.result || [])
      .filter(item => item.type === historyType)
      .forEach(item => store.delete(item.id));
  });
  await renderPacketHistory();
  updatePacketHistoryStatus(`${label} history cleared.`);
}

async function getPacketBuildPreflight(included) {
  let totalPages = 0;
  let totalBytes = 0;
  for (const item of included) {
    totalBytes += Number(item.file?.size || 0);
    if (Number.isFinite(Number(item.pageCount)) && Number(item.pageCount) > 0) {
      totalPages += Number(item.pageCount);
      continue;
    }
    try {
      const bytes = await getSourcePDFBytes(item.file);
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      item.pageCount = pdf.getPageCount();
      totalPages += item.pageCount;
    } catch (error) {
      console.warn("Could not count pages for build preflight:", item.fileName, error);
    }
  }
  return { totalPages, totalBytes, fileCount: included.length };
}

function toggleOMSubmittalHistory() {
  if (getPacketHistoryType() !== "om") return;
  window.omPacketHistoryViewType = window.omPacketHistoryViewType === "submittal"
    ? "om"
    : "submittal";
  renderPacketHistory();
}

async function downloadPacketHistoryEntry(id) {
  try {
    const item = await getPacketHistoryItem(id);

    if (!item || !item.blob) {
      await showMessageModal("Saved PDF Not Found", "This saved PDF was not found.");
      await renderPacketHistory();
      return;
    }

    downloadFile(item.blob, item.fileName || "packet-history.pdf", "application/pdf");
    updatePacketHistoryStatus(`Downloaded ${item.fileName}.`);
  } catch (error) {
    console.error("Could not download packet history item:", error);
    await showMessageModal("Download Failed", "Could not download this saved PDF.");
  }
}

async function editPacketHistoryEntry(id) {
  try {
    const item = await getPacketHistoryItem(id);

    if (!item?.builderState) {
      await showMessageModal("Editable History Unavailable", "This saved PDF was created before editable history was added. Build it once more to save an editable version.");
      return;
    }

    if (
      hasActivePacketBuilderState() &&
      !(await showConfirmModal("Replace Current Builder", "Replace the current builder with this saved history item?", "Replace"))
    ) {
      return;
    }

    await restorePacketBuilderState(item.builderState);
    updatePacketHistoryStatus(`Loaded ${item.fileName} for editing.`);

    document.getElementById("dropZone")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    console.error("Could not edit packet history item:", error);
    await showMessageModal("History Load Failed", error.message || "Could not load this history item for editing.");
  }
}

async function renamePacketHistoryEntry(id) {
  try {
    const item = await getPacketHistoryItem(id);
    if (!item) return;

    let newName = await showTextModal({
      title: "Rename Saved PDF",
      message: "Rename saved PDF.",
      label: "PDF name",
      value: item.fileName || "",
      confirmLabel: "Save"
    });
    if (newName === null) return;

    newName = newName.trim();
    if (!newName) {
      await showMessageModal("Name Required", "History name cannot be blank.");
      return;
    }

    if (!newName.toLowerCase().endsWith(".pdf")) {
      newName += ".pdf";
    }

    item.fileName = newName;

    await runPacketHistoryTransaction("readwrite", store => {
      store.put(item);
    });

    await renderPacketHistory();
    updatePacketHistoryStatus(`Renamed saved PDF to ${newName}.`);
  } catch (error) {
    console.error("Could not rename packet history item:", error);
    await showMessageModal("Rename Failed", "Could not rename this saved PDF.");
  }
}

async function removePacketHistoryEntry(id) {
  const item = await getPacketHistoryItem(id);
  const name = item?.fileName || "this saved PDF";

  if (!(await showConfirmModal("Remove Saved PDF", `Remove ${name} from local history?`, "Remove"))) return;

  try {
    await runPacketHistoryTransaction("readwrite", store => {
      store.delete(id);
    });

    await renderPacketHistory();
    updatePacketHistoryStatus(`Removed ${name} from local history.`);
  } catch (error) {
    console.error("Could not remove packet history item:", error);
    await showMessageModal("Remove Failed", "Could not remove this saved PDF.");
  }
}

/* --------------------------------------------------------------------------
   Table of contents, final preview, and packet assembly
   -------------------------------------------------------------------------- */

function getPageNumberMode() {
  const selected = document.querySelector('input[name="pageNumberMode"]:checked');
  return selected?.value === "book" ? "book" : "normal";
}

function getNoNumberPageIndexesForMode(revisionRemarkIndexes = [], coverPageIndex = null) {
  const mode = getPageNumberMode();
  const noNumberIndexes = [...revisionRemarkIndexes];

  // Book format: cover is not numbered.
  // Normal format: cover is numbered as page 1.
  if (mode === "book" && coverPageIndex !== null) {
    noNumberIndexes.push(coverPageIndex);
  }

  return noNumberIndexes;
}

function getPrintedPageNumber(pageIndex, noNumberPageIndexes = []) {
  if (noNumberPageIndexes.includes(pageIndex)) return null;

  const mode = getPageNumberMode();

  if (mode === "book" && currentBuildPdfDoc) {
    let printedPageNumber = 0;
    const pageCount = currentBuildPdfDoc.getPageCount();

    for (let index = 0; index < pageIndex; index++) {
      if (index >= pageCount) continue;
      if (noNumberPageIndexes.includes(index)) continue;
      if (pageIndexIsTOCPage(currentBuildPdfDoc, index)) continue;

      printedPageNumber++;
    }

    return printedPageNumber + 1;
  }

  const skippedBefore = noNumberPageIndexes.filter(index => index < pageIndex).length;
  return pageIndex + 1 - skippedBefore;
}

function getPacketTOCSectionDefinitions() {
  const isOM =
    typeof isOMPacket === "function" &&
    isOMPacket();

  if (isOM && typeof OM_SECTION_ORDER !== "undefined" && Array.isArray(OM_SECTION_ORDER)) {
    return OM_SECTION_ORDER;
  }

  return [
    "Warranty",
    "Datasheets",
    "Control Panel Components",
    "Shop Drawings",
    "Appendix"
  ];
}

function getFilteredTOCItemsForSection(items) {
  return items;
}

function normalizeDetectedTOCEntry(item, detectedEntry) {
  const tocLevel = Number(detectedEntry.tocLevel || 0);
  const parentId =
    tocLevel > 0 &&
    tocLevel - 1 === getPDFParentTOCLevel(item) &&
    !item.hideParentTOC
      ? PDF_PARENT_TOC_ID
      : "";

  return {
    id: crypto.randomUUID(),
    title: detectedEntry.title,
    sourcePage: Number(detectedEntry.sourcePage || 1),
    entryType: tocLevel === 0 ? "section" : "subsection",
    tocLevel,
    parentId,
    detectedTOCEntry: true
  };
}

async function scanTOCEntriesForEditor(item) {
  if (!item || item.tocEntriesReviewed || (item.tocEntries || []).length > 0) return;

  const detectedEntries = await detectTOCSubsections(
    item.file,
    item.packetSection,
    1,
    0
  );

  item.tocEntries = detectedEntries.map(entry => normalizeDetectedTOCEntry(item, entry));
  item.tocEntriesReviewed = true;
}

function estimateInsertedTOCPageCount(tocItems = [], sectionTargets = {}) {
  const isOM =
    typeof isOMPacket === "function" &&
    isOMPacket();
  const height = 792;
  const topMargin = 50;
  const footerMargin = 65;
  const startY = height - topMargin;
  let y = isOM ? startY - 185 : startY - 160;
  let insertedPageCount = 0;

  function continueOnNextTOCPage() {
    insertedPageCount++;
    y = height - topMargin - 30 - 28;
  }

  getPacketTOCSectionDefinitions().forEach(section => {
    const items = tocItems.filter(item => item.section === section);
    const sectionTarget = sectionTargets[section];
    if (items.length === 0 && !sectionTarget) return;

    const sectionLabel = getSectionLabel(section);

    if (y < footerMargin + 25) {
      continueOnNextTOCPage();
    }

    y -= 14;

    getFilteredTOCItemsForSection(items, sectionLabel).forEach(() => {
      if (y < footerMargin) {
        continueOnNextTOCPage();
      }

      y -= 12;
    });

    y -= 4;
  });

  return insertedPageCount;
}

function adjustNormalTOCPageNumbersForInsertedPages(
  tocItems,
  sectionTargets,
  firstInsertedTOCPageIndex,
  insertedTOCPageCount,
  noNumberPageIndexes
) {
  if (getPageNumberMode() !== "normal" || insertedTOCPageCount <= 0) return;

  function getAdjustedPageNumber(targetPageIndex) {
    if (!Number.isInteger(Number(targetPageIndex))) return null;

    const shift =
      Number(targetPageIndex) >= firstInsertedTOCPageIndex
        ? insertedTOCPageCount
        : 0;

    return getPrintedPageNumber(
      Number(targetPageIndex) + shift,
      noNumberPageIndexes
    );
  }

  Object.values(sectionTargets || {}).forEach(sectionTarget => {
    const pageNumber = getAdjustedPageNumber(sectionTarget.targetPageIndex);
    if (pageNumber !== null) {
      sectionTarget.pageNumber = pageNumber;
    }
  });

  (tocItems || []).forEach(item => {
    const pageNumber = getAdjustedPageNumber(item.targetPageIndex);
    if (pageNumber !== null) {
      item.startPage = pageNumber;
    }
  });
}

function setFinalBuildPreviewStatus(message, recordMessage = true) {
  const status = document.getElementById("finalBuildPreviewStatus");
  if (status) status.textContent = message || "";
  if (recordMessage) recordPacketBuildMessage(message);
}

function clearFinalBuildPreviewPages() {
  const pages = document.getElementById("finalBuildPreviewPages");
  if (pages) pages.innerHTML = "";
}

async function renderFinalBuildPdfPreview(bytes) {
  const container = document.getElementById("finalBuildPreviewPages");
  if (!container) return;
  container.innerHTML = "";

  const pdf = await pdfjsLib.getDocument(
    getPacketPDFJSOptions(bytes.slice(0))
  ).promise;
  setFinalBuildPreviewStatus("Rendering preview pages...");

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    setFinalBuildPreviewStatus(
      `Rendering page ${pageNumber} of ${pdf.numPages}...`,
      pageNumber === 1 || pageNumber % 10 === 0 || pageNumber === pdf.numPages
    );
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });

    const label = document.createElement("div");
    label.className = "page-preview-label";
    label.textContent = `Page ${pageNumber}`;
    container.appendChild(label);

    const pageWrap = document.createElement("div");
    pageWrap.className = "converter-preview-page-wrap final-build-preview-page-wrap";
    pageWrap.dataset.pageNumber = String(pageNumber);
    pageWrap.dataset.viewportScale = String(viewport.scale || 1);
    pageWrap.style.width = `${viewport.width}px`;
    pageWrap.style.maxWidth = "100%";

    const canvas = document.createElement("canvas");
    canvas.className = "converter-preview-page final-build-preview-page";
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    pageWrap.appendChild(canvas);
    container.appendChild(pageWrap);

    await page.render({
      canvasContext: canvas.getContext("2d", { willReadFrequently: true }),
      viewport
    }).promise;
  }

  setFinalBuildPreviewStatus(`Preview ready. ${pdf.numPages} page(s) in the full build.`);
}

async function openFinalBuildPreviewModal(previewData) {
  const modal = document.getElementById("finalBuildPreviewModal");
  if (!modal) return false;
  finalBuildPreviewCache = previewData;
  clearFinalBuildPreviewPages();
  setFinalBuildPreviewStatus("Loading preview...");
  modal.classList.remove("hidden");
  updatePacketBuildStatus("Review the PDF preview before creating the final file.");

  try {
    await renderFinalBuildPdfPreview(previewData.pdfBytes);
  } catch (previewError) {
    console.error("Could not render final build preview:", previewError);
    setFinalBuildPreviewStatus("Preview could not be displayed, but the PDF is ready to build.");
  }
  return true;
}

function closeFinalBuildPreviewModal() {
  const modal = document.getElementById("finalBuildPreviewModal");
  if (modal) modal.classList.add("hidden");
  clearFinalBuildPreviewPages();
  finalBuildPreviewAccepted = false;
  finalBuildPreviewCache = null;
  pendingBuild = false;
  warrantyPromptHandled = false;
  updatePacketBuildStatus("Build preview closed. Make edits, then build again when ready.");
}

async function finishPacketBuildFromPreview(previewData) {
  const buildLabel = previewData.buildLabel || getPacketBuildLabel();
  const { pdfBytes, outputName, included } = previewData;

  // Trigger the download while the Build PDF click still has browser permission.
  // Waiting for IndexedDB or cloud work first can cause browsers to block it.
  updatePacketBuildStatus("Starting final PDF download...");
  requestPacketDownload(pdfBytes, outputName);

  updatePacketBuildStatus("Saving local history copy...");
  try {
    await savePacketHistoryEntry({
      pdfBytes,
      fileName: outputName,
      includedCount: included.length
    });
  } catch (historyError) {
    console.warn("Could not save packet history:", historyError);
    updatePacketHistoryStatus(
      historyError.message || "Could not save this PDF to local history."
    );
  }

  warrantyPromptHandled = false;

  if (
    typeof supabaseClient !== "undefined" &&
    typeof mergeSubmittalIntoLibrary === "function"
  ) {
    try {
      await mergeSubmittalIntoLibrary(included);
    } catch (e) {
      console.error("Error merging into library", e);
    }
  }

  finalBuildPreviewCache = null;
  resetPacketBuilder();
  updatePacketBuildStatus(
    `${buildLabel} download requested. Ready for the next build. Use Retry download if the file did not appear.`
  );
}

async function confirmFinalBuildPreview() {
  const previewData = finalBuildPreviewCache;
  const modal = document.getElementById("finalBuildPreviewModal");
  if (modal) modal.classList.add("hidden");
  clearFinalBuildPreviewPages();
  finalBuildPreviewAccepted = true;
  pendingBuild = false;

  if (!previewData) {
    pendingBuild = true;
    buildPacket();
    return;
  }

  try {
    await finishPacketBuildFromPreview(previewData);
  } catch (error) {
    console.error("Could not finish previewed build:", error);
    finalBuildPreviewAccepted = false;
    finalBuildPreviewCache = null;
    warrantyPromptHandled = false;
    const message = getBuildErrorMessage(previewData.buildLabel || getPacketBuildLabel(), error, "finishing the previewed build");
    updatePacketBuildStatus(message);
    await showMessageModal("Build Paused", message);
  }
}

async function buildPacket() {
  const buildLabel = getPacketBuildLabel();
  let buildContext = "starting the build";
  const hasIncludedWarranty = pdfLibrary.some(item =>
    item.include && item.packetSection === "Warranty"
  );

  const warrantyModal = document.getElementById("warrantyPromptModal");

  const sectionsToOrganize = getSectionsNeedingOrganization();
  if (sectionsToOrganize.length > 0 && !pendingBuild) {
    updatePacketBuildStatus("Organize section PDF order to continue building.");
    openSectionOrderModal(sectionsToOrganize);
    return;
  }

  if (!warrantyPromptHandled && warrantyModal) {
    updatePacketBuildStatus("Review warranty options to continue building.");
    openWarrantyPromptModal({ hasIncludedWarranty });
    return;
  }

  const includedForPreflight = pdfLibrary.filter(item => item.include);
  let buildPreflight = null;
  if (!packetLargeBuildConfirmed && includedForPreflight.length) {
    updatePacketBuildStatus("Checking build size before starting...");
    buildPreflight = await getPacketBuildPreflight(includedForPreflight);
    const isLargeBuild = buildPreflight.totalPages >= 300 || buildPreflight.totalBytes >= 100 * 1024 * 1024 || buildPreflight.fileCount >= 30;
    if (isLargeBuild) {
      const proceed = await showConfirmModal(
        "Large PDF Build",
        `This build contains ${buildPreflight.fileCount} PDF(s), approximately ${buildPreflight.totalPages} page(s), and ${formatPacketStorageBytes(buildPreflight.totalBytes)} of source files. It may take longer and use substantial browser memory. Continue?`,
        "Continue Build"
      );
      if (!proceed) {
        updatePacketBuildStatus("Large build canceled before processing.");
        return;
      }
    }
    packetLargeBuildConfirmed = true;
  }

  finalBuildPreviewAccepted = false;
  finalBuildPreviewCache = null;
  pendingBuild = false;
  startPacketBuildTimer(
    buildPreflight
      ? `Building ${buildLabel} preview: ${buildPreflight.fileCount} PDF(s), approximately ${buildPreflight.totalPages} page(s), ${formatPacketStorageBytes(buildPreflight.totalBytes)}...`
      : `Building ${buildLabel} preview...`
  );

  try {
  buildContext = "creating a new PDF";
  const finalPdf = await PDFDocument.create();
  currentBuildPdfDoc = finalPdf;
  const noNumberPageIndexes = [];

  const included = pdfLibrary.filter(item => item.include);
  const incompleteTOCEntries = getIncompleteTOCEntries()
    .filter(({ item }) => item.include !== false);

  if (incompleteTOCEntries.length > 0) {
    const firstMissing = incompleteTOCEntries[0];
    await showMessageModal(
      "TOC Pages Required",
      "Assign page numbers to all template TOC rows before building. First missing row: \"" +
        firstMissing.entry.title + "\" in \"" +
        (firstMissing.item.displayTitle || firstMissing.item.fileName) + "\"."
    );
    updatePacketBuildStatus("Assign page numbers to template TOC rows before building.");
    return;
  }

  if (included.length === 0) {
    throw new Error("No PDFs are included. Add at least one PDF or check Include on an uploaded file.");
  }

  updatePacketBuildStatus(`Preparing ${included.length} included PDF(s)...`);

  const revisionRemarks = included.filter(x => x.packetSection === "Revision Remarks");
  //const coverPages = included.filter(x => x.packetSection === "Cover Page");
  const warranties = included.filter(x => x.packetSection === "Warranty");

  const datasheets = included
    .filter(x => x.packetSection === "Datasheets")
    .sort((a, b) => (a.datasheetOrder ?? 999) - (b.datasheetOrder ?? 999));

  const controlPanelComponents = included.filter(
    x => x.packetSection === "Control Panel Components"
  );

  const shopDrawings = included.filter(
    x => x.packetSection === "Shop Drawings"
  );

  let contentFiles;

  if (
    typeof isOMPacket === "function" &&
    isOMPacket()
  ) {
    contentFiles = [];

    OM_SECTION_ORDER.forEach(section => {
      contentFiles.push(
        ...included.filter(x => x.packetSection === section)
      );
    });
  } else {
    contentFiles = [
      ...warranties,
      ...datasheets,
      ...controlPanelComponents,
      ...shopDrawings
    ];
  }

  // Revision Remarks comes FIRST, but is not numbered or in TOC
  if (revisionRemarks.length) {
    updatePacketBuildStatus("Adding revision remarks...");
  }

  for (const item of revisionRemarks) {
    buildContext = `adding revision remarks: ${item.displayTitle || item.file?.name || "PDF"}`;
    const addedIndexes = await appendPDF(finalPdf, item.file);
    noNumberPageIndexes.push(...addedIndexes);
  }

  // Generated Cover Page comes after Revision Remarks
  buildContext = "creating the cover page";
  updatePacketBuildStatus("Creating cover page...");
  const coverPageIndex = finalPdf.getPageCount();
    await drawGeneratedCoverPage(finalPdf);

    const finalNoNumberPageIndexes = getNoNumberPageIndexesForMode(
    noNumberPageIndexes,
    coverPageIndex
  );

  buildContext = "creating the table of contents page";
  updatePacketBuildStatus("Creating table of contents...");
  const tocPage = finalPdf.addPage([612, 792]);
  tocPage.node.set(
    window.PDFLib.PDFName.of("PacketSection"),
    window.PDFLib.PDFString.of("Table of Contents")
  );
  const tocItems = [];
  const sectionTargets = {};

  let currentSection = null;

  for (let itemIndex = 0; itemIndex < contentFiles.length; itemIndex += 1) {
    const item = contentFiles[itemIndex];
    const itemTitle = item.displayTitle || item.file?.name || "PDF";
    buildContext = `adding ${getSectionLabel(item.packetSection)}: ${itemTitle}`;
    updatePacketBuildStatus(
      `Adding ${getSectionLabel(item.packetSection)}: ${itemTitle} (${itemIndex + 1} of ${contentFiles.length})...`
    );

    if (item.packetSection !== currentSection) {
      currentSection = item.packetSection;

      const sectionNumber = Object.keys(sectionTargets).length + 1;
      const romanNumber = toRoman(sectionNumber);
      const sectionLabel = getSectionLabel(currentSection);
      const sectionTitle = `${romanNumber}. ${sectionLabel}`;
      const targetPageIndex = finalPdf.getPageCount();

      await drawSectionDividerPage(finalPdf, sectionTitle, currentSection);

      sectionTargets[currentSection] = {
        roman: romanNumber,
        title: sectionLabel,
        targetPageIndex,
        pageNumber: getPrintedPageNumber(
          targetPageIndex,
          finalNoNumberPageIndexes
        )
      };
    }

    const startPage = getPrintedPageNumber(
      finalPdf.getPageCount(),
      finalNoNumberPageIndexes
    );

    if (!item.hideParentTOC) {
      tocItems.push({
        title: item.displayTitle,
        section: item.packetSection,
        startPage,
        targetPageIndex: finalPdf.getPageCount(),
        tocLevel: getPDFParentTOCLevel(item),
        isParentTOC: true
      });
    }

    if ((item.tocEntries || []).length > 0) {
      const manualEntries = orderTOCEntriesForDisplay(item.tocEntries || [])
        .map(entry => ({
          title: entry.title,
          section: item.packetSection,
          startPage: startPage + entry.sourcePage - 1,
          targetPageIndex:
            finalPdf.getPageCount() + entry.sourcePage - 1,
          tocLevel: Number(entry.tocLevel || 0),
          parentId: entry.parentId || "",
          isManualTOC: true
        }));

      tocItems.push(...manualEntries);
    } else if (!item.tocEntriesReviewed) {
      buildContext = `detecting TOC entries for ${getSectionLabel(item.packetSection)}: ${itemTitle}`;
      const detectedSubsections =
        await detectTOCSubsections(
          item.file,
          item.packetSection,
          startPage,
          finalPdf.getPageCount()
        );

      tocItems.push(...detectedSubsections);
    }


    buildContext = `appending ${getSectionLabel(item.packetSection)}: ${itemTitle}`;
    const addedIndexes = await appendPDF(finalPdf, item.file, {
      clearFooter: item.importedFromSubmittal
    });
    buildContext = `marking imported subsection pages for ${itemTitle}`;
    markImportedSubsectionPages(finalPdf, addedIndexes, item);
  }

  const firstInsertedTOCPageIndex = finalPdf.getPages().indexOf(tocPage) + 1;
  const insertedTOCPageCount = estimateInsertedTOCPageCount(tocItems, sectionTargets);
  adjustNormalTOCPageNumbersForInsertedPages(
    tocItems,
    sectionTargets,
    firstInsertedTOCPageIndex,
    insertedTOCPageCount,
    finalNoNumberPageIndexes
  );

  buildContext = "drawing the table of contents";
  await drawTOCOnExistingPage(
    finalPdf,
    tocPage,
    tocItems,
    sectionTargets
  );
  buildContext = "adding page numbers";
  updatePacketBuildStatus("Adding page numbers...");
  await addPageNumbers(finalPdf, finalNoNumberPageIndexes);

  buildContext = "saving the final PDF";
  updatePacketBuildStatus("Saving final PDF...");
  const pdfBytes = await finalPdf.save();

  buildContext = "creating the output file name";
  const outputName =
    typeof getOMOutputFileName === "function"
      ? getOMOutputFileName()
      : getOutputFileName();

  buildContext = "showing the final PDF preview";
  await openFinalBuildPreviewModal({
    pdfBytes,
    outputName,
    included,
    buildLabel
  });
  } catch (error) {
    console.error(`Could not build ${buildLabel}:`, error);
    pendingBuild = false;
    finalBuildPreviewAccepted = false;
    finalBuildPreviewCache = null;
    warrantyPromptHandled = false;
    const message = getBuildErrorMessage(buildLabel, error, buildContext);
    updatePacketBuildStatus(message);
    await showMessageModal("Build Paused", message);
  } finally {
    stopPacketBuildTimer();
  }
}

function resetPacketBuilder() {
  pdfLibrary = [];
  resetBuilderHistory();
  pendingBuild = false;
  finalBuildPreviewAccepted = false;
  finalBuildPreviewCache = null;
  warrantyPromptHandled = false;
  packetLargeBuildConfirmed = false;
  customSectionLabels = {};

  const pdfUpload = document.getElementById("pdfUpload");
  if (pdfUpload) pdfUpload.value = "";

  [
    "projectNumber",
    "projectName",
    "projectLocation",
    "projectAddress",
    "systemName",
    "revision"
  ].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });

  const washType = document.getElementById("washType");
  if (washType) washType.selectedIndex = 0;

  [
    "warrantyPromptModal",
    "datasheetOrderModal",
    "finalBuildPreviewModal",
    "subsectionModal",
    "pageManagerModal"
  ].forEach(id => {
    document.getElementById(id)?.classList.add("hidden");
  });

  const datasheetOrderList = document.getElementById("datasheetOrderList");
  if (datasheetOrderList) datasheetOrderList.innerHTML = "";

  const normalMode = document.querySelector('input[name="pageNumberMode"][value="normal"]');
  if (normalMode) normalMode.checked = true;

  renderUploadedPdfList();
  updatePacketBuildStatus();
}

/* --------------------------------------------------------------------------
   Warranty creation
   -------------------------------------------------------------------------- */

function openWarrantyPromptModal(options = {}) {
  const modal = document.getElementById("warrantyPromptModal");
  const createCheckbox = document.getElementById("createWarrantySheet");
  const vehicleType = document.getElementById("warrantyVehicleType");
  const washType = document.getElementById("washType")?.value;
  const durationInput = document.getElementById("warrantyLaborDuration");
  const materialYearsInput = document.getElementById("warrantyMaterialYears");
  const unitSelect = document.getElementById("warrantyLaborUnit");
  const commencementSelect = document.getElementById("warrantyCommencement");
  const commencementDate = document.getElementById("warrantyCommencementDate");
  const representative = document.getElementById("warrantyRepresentative");
  const representativeDate = document.getElementById("warrantyRepresentativeDate");
  const revisionPreparedBy = document.getElementById("warrantyRevisionPreparedBy");
  const status = document.getElementById("warrantyCreateStatus");
  const promptText = document.getElementById("warrantyPromptText");
  const createLabel = document.getElementById("warrantyCreatePromptText");
  const continueButton = document.getElementById("continueWarrantyButton");

  if (!modal || !createCheckbox) return;

  modal.dataset.hasIncludedWarranty = options.hasIncludedWarranty ? "true" : "false";
  createCheckbox.checked = false;
  if (promptText) {
    promptText.textContent = options.hasIncludedWarranty
      ? "A warranty PDF is included in this packet."
      : "No warranty PDF is included in this packet.";
  }
  if (createLabel) {
    createLabel.textContent = options.hasIncludedWarranty
      ? "Do you want to create a new warranty sheet instead?"
      : "Do you want to create a warranty sheet?";
  }
  if (vehicleType) {
    vehicleType.value = washType === "Car Wash" ? "car" : "transit";
  }
  if (materialYearsInput) materialYearsInput.value = "";
  if (durationInput) durationInput.value = "";
  if (unitSelect) unitSelect.value = "days";
  if (commencementSelect) commencementSelect.value = "substantial";
  if (commencementDate) commencementDate.value = "";
  if (representative) representative.selectedIndex = 0;
  if (representativeDate) {
    representativeDate.value = getWarrantyDateInputValue(new Date());
  }
  if (revisionPreparedBy) revisionPreparedBy.value = "";
  if (status) status.textContent = "";
  renderBuildSummary("buildSummary", { createWarranty: false });

  updateWarrantyPeriodEnd();
  updateWarrantyVehicleFields();
  toggleWarrantyCreator();
  if (continueButton && !createCheckbox.checked) {
    continueButton.textContent = options.hasIncludedWarranty
      ? "Continue With Included Warranty"
      : "Continue Without Warranty";
  }
  modal.classList.remove("hidden");
}

function closeWarrantyPromptModal() {
  const modal = document.getElementById("warrantyPromptModal");
  if (modal) modal.classList.add("hidden");
}

function toggleWarrantyCreator() {
  const createCheckbox = document.getElementById("createWarrantySheet");
  const fields = document.getElementById("warrantyCreatorFields");
  const continueButton = document.getElementById("continueWarrantyButton");

  if (!createCheckbox || !fields || !continueButton) return;

  const hasIncludedWarranty =
    document.getElementById("warrantyPromptModal")?.dataset.hasIncludedWarranty === "true";

  fields.classList.toggle("hidden", !createCheckbox.checked);
  continueButton.textContent = createCheckbox.checked
    ? "Add Warranty & Continue"
    : hasIncludedWarranty
      ? "Continue With Included Warranty"
      : "Continue Without Warranty";

  renderBuildSummary("buildSummary", { createWarranty: createCheckbox.checked });
}

function getBuildSummary(options = {}) {
  const included = pdfLibrary.filter(item => item.include);
  const createWarranty = Boolean(options.createWarranty);
  const revisionRemarksCount = included.filter(
    item => item.packetSection === "Revision Remarks"
  ).length;
  const romanSections = getBuildRomanSections().map(section => {
    const count =
      included.filter(item => item.packetSection === section).length +
      (section === "Warranty" && createWarranty ? 1 : 0);

    return {
      section,
      label: getSectionLabel(section),
      count,
      included: count > 0
    };
  });

  return {
    includedPdfCount: included.length + (createWarranty ? 1 : 0),
    revisionRemarksIncluded: revisionRemarksCount > 0,
    romanSections
  };
}

function getBuildRomanSections() {
  if (typeof isOMPacket === "function" && isOMPacket()) {
    return OM_SECTION_ORDER;
  }

  return [
    "Warranty",
    "Datasheets",
    "Control Panel Components",
    "Shop Drawings",
    "Appendix"
  ];
}

function renderBuildSummary(targetId, options = {}) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const summary = getBuildSummary(options);
  const romanSectionRows = summary.romanSections
    .map(item => `
      <div class="build-summary-row ${item.included ? "" : "is-missing"}">
        <span>${item.label}</span>
        <strong>${item.included ? `Yes (${item.count})` : "No"}</strong>
      </div>
    `)
    .join("");

  target.innerHTML = `
    <div class="build-summary-row">
      <span>Included PDFs</span>
      <strong>${summary.includedPdfCount}</strong>
    </div>
    <div class="build-summary-row">
      <span>Revision Remarks</span>
      <strong>${summary.revisionRemarksIncluded ? "Yes" : "No"}</strong>
    </div>
    <div class="build-summary-heading">Roman Numeral Sections</div>
    ${romanSectionRows}
  `;
}

function updateWarrantyVehicleFields() {
  const vehicleType = document.getElementById("warrantyVehicleType")?.value;
  const laborUnit = document.getElementById("warrantyLaborUnit");
  const transitFields = document.getElementById("warrantyTransitFields");
  const isCar = vehicleType === "car";

  transitFields?.classList.toggle("hidden", isCar);

  if (laborUnit) {
    const units = isCar
      ? [["days", "Days"], ["months", "Months"]]
      : [["days", "Days"], ["years", "Years"]];

    laborUnit.replaceChildren(...units.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }));
  }
}

async function continueWarrantyPrompt() {
  const createCheckbox = document.getElementById("createWarrantySheet");
  let warrantyAdded = false;

  if (!createCheckbox?.checked) {
    warrantyPromptHandled = true;
    closeWarrantyPromptModal();
    buildPacket();
    return;
  }

  const duration = Number(
    document.getElementById("warrantyLaborDuration")?.value
  );
  const materialYears = Number(
    document.getElementById("warrantyMaterialYears")?.value
  );
  const vehicleType =
    document.getElementById("warrantyVehicleType")?.value || "transit";
  const unit = document.getElementById("warrantyLaborUnit")?.value;
  const commencement = document.getElementById("warrantyCommencement")?.value;
  const commencementDate =
    document.getElementById("warrantyCommencementDate")?.value || "";
  const periodEndDate =
    document.getElementById("warrantyPeriodEndDate")?.value ||
    getWarrantyPeriodEndDate(commencementDate);
  const representative =
    document.getElementById("warrantyRepresentative")?.value || "";
  const representativeDate =
    document.getElementById("warrantyRepresentativeDate")?.value || "";
  const revisionPreparedBy =
    document.getElementById("warrantyRevisionPreparedBy")?.value.trim() || "";
  const status = document.getElementById("warrantyCreateStatus");
  const continueButton = document.getElementById("continueWarrantyButton");
  const buildLabel = getPacketBuildLabel();

  if (!Number.isInteger(materialYears) || materialYears < 1) {
    if (status) status.textContent = "Enter the material warranty years.";
    updatePacketBuildStatus("Warranty build paused: enter the material warranty years.");
    return;
  }

  if (!Number.isInteger(duration) || duration < 1) {
    if (status) status.textContent = "Enter a whole number greater than zero.";
    updatePacketBuildStatus("Warranty build paused: enter a whole number greater than zero.");
    return;
  }

  if (vehicleType === "transit" && (!commencementDate || !periodEndDate)) {
    if (status) status.textContent = "Select the warranty commencement date.";
    updatePacketBuildStatus("Warranty build paused: select the warranty commencement date.");
    return;
  }

  if (continueButton) continueButton.disabled = true;
  if (status) status.textContent = "Creating warranty sheet...";
  updatePacketBuildStatus("Creating warranty sheet...");

  try {
    const warrantyFile = vehicleType === "car"
      ? await createCarWarrantyFile({
          materialYears,
          duration,
          unit,
          revisionPreparedBy
        })
      : await createTransitWarrantyFile({
          materialYears,
          duration,
          unit,
          commencement,
          commencementDate,
          periodEndDate,
          representative,
          representativeDate,
          revisionPreparedBy
        });

    pdfLibrary.push({
      id: crypto.randomUUID(),
      file: warrantyFile,
      fileName: warrantyFile.name,
      uploadDate: new Date().toLocaleDateString(),
      displayTitle: "Manufacturer's Limited Warranty",
      documentType: "Warranty",
      packetSection: "Warranty",
      include: true,
      hideParentTOC: true,
      tocEntriesReviewed: false,
      notes:
        `Materials: ${materialYears} year(s); ` +
        `Labor: ${duration} ${unit}`,
      datasheetOrder: null,
      tocEntries: []
    });
    warrantyAdded = true;

    warrantyPromptHandled = true;
    sortLibraryBySection();
    renderUploadedPdfList();
    if (status) status.textContent = "Warranty sheet added.";
    updatePacketBuildStatus("Warranty sheet added. Continuing build...");
    closeWarrantyPromptModal();
    await buildPacket();
  } catch (error) {
    console.error("Could not continue warranty build:", error);
    const reason = error?.message || "Please try again.";

    if (warrantyAdded) {
      const message =
        `The warranty sheet was added, but the ${buildLabel} could not be built. ${reason}`;
      updatePacketBuildStatus(message);
      await showMessageModal("Build Paused", message);
    } else if (status) {
      const message = `The warranty sheet could not be created. ${reason}`;
      status.textContent = message;
      updatePacketBuildStatus(message);
    }
  } finally {
    if (continueButton) continueButton.disabled = false;
  }
}

async function createTransitWarrantyFile({
  materialYears,
  duration,
  unit,
  commencement,
  commencementDate,
  periodEndDate,
  representative,
  representativeDate,
  revisionPreparedBy
}) {
  const commencementCode = commencement === "testing" ? "TC" : "SC";
  const durationCode = unit === "years" ? "Y" : "D";
  const templateFileName =
    `Transit${commencementCode}${durationCode}Warranty.pdf`;
  const templateBytes = await loadTransitWarrantyTemplate(templateFileName);
  const warrantyPdf = await PDFDocument.load(templateBytes);
  const pages = warrantyPdf.getPages();
  const detailsPage = pages[pages.length - 1];
  const PDFName = window.PDFLib.PDFName;

  if (!detailsPage || !PDFName) {
    throw new Error("The transit warranty template could not be loaded.");
  }

  const annotationsKey = PDFName.of("Annots");
  pages.forEach(page => page.node.delete(annotationsKey));
  warrantyPdf.catalog.delete(PDFName.of("AcroForm"));

  const font = await warrantyPdf.embedFont(StandardFonts.Helvetica);
  const projectNumber = document.getElementById("projectNumber")?.value || "";
  const projectName = document.getElementById("projectName")?.value || "";
  const projectAddress = document.getElementById("projectAddress")?.value || "";
  const unitLabel = unit === "years" ? "year(s)" : "days";
  const commencementLabel = commencement === "testing"
    ? "Testing and Completion."
    : "Substantial Completion.";

  drawWarrantyFieldText(detailsPage, projectNumber, 216, 660, 8, 242, font);
  drawWarrantyFieldText(detailsPage, projectName, 216, 648, 8, 242, font);
  drawWarrantyFieldText(detailsPage, projectAddress, 216, 635, 8, 242, font);
  drawWarrantyFieldText(detailsPage, String(materialYears), 37, 581, 9, 15, font);
  drawWarrantyFieldText(detailsPage, String(duration), 399, 581, 9, 19, font);
  drawWarrantyFieldText(detailsPage, unitLabel, 420, 581, 8, 36, font);
  drawWarrantyFieldText(detailsPage, commencementLabel, 36, 566, 8, 116, font);
  drawWarrantyFieldText(
    detailsPage,
    formatWarrantyDateForPdf(commencementDate),
    203,
    520,
    8,
    65,
    font
  );
  drawWarrantyFieldText(
    detailsPage,
    formatWarrantyDateForPdf(periodEndDate),
    475,
    520,
    8,
    59,
    font
  );
  drawWarrantyFieldText(detailsPage, representative, 178, 178, 8, 180, font);
  drawWarrantyFieldText(
    detailsPage,
    formatWarrantyDateForPdf(representativeDate),
    390,
    178,
    8,
    145,
    font
  );
  drawWarrantyFieldText(detailsPage, revisionPreparedBy, 129, 97, 8, 157, font);

  const warrantyBytes = await warrantyPdf.save();

  return new File(
    [warrantyBytes],
    templateFileName,
    { type: "application/pdf" }
  );
}

async function createCarWarrantyFile({
  materialYears,
  duration,
  unit,
  revisionPreparedBy
}) {
  const templateFileName = "CarWarranty.pdf";
  const templateBytes = await loadCarWarrantyTemplate(templateFileName);
  const warrantyPdf = await PDFDocument.load(templateBytes);
  const pages = warrantyPdf.getPages();
  const detailsPage = pages[pages.length - 1];
  const PDFName = window.PDFLib.PDFName;

  if (!detailsPage || !PDFName) {
    throw new Error("The car warranty template could not be loaded.");
  }

  const annotationsKey = PDFName.of("Annots");
  pages.forEach(page => page.node.delete(annotationsKey));
  warrantyPdf.catalog.delete(PDFName.of("AcroForm"));

  const font = await warrantyPdf.embedFont(StandardFonts.Helvetica);
  const projectNumber =
    document.getElementById("projectNumber")?.value.trim() || "";
  const materialLabel = `${materialYears} year(s)`;
  const laborLabel = unit === "months"
    ? `${duration} month(s)`
    : `${duration} days`;

  drawWarrantyFieldText(detailsPage, projectNumber, 213, 651, 9, 56, font);
  drawWarrantyFieldText(detailsPage, materialLabel, 182, 594, 8, 43, font);
  drawWarrantyFieldText(detailsPage, laborLabel, 250, 572, 8, 38, font);
  drawWarrantyFieldText(detailsPage, revisionPreparedBy, 139, 86, 8, 157, font);

  const warrantyBytes = await warrantyPdf.save();

  return new File(
    [warrantyBytes],
    templateFileName,
    { type: "application/pdf" }
  );
}

function updateWarrantyPeriodEnd() {
  const commencementDate =
    document.getElementById("warrantyCommencementDate")?.value || "";
  const periodEndInput = document.getElementById("warrantyPeriodEndDate");

  if (periodEndInput) {
    periodEndInput.value = getWarrantyPeriodEndDate(commencementDate);
  }
}

function getWarrantyPeriodEndDate(commencementDate) {
  const date = parseWarrantyDateInput(commencementDate);

  if (!date) return "";

  date.setDate(date.getDate() + 365);
  return getWarrantyDateInputValue(date);
}

function parseWarrantyDateInput(value) {
  const parts = String(value || "").split("-").map(Number);

  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) {
    return null;
  }

  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function getWarrantyDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatWarrantyDateForPdf(value) {
  const date = parseWarrantyDateInput(value);

  if (!date) return "";

  return [
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    date.getFullYear()
  ].join("/");
}

function drawWarrantyFieldText(page, text, x, y, size, maxWidth, font) {
  const value = String(text || "");
  let fontSize = size;

  while (fontSize > 6 && font.widthOfTextAtSize(value, fontSize) > maxWidth) {
    fontSize -= 0.5;
  }

  page.drawText(value, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
    maxWidth
  });
}

async function loadTransitWarrantyTemplate(templateFileName) {
  const templatePath = `Files/Warranty/Transit/${templateFileName}`;

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch(templatePath);

      if (response.ok) {
        return response.arrayBuffer();
      }
    } catch (error) {
      console.warn("Direct warranty template loading failed.", error);
    }
  }

  const base64 = await loadEmbeddedWarrantyTemplate(templateFileName);
  return decodeBase64Bytes(base64);
}

async function loadCarWarrantyTemplate(templateFileName) {
  const templatePath = `Files/Warranty/Car/${templateFileName}`;

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch(templatePath);

      if (response.ok) {
        return response.arrayBuffer();
      }
    } catch (error) {
      console.warn("Direct car warranty loading failed.", error);
    }
  }

  const existingTemplate =
    window.CAR_WARRANTY_TEMPLATES?.[templateFileName];

  if (existingTemplate) {
    return decodeBase64Bytes(existingTemplate);
  }

  const base64 = await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const dataFileName = templateFileName.replace(/\.pdf$/i, ".data.js");

    script.src = `Files/Warranty/Car/${dataFileName}`;
    script.async = true;
    script.onload = () => {
      const loadedTemplate =
        window.CAR_WARRANTY_TEMPLATES?.[templateFileName];

      script.remove();

      if (loadedTemplate) {
        resolve(loadedTemplate);
      } else {
        reject(new Error(`Car warranty data is missing: ${dataFileName}`));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Car warranty template not found: ${templateFileName}`));
    };

    document.head.appendChild(script);
  });

  return decodeBase64Bytes(base64);
}

function loadEmbeddedWarrantyTemplate(templateFileName) {
  const existingTemplate =
    window.TRANSIT_WARRANTY_TEMPLATES?.[templateFileName];

  if (existingTemplate) {
    return Promise.resolve(existingTemplate);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const dataFileName = templateFileName.replace(/\.pdf$/i, ".data.js");

    script.src = `Files/Warranty/Transit/${dataFileName}`;
    script.async = true;
    script.onload = () => {
      const loadedTemplate =
        window.TRANSIT_WARRANTY_TEMPLATES?.[templateFileName];

      script.remove();

      if (loadedTemplate) {
        resolve(loadedTemplate);
      } else {
        reject(new Error(`Warranty data is missing: ${dataFileName}`));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Warranty template not found: ${templateFileName}`));
    };

    document.head.appendChild(script);
  });
}

async function loadCoverPageAsset(fileName) {
  const assetPath = `Files/CoverPage/${fileName}`;

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch(assetPath);

      if (response.ok) {
        return response.arrayBuffer();
      }
    } catch (error) {
      console.warn("Direct cover asset loading failed.", error);
    }
  }

  const base64 = await loadEmbeddedCoverPageAsset(fileName);
  return decodeBase64Bytes(base64);
}

function loadEmbeddedCoverPageAsset(fileName) {
  const existingAsset = window.COVER_PAGE_ASSETS?.[fileName];

  if (existingAsset) {
    return Promise.resolve(existingAsset);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const dataFileName = fileName.replace(/\.[^.]+$/i, ".data.js");

    script.src = `Files/CoverPage/${dataFileName}`;
    script.async = true;
    script.onload = () => {
      const loadedAsset = window.COVER_PAGE_ASSETS?.[fileName];

      script.remove();

      if (loadedAsset) {
        resolve(loadedAsset);
      } else {
        reject(new Error(`Cover asset data is missing: ${dataFileName}`));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Cover asset not found: ${fileName}`));
    };

    document.head.appendChild(script);
  });
}

function decodeBase64Bytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/* --------------------------------------------------------------------------
   Datasheet order and page-level organization
   -------------------------------------------------------------------------- */

function openDatasheetOrderModal(datasheets) {
  const modal = document.getElementById("datasheetOrderModal");
  const list = document.getElementById("datasheetOrderList");

  if (!modal || !list) return;

  renderBuildSummary("datasheetBuildSummary");
  list.innerHTML = "";

  datasheets
    .sort((a, b) => (a.datasheetOrder ?? 999) - (b.datasheetOrder ?? 999))
    .forEach(item => {
      const row = document.createElement("div");
      row.className = "order-row";
      row.draggable = true;
      row.dataset.id = item.id;

      row.innerHTML = `
        <span class="drag-handle">☰</span>
        <span>${item.displayTitle}</span>
      `;

      row.addEventListener("dragstart", () => {
        row.classList.add("dragging");
      });

      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
      });

      list.appendChild(row);
    });

  list.ondragover = e => {
    e.preventDefault();

    const dragging = list.querySelector(".dragging");
    const afterElement = getDragAfterElement(list, e.clientY);

    if (!dragging) return;

    if (afterElement == null) {
      list.appendChild(dragging);
    } else {
      list.insertBefore(dragging, afterElement);
    }
  };

  modal.classList.remove("hidden");
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".order-row:not(.dragging)")
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return {
          offset,
          element: child
        };
      }

      return closest;
    },
    {
      offset: Number.NEGATIVE_INFINITY,
      element: null
    }
  ).element;
}

function closeDatasheetOrderModal() {
  const modal = document.getElementById("datasheetOrderModal");
  if (modal) modal.classList.add("hidden");
}

function getSectionsNeedingOrganization() {
  const included = pdfLibrary.filter(item => item.include);

  const romanSections =
    typeof isOMPacket === "function" && isOMPacket()
      ? OM_SECTION_ORDER
      : [
          "Warranty",
          "Datasheets",
          "Control Panel Components",
          "Shop Drawings",
          "Appendix"
        ];

  return romanSections
    .map(section => ({
      section,
      files: included.filter(item => item.packetSection === section)
    }))
    .filter(group => group.files.length > 1);
}

function openSectionOrderModal(sectionGroups) {
  const modal = document.getElementById("datasheetOrderModal");
  const list = document.getElementById("datasheetOrderList");

  if (!modal || !list) return;

  renderBuildSummary("datasheetBuildSummary");
  list.innerHTML = "";

  sectionGroups.forEach(group => {
    const details = document.createElement("details");
    details.className = "section-order-group";

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <strong>${getSectionLabel(group.section)}</strong>
      <span>${group.files.length} PDF(s)</span>
    `;

    const sectionList = document.createElement("div");
    sectionList.className = "section-order-list";
    sectionList.dataset.section = group.section;

    group.files
      .sort((a, b) => (a.datasheetOrder ?? 999) - (b.datasheetOrder ?? 999))
      .forEach(item => {
        const row = document.createElement("div");
        row.className = "order-row";
        row.draggable = true;
        row.dataset.id = item.id;

        row.innerHTML = `
          <span class="drag-handle">☰</span>
          <span>${item.displayTitle}</span>
        `;

        row.addEventListener("dragstart", () => {
          row.classList.add("dragging");
        });

        row.addEventListener("dragend", () => {
          row.classList.remove("dragging");
        });

        sectionList.appendChild(row);
      });

    sectionList.addEventListener("dragover", e => {
      e.preventDefault();

      const dragging = sectionList.querySelector(".dragging");
      const afterElement = getDragAfterElement(sectionList, e.clientY);

      if (!dragging) return;

      if (afterElement == null) {
        sectionList.appendChild(dragging);
      } else {
        sectionList.insertBefore(dragging, afterElement);
      }
    });

    details.appendChild(summary);
    details.appendChild(sectionList);
    list.appendChild(details);
  });

  modal.classList.remove("hidden");
}

function confirmDatasheetOrder() {
  recordBuilderUndoState();
  const groups = Array.from(
    document.querySelectorAll("#datasheetOrderList .section-order-list")
  );

  groups.forEach(group => {
    const rows = Array.from(group.querySelectorAll(".order-row"));

    rows.forEach((row, index) => {
      const item = pdfLibrary.find(x => x.id === row.dataset.id);

      if (item) {
        item.datasheetOrder = index + 1;
      }
    });
  });

  sortLibraryBySection();
  renderUploadedPdfList();
  closeDatasheetOrderModal();

  pendingBuild = true;
  buildPacket();
}

async function openSubsectionModal(id) {
  const item = pdfLibrary.find(x => x.id === id);
  if (!item) return;

  const modal = document.getElementById("subsectionModal");
  const title = document.getElementById("subsectionModalTitle");
  const activeId = document.getElementById("activeSubsectionPdfId");
  const previewList = document.getElementById("subsectionPagePreviewList");

  if (!modal || !title || !activeId || !previewList) return;

  title.textContent =
    `Format Levels: ${item.displayTitle}`;
  activeId.value = item.id;
  selectedManagedPages = new Set();

  const subsectionPageNumber = document.getElementById("subsectionPageNumber");
  const subsectionTitle = document.getElementById("subsectionTitle");
  const tocEntryType = document.getElementById("tocEntryType");

  clearTOCEntryForm();

  const hideParent =
    document.getElementById("hideParentTOC");

  if (hideParent) {
    hideParent.checked = item.hideParentTOC || false;
  }
  if (hideParent) {
    hideParent.onchange = () => {
      recordBuilderUndoState();
      item.hideParentTOC = hideParent.checked;
      cleanInvalidTOCParents(item);
      updatePDFParentTOCLevelControls();
      renderCurrentSubsectionList();
      applySmartTOCLevelDefault(item);
      updateTOCParentDropdown();
    };
  }
  if (tocEntryType) tocEntryType.value = "section";

  previewList.innerHTML = "Scanning TOC entries...";

  try {
    await scanTOCEntriesForEditor(item);
  } catch (error) {
    console.warn("TOC scan failed:", error);
  }

  previewList.innerHTML = "Loading page previews...";

  const tocEntryLevel = document.getElementById("tocEntryLevel");
  const tocEntryParent = document.getElementById("tocEntryParent");

  if (tocEntryLevel) tocEntryLevel.value = "0";
  if (tocEntryParent) {
    tocEntryParent.innerHTML = `<option value="">N/A</option>`;
    tocEntryParent.disabled = true;
  }

  renderCurrentSubsectionList();
  updatePDFParentTOCLevelControls();
  applySmartTOCLevelDefault(item);
  updateTOCParentDropdown();

  modal.classList.remove("hidden");

  await renderPDFPagePreviews(item);
}

async function closeSubsectionModal() {
  const item = getActiveSubsectionItem();
  if (await warnIncompleteTemplateTOCEntries(item)) return;

  const modal = document.getElementById("subsectionModal");
  if (modal) modal.classList.add("hidden");
  closeTOCTemplateModal();

  selectedManagedPages = new Set();
  clearTOCEntryForm();
  renderUploadedPdfList();
}

function clearImportedPacketFooter(page) {
  const { width, height } = page.getSize();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const edgeSize = 36;
  let rectangle;

  if (rotation === 90) {
    rectangle = { x: width - edgeSize, y: 0, width: edgeSize, height };
  } else if (rotation === 180) {
    rectangle = { x: 0, y: height - edgeSize, width, height: edgeSize };
  } else if (rotation === 270) {
    rectangle = { x: 0, y: 0, width: edgeSize, height };
  } else {
    rectangle = { x: 0, y: 0, width, height: edgeSize };
  }

  page.drawRectangle({ ...rectangle, color: rgb(1, 1, 1) });
}

async function renderPDFPagePreviews(item) {
  const previewList = document.getElementById("subsectionPagePreviewList");
  if (!previewList) return;

  previewList.innerHTML = "";
  selectedManagedPages = new Set();

  const bytes = await getSourcePDFBytes(item.file);

  const pdf = await pdfjsLib.getDocument(
    getPacketPDFJSOptions(bytes.slice(0))
  ).promise;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const viewport = page.getViewport({ scale: 0.8 });

    const wrapper = document.createElement("div");
    wrapper.className = "pdf-page-preview";
    wrapper.dataset.pageNumber = pageNumber;

    const header = document.createElement("div");
    const label = document.createElement("div");
    header.className = "page-preview-header";
    label.className = "page-preview-label";
    label.textContent = `Page ${pageNumber}`;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    header.appendChild(label);
    wrapper.appendChild(header);
    wrapper.appendChild(canvas);
    previewList.appendChild(wrapper);

    wrapper.addEventListener("click", event => {
      document.querySelectorAll(".pdf-page-preview").forEach(el => {
        el.classList.remove("selected");
      });

      wrapper.classList.add("selected");
      document.getElementById("subsectionPageNumber").value = pageNumber;

      // A normal click establishes one unambiguous page for TOC placement and
      // Extract/Delete. Ctrl/Cmd-click is the optional multi-page gesture.
      if (event.ctrlKey || event.metaKey) {
        if (selectedManagedPages.has(pageNumber)) {
          selectedManagedPages.delete(pageNumber);
        } else {
          selectedManagedPages.add(pageNumber);
        }
      } else {
        selectedManagedPages = new Set([pageNumber]);
      }

      document.querySelectorAll(".pdf-page-preview").forEach(el => {
        el.classList.toggle(
          "page-action-selected",
          selectedManagedPages.has(Number(el.dataset.pageNumber))
        );
      });
      updateSubsectionPageSelectionStatus(pdf.numPages);
    });

    await page.render({
      canvasContext: context,
      viewport
    }).promise;
  }

  updateSubsectionPageSelectionStatus(pdf.numPages);
}

function getActiveSubsectionItem() {
  const activeId = document.getElementById("activeSubsectionPdfId")?.value;
  return pdfLibrary.find(item => item.id === activeId);
}

function getTOCParentTitle(item, parentId) {
  if (!parentId) return "N/A";
  if (parentId === PDF_PARENT_TOC_ID) {
    return item.hideParentTOC ? "N/A" : item.displayTitle || item.fileName || "PDF Name";
  }

  const parent = (item.tocEntries || []).find(entry => entry.id === parentId);
  return parent ? parent.title : "N/A";
}

function hasValidTOCSourcePage(entry) {
  const page = Number(entry?.sourcePage);
  return Number.isInteger(page) && page > 0;
}

function compareTOCEntries(a, b) {
  const pageA = hasValidTOCSourcePage(a) ? Number(a.sourcePage) : Number.MAX_SAFE_INTEGER;
  const pageB = hasValidTOCSourcePage(b) ? Number(b.sourcePage) : Number.MAX_SAFE_INTEGER;

  return pageA - pageB ||
    Number(a?.tocLevel || 0) - Number(b?.tocLevel || 0);
}

function getIncompleteTOCEntries() {
  return pdfLibrary.flatMap(item =>
    (item.tocEntries || [])
      .filter(entry => !hasValidTOCSourcePage(entry))
      .map(entry => ({ item, entry }))
  );
}

function getIncompleteTemplateTOCEntries(item) {
  return (item?.tocEntries || []).filter(entry =>
    entry.requiresPageBeforeClose && !hasValidTOCSourcePage(entry)
  );
}

function focusFirstIncompleteTemplateTOCEntry(item) {
  const first = getIncompleteTemplateTOCEntries(item)[0];
  if (!first) return;

  const row = document.querySelector(`[data-toc-entry-id="${first.id}"]`);
  if (row) {
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.add("toc-tree-row-attention");
    window.setTimeout(() => row.classList.remove("toc-tree-row-attention"), 1600);
  }
}

async function warnIncompleteTemplateTOCEntries(item) {
  const missing = getIncompleteTemplateTOCEntries(item);
  if (missing.length === 0) return false;

  focusFirstIncompleteTemplateTOCEntry(item);
  await showMessageModal(
      "Template Pages Required",
      `${missing.length} template TOC row(s) still need a PDF page. Add pages to the rows marked Template page required, or remove those rows before closing Format Levels.`
  );
  return true;
}

function openTOCTemplateModal() {
  const item = getActiveSubsectionItem();
  const modal = document.getElementById("tocTemplateModal");
  const status = document.getElementById("tocTemplateStatus");

  if (!item || !modal) return;

  if (status) {
    status.textContent = "Template rows will be added with blank pages. Edit each row to assign pages before building.";
  }

  renderTOCTemplatePreview();
  modal.classList.remove("hidden");
}

function closeTOCTemplateModal() {
  const modal = document.getElementById("tocTemplateModal");
  if (modal) modal.classList.add("hidden");
}

function renderTOCTemplatePreview() {
  const container = document.getElementById("tocTemplatePreviewList");
  if (!container) return;

  container.replaceChildren();

  const searchInput = document.getElementById("tocTemplateSearch");
  const searchTerm = String(searchInput?.value || "").trim().toLowerCase();
  const templates = TOC_ENTRY_TEMPLATES
    .filter(template => {
      if (!searchTerm) return true;
      return [
        template.name,
        ...(template.entries || []).map(entry => entry.title)
      ].some(value => String(value || "").toLowerCase().includes(searchTerm));
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  if (templates.length === 0) {
    container.innerHTML = "<p>No templates match your search.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "toc-template-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Template</th><th>Levels</th><th></th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  templates.forEach(template => {
    const row = document.createElement("tr");

    const templateCell = document.createElement("td");
    templateCell.innerHTML = "<strong>" + template.name + "</strong>";

    const levelsCell = document.createElement("td");
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = template.entries.length + " level(s)";
    details.appendChild(summary);

    const levelList = document.createElement("div");
    levelList.className = "toc-template-level-list";

        template.entries.forEach(entry => {
      const levelNumber = Math.max(0, Math.min(2, Number(entry.tocLevel || 0)));
      const entryRow = document.createElement("div");
      entryRow.className = `toc-template-level-row toc-template-level-${levelNumber}`;
      entryRow.style.setProperty("--toc-level", String(levelNumber));

      const rail = document.createElement("span");
      rail.className = "toc-template-level-rail";

      const name = document.createElement("span");
      name.className = "toc-template-level-name";
      name.textContent = entry.title || "";

      const level = document.createElement("span");
      level.className = "toc-template-level-badge";
      level.textContent = "Level " + levelNumber;

      entryRow.append(rail, name, level);
      levelList.appendChild(entryRow);
    });
    details.appendChild(levelList);
    levelsCell.appendChild(details);

    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Select";
    button.addEventListener("click", () => applyTOCTemplate(template.id));
    actionCell.appendChild(button);

    row.append(templateCell, levelsCell, actionCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

async function applyTOCTemplate(templateId) {
  const item = getActiveSubsectionItem();
  const status = document.getElementById("tocTemplateStatus");
  const template = TOC_ENTRY_TEMPLATES.find(candidate => candidate.id === templateId);

  if (!item || !template) return;

  recordBuilderUndoState();
  item.hideParentTOC = true;
  const hideParent = document.getElementById("hideParentTOC");
  if (hideParent) hideParent.checked = true;

  const pendingEntries = template.entries.map(entry => ({
    id: crypto.randomUUID(),
    title: entry.title,
    sourcePage: null,
    entryType: Number(entry.tocLevel || 0) === 0 ? "section" : "subsection",
    tocLevel: Number(entry.tocLevel || 0),
    parentId: "",
    detectedTOCEntry: false,
    requiresPageBeforeClose: true
  }));

  const lastParentByLevel = new Map();
  pendingEntries.forEach(entry => {
    const level = Number(entry.tocLevel || 0);

    if (level > 0) {
      const parent = lastParentByLevel.get(level - 1);
      entry.parentId = parent?.id || "";

      if (!entry.parentId && level - 1 === getPDFParentTOCLevel(item) && !item.hideParentTOC) {
        entry.parentId = PDF_PARENT_TOC_ID;
      }
    }

    lastParentByLevel.set(level, entry);
    for (let deeperLevel = level + 1; deeperLevel <= 2; deeperLevel++) {
      lastParentByLevel.delete(deeperLevel);
    }
  });

  item.tocEntries = [
    ...(item.tocEntries || []),
    ...pendingEntries
  ];
  item.tocEntriesReviewed = true;
  cleanInvalidTOCParents(item);
  item.tocEntries.sort(compareTOCEntries);

  clearTOCEntryForm();
  clearSubsectionPageSelection();
  renderCurrentSubsectionList();
  updateTOCParentDropdown();
  if (status) status.textContent = "Template added. Edit the rows marked Page required before building.";
}

function updateTOCLevelFromSelect() {
  updateTOCParentDropdown();
}

function getDefaultTOCParentId(parentOptions = [], currentParentId = "") {
  if (currentParentId && parentOptions.some(entry => entry.id === currentParentId)) {
    return currentParentId;
  }

  return parentOptions.length ? parentOptions[parentOptions.length - 1].id : "";
}

function updatePDFParentTOCLevelControls() {
  const item = getActiveSubsectionItem();
  const levelSelect = document.getElementById("pdfParentTOCLevel");

  if (!item || !levelSelect) return;

  levelSelect.value = String(getPDFParentTOCLevel(item));
  levelSelect.disabled = !!item.hideParentTOC;
}

function updatePDFParentTOCLevelFromSelect() {
  const item = getActiveSubsectionItem();
  const levelSelect = document.getElementById("pdfParentTOCLevel");

  if (!item || !levelSelect) return;

  const cleanLevel = normalizePacketTOCLevel(levelSelect.value);
  if (getPDFParentTOCLevel(item) === cleanLevel) return;

  recordBuilderUndoState();
  item.tocLevel = cleanLevel;
  cleanInvalidTOCParents(item);
  renderCurrentSubsectionList();
  updateTOCParentDropdown();
  updateUploadedPdfCount();
}

function updateTOCParentDropdown(selectedParentId = "") {
  const item = getActiveSubsectionItem();
  const levelSelect = document.getElementById("tocEntryLevel");
  const parentSelect = document.getElementById("tocEntryParent");

  if (!item || !levelSelect || !parentSelect) return;

  const level = Number(levelSelect.value || 0);
  const currentParentId = selectedParentId || parentSelect.value || "";

  parentSelect.innerHTML = "";

  if (level === 0) {
    parentSelect.disabled = true;
    parentSelect.innerHTML = `<option value="">N/A</option>`;
    return;
  }

  const parentLevel = level - 1;
  const parentOptions = [];

  if (parentLevel === getPDFParentTOCLevel(item) && !item.hideParentTOC) {
    parentOptions.push({
      id: PDF_PARENT_TOC_ID,
      title: item.displayTitle || item.fileName || "PDF Name"
    });
  }

  parentOptions.push(
    ...(item.tocEntries || [])
      .filter(entry =>
        Number(entry.tocLevel || 0) === parentLevel &&
        entry.id !== editingTOCEntryId
      )
  );

  parentSelect.disabled = false;

  if (parentOptions.length === 0) {
    parentSelect.innerHTML = `<option value="">No Level ${parentLevel} parent yet</option>`;
    return;
  }

  const defaultParentId = getDefaultTOCParentId(parentOptions, currentParentId);

  parentSelect.innerHTML = parentOptions
    .map(entry => `
      <option value="${entry.id}" ${entry.id === defaultParentId ? "selected" : ""}>
        ${entry.id === PDF_PARENT_TOC_ID ? `PDF Name: ${entry.title}` : entry.title}
      </option>
    `)
    .join("");
}

function getLevelTwoLetter(item, entry) {
  const siblings = (item.tocEntries || []).filter(other =>
    Number(other.tocLevel || 0) === 2 &&
    other.parentId === entry.parentId
  );

  const index = siblings.findIndex(other => other.id === entry.id);
  return `${String.fromCharCode(97 + Math.max(index, 0))}.`;
}

function orderTOCEntriesForDisplay(entries = []) {
  const sorted = [...entries].sort(compareTOCEntries);

  const childrenByParent = new Map();

  sorted.forEach(entry => {
    const parentKey = entry.parentId || "";
    if (!childrenByParent.has(parentKey)) {
      childrenByParent.set(parentKey, []);
    }

    childrenByParent.get(parentKey).push(entry);
  });

  const ordered = [];

  function addChildren(parentId = "") {
    const children = childrenByParent.get(parentId) || [];

    children.forEach(child => {
      ordered.push(child);
      addChildren(child.id);
    });
  }

  addChildren(PDF_PARENT_TOC_ID);
  addChildren("");
  return ordered;
}

function clearTOCEntryForm() {
  editingTOCEntryId = "";

  const pageInput = document.getElementById("subsectionPageNumber");
  const titleInput = document.getElementById("subsectionTitle");
  const levelSelect = document.getElementById("tocEntryLevel");
  const parentSelect = document.getElementById("tocEntryParent");
  const actionButton = document.getElementById("tocEntryActionButton");

  if (pageInput) pageInput.value = "";
  if (titleInput) titleInput.value = "";
  if (levelSelect) levelSelect.value = "0";
  if (parentSelect) {
    parentSelect.innerHTML = `<option value="">N/A</option>`;
    parentSelect.disabled = true;
  }
  if (actionButton) actionButton.textContent = "Add TOC Entry";

  document.querySelectorAll(".pdf-page-preview").forEach(el => {
    el.classList.remove("selected");
  });

  applySmartTOCLevelDefault();
}

function applySmartTOCLevelDefault(item = getActiveSubsectionItem()) {
  const levelSelect = document.getElementById("tocEntryLevel");
  if (!item || !levelSelect || editingTOCEntryId) return;

  const hideParent = document.getElementById("hideParentTOC");
  const pdfNameHidden = hideParent ? hideParent.checked : !!item.hideParentTOC;
  const hasEntries = (item.tocEntries || []).length > 0;

  // The visible PDF name already occupies Level 0. When it is hidden, the
  // first named entry replaces it at Level 0 and following entries nest below.
  levelSelect.value = String(pdfNameHidden && !hasEntries ? 0 : 1);
  updateTOCParentDropdown();
}

async function saveTOCEntry() {
  const activeIdInput = document.getElementById("activeSubsectionPdfId");
  const pageInput = document.getElementById("subsectionPageNumber");
  const titleInput = document.getElementById("subsectionTitle");
  const levelSelect = document.getElementById("tocEntryLevel");
  const parentSelect = document.getElementById("tocEntryParent");

  if (!activeIdInput || !pageInput || !titleInput || !levelSelect || !parentSelect) {
    await showMessageModal("TOC Form Error", "TOC modal is missing required HTML fields. Check the modal IDs.");
    return;
  }

  const activeId = activeIdInput.value;
  const pageNumber = Number(pageInput.value);
  const title = titleInput.value.trim();
  const tocLevel = Number(levelSelect.value || 0);
  const parentId = parentSelect.value || "";

  const item = pdfLibrary.find(x => x.id === activeId);
  if (!item) return;

  const hideParent = document.getElementById("hideParentTOC");
  item.hideParentTOC = hideParent ? hideParent.checked : false;

  if (!pageNumber || pageNumber < 1) {
    await showMessageModal("Page Required", "Select a page.");
    return;
  }

  if (!title) {
    await showMessageModal("TOC Name Required", "Enter a TOC name.");
    return;
  }

  if (tocLevel > 0 && !parentId) {
    await showMessageModal("Parent Required", `Select a Level ${tocLevel - 1} parent first.`);
    return;
  }

  if (!item.tocEntries) {
    item.tocEntries = [];
  }

  const existingEntry = editingTOCEntryId
    ? item.tocEntries.find(entry => entry.id === editingTOCEntryId)
    : null;
  const duplicateEntry = item.tocEntries.find(entry =>
    entry.id !== editingTOCEntryId &&
    normalizeDuplicateName(entry.title) === normalizeDuplicateName(title)
  );

  if (duplicateEntry) {
    const duplicateAction = await promptDuplicateTOCEntryAction(title, duplicateEntry);

    if (duplicateAction === "skip") return;

    if (duplicateAction === "replace") {
      recordBuilderUndoState();
      duplicateEntry.title = title;
      duplicateEntry.sourcePage = pageNumber;
      duplicateEntry.entryType = tocLevel === 0 ? "section" : "subsection";
      duplicateEntry.tocLevel = tocLevel;
      duplicateEntry.parentId = tocLevel === 0 ? "" : parentId;
      duplicateEntry.detectedTOCEntry = false;
      duplicateEntry.requiresPageBeforeClose = false;
      item.tocEntriesReviewed = true;

      if (existingEntry) {
        promoteTOCChildrenBeforeRemoval(item, existingEntry);
        item.tocEntries = item.tocEntries.filter(entry => entry.id !== existingEntry.id);
      }

      cleanInvalidTOCParents(item);
      item.tocEntries.sort(compareTOCEntries);
      clearTOCEntryForm();
      renderCurrentSubsectionList();
      updateTOCParentDropdown();
      return;
    }
  }

  recordBuilderUndoState();

  if (existingEntry) {
    existingEntry.title = title;
    existingEntry.sourcePage = pageNumber;
    existingEntry.entryType = tocLevel === 0 ? "section" : "subsection";
    existingEntry.tocLevel = tocLevel;
    existingEntry.parentId = tocLevel === 0 ? "" : parentId;
    existingEntry.detectedTOCEntry = false;
    existingEntry.requiresPageBeforeClose = false;
    item.tocEntriesReviewed = true;
    cleanInvalidTOCParents(item);
  } else {
    item.tocEntries.push({
      id: crypto.randomUUID(),
      title,
      sourcePage: pageNumber,
      entryType: tocLevel === 0 ? "section" : "subsection",
      tocLevel,
      parentId: tocLevel === 0 ? "" : parentId,
      requiresPageBeforeClose: false
    });
    item.tocEntriesReviewed = true;
  }

  item.tocEntries.sort(compareTOCEntries);

  clearTOCEntryForm();
  renderCurrentSubsectionList();
  updateTOCParentDropdown();
}

function addTOCEntry() {
  saveTOCEntry();
}

function editSubsectionEntry(entryId) {
  const item = getActiveSubsectionItem();
  const entry = (item?.tocEntries || []).find(candidate => candidate.id === entryId);

  if (!item || !entry) return;

  editingTOCEntryId = entry.id;

  const pageInput = document.getElementById("subsectionPageNumber");
  const titleInput = document.getElementById("subsectionTitle");
  const levelSelect = document.getElementById("tocEntryLevel");
  const actionButton = document.getElementById("tocEntryActionButton");

  if (pageInput) pageInput.value = entry.sourcePage || "";
  if (titleInput) {
    titleInput.value = entry.title || "";
    titleInput.focus();
  }
  if (levelSelect) levelSelect.value = String(Number(entry.tocLevel || 0));
  if (actionButton) actionButton.textContent = "Save TOC Entry";

  updateTOCParentDropdown(entry.parentId || "");
}

function cleanInvalidTOCParents(item) {
  const entries = item.tocEntries || [];
  const validIds = new Set(entries.map(entry => entry.id));

  entries.forEach(entry => {
    const level = Number(entry.tocLevel || 0);

    if (level === 0) {
      entry.parentId = "";
      return;
    }

    const usesVisiblePdfParent =
      level - 1 === getPDFParentTOCLevel(item) &&
      entry.parentId === PDF_PARENT_TOC_ID &&
      !item.hideParentTOC;

    if (usesVisiblePdfParent) return;

    const parent = entries.find(candidate => candidate.id === entry.parentId);
    const expectedParentLevel = level - 1;

    if (!entry.parentId || !validIds.has(entry.parentId) || Number(parent?.tocLevel || 0) !== expectedParentLevel) {
      entry.parentId = "";
    }
  });
}

function promoteTOCChildrenBeforeRemoval(item, removedEntry) {
  if (!item || !removedEntry) return;

  const entries = item.tocEntries || [];
  const childrenByParent = new Map();

  entries.forEach(entry => {
    const parentKey = entry.parentId || "";
    if (!childrenByParent.has(parentKey)) {
      childrenByParent.set(parentKey, []);
    }
    childrenByParent.get(parentKey).push(entry);
  });

  function promoteBranch(parentId, replacementParentId = "") {
    const children = childrenByParent.get(parentId) || [];

    children.forEach(child => {
      const currentLevel = Number(child.tocLevel || 0);
      const promotedLevel = Math.max(0, currentLevel - 1);

      child.tocLevel = promotedLevel;
      child.entryType = promotedLevel === 0 ? "section" : "subsection";
      child.parentId = promotedLevel === 0 ? "" : replacementParentId;

      promoteDescendants(child.id);
    });
  }

  function promoteDescendants(parentId) {
    const children = childrenByParent.get(parentId) || [];

    children.forEach(child => {
      const promotedLevel = Math.max(0, Number(child.tocLevel || 0) - 1);
      child.tocLevel = promotedLevel;
      child.entryType = promotedLevel === 0 ? "section" : "subsection";
      if (promotedLevel === 0) child.parentId = "";
      promoteDescendants(child.id);
    });
  }

  promoteBranch(removedEntry.id, removedEntry.parentId || "");
}

function removeSubsectionEntry(entryId) {
  recordBuilderUndoState();
  const activeId = document.getElementById("activeSubsectionPdfId").value;
  const item = pdfLibrary.find(x => x.id === activeId);
  if (!item) return;

  const removedEntry = (item.tocEntries || []).find(entry => entry.id === entryId);
  promoteTOCChildrenBeforeRemoval(item, removedEntry);
  item.tocEntries = (item.tocEntries || []).filter(entry => entry.id !== entryId);
  item.tocEntriesReviewed = true;
  cleanInvalidTOCParents(item);

  if (editingTOCEntryId === entryId) {
    clearTOCEntryForm();
  }

  renderCurrentSubsectionList();
  updateTOCParentDropdown();
}

function getTOCEntryTreeRows(item) {
  const entries = orderTOCEntriesForDisplay(item.tocEntries || []);
  return entries.map(entry => ({
    entry,
    level: Math.max(0, Math.min(2, Number(entry.tocLevel || 0))),
    parentTitle: getTOCParentTitle(item, entry.parentId)
  }));
}

function getTOCLevelLabel(item, entry, level) {
  return level === 2 ? `${getLevelTwoLetter(item, entry)} Level 2` : `Level ${level}`;
}

function createTOCTreeMetaPill(text, className = "") {
  const pill = document.createElement("span");
  pill.className = `toc-tree-pill ${className}`.trim();
  pill.textContent = text;
  return pill;
}

function renderCurrentSubsectionList() {
  const activeId = document.getElementById("activeSubsectionPdfId").value;
  const list = document.getElementById("currentSubsectionList");

  if (!list) return;

  const item = pdfLibrary.find(x => x.id === activeId);

  if (!item || !item.tocEntries || item.tocEntries.length === 0) {
    list.className = "toc-tree-list";
    list.innerHTML = '<p class="toc-tree-empty">No TOC entries added yet.</p>';
    updateTOCParentDropdown();
    return;
  }

  list.innerHTML = "";
  list.className = "toc-tree-list";

  getTOCEntryTreeRows(item).forEach(({ entry, level, parentTitle }) => {
    const row = document.createElement("div");
    row.className = `toc-tree-row toc-tree-level-${level}`;
    row.dataset.tocEntryId = entry.id;
    if (!hasValidTOCSourcePage(entry)) row.classList.add("toc-tree-row-missing-page");
    if (entry.requiresPageBeforeClose && !hasValidTOCSourcePage(entry)) row.classList.add("toc-tree-row-required");
    row.style.setProperty("--toc-level", String(level));

    const rail = document.createElement("div");
    rail.className = "toc-tree-rail";

    const content = document.createElement("div");
    content.className = "toc-tree-content";

    const header = document.createElement("div");
    header.className = "toc-tree-header";

    const title = document.createElement("strong");
    title.className = "toc-tree-title";
    title.textContent = entry.title || "Untitled TOC entry";

    const levelBadge = document.createElement("span");
    levelBadge.className = "toc-tree-level-badge";
    levelBadge.textContent = getTOCLevelLabel(item, entry, level);

    header.append(title, levelBadge);

    const meta = document.createElement("div");
    meta.className = "toc-tree-meta";
    meta.append(
      createTOCTreeMetaPill(
        hasValidTOCSourcePage(entry) ? `PDF page ${entry.sourcePage}` : (entry.requiresPageBeforeClose ? "Template page required" : "Page required"),
        hasValidTOCSourcePage(entry) ? "" : "toc-entry-missing-page"
      ),
      createTOCTreeMetaPill(level === 0 ? "Top level" : `Under ${parentTitle}`)
    );

    content.append(header, meta);

    const actions = document.createElement("div");
    actions.className = "toc-tree-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editSubsectionEntry(entry.id));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-pdf-btn";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeSubsectionEntry(entry.id));

    actions.append(editButton, removeButton);
    row.append(rail, content, actions);
    list.appendChild(row);
  });
}

/* --------------------------------------------------------------------------
   PDF composition, internal links, TOC drawing, numbering, and export
   -------------------------------------------------------------------------- */

async function appendPDF(finalPdf, file, options = {}) {
  const startIndex = finalPdf.getPageCount();

  const bytes = await getSourcePDFBytes(file);
  const sourcePdf = await PDFDocument.load(bytes);
  const copiedPages = await finalPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

  copiedPages.forEach(page => {
    if (options.clearFooter) clearImportedPacketFooter(page);
    finalPdf.addPage(page);
  });

  const endIndex = finalPdf.getPageCount() - 1;

  const addedIndexes = [];
  for (let i = startIndex; i <= endIndex; i++) {
    addedIndexes.push(i);
  }

  return addedIndexes;
}

function markImportedSubsectionPages(pdfDoc, addedIndexes, item) {
  if (!item || addedIndexes.length === 0) return;

  const PDFName = window.PDFLib.PDFName;
  const PDFString = window.PDFLib.PDFString;
  const subsectionTitleKey = PDFName.of("PacketSubsectionTitle");
  const subsectionSectionKey = PDFName.of("PacketSubsectionSection");
  const sectionEntries = (item.tocEntries || []).filter(
    entry => entry.entryType === "section"
  );

  if (
    sectionEntries.length === 0 &&
    item.packetSection === "Datasheets" &&
    item.displayTitle
  ) {
    sectionEntries.push({
      title: item.displayTitle,
      sourcePage: 1
    });
  }

  sectionEntries.forEach(entry => {
    const sourcePage = Number(entry.sourcePage);
    const finalPageIndex = addedIndexes[sourcePage - 1];

    if (finalPageIndex === undefined) return;

    const page = pdfDoc.getPage(finalPageIndex);
    page.node.set(subsectionTitleKey, PDFString.of(entry.title));
    page.node.set(subsectionSectionKey, PDFString.of(item.packetSection));
  });
}

async function getSourcePDFBytes(file) {
  if (!sourcePDFBytesCache.has(file)) {
    sourcePDFBytesCache.set(file, file.arrayBuffer());
  }

  return sourcePDFBytesCache.get(file);
}

function addInternalPageLink(pdfDoc, sourcePage, x, y, width, height, targetPageIndex) {
  const resolvedTargetPageIndex = Number(targetPageIndex);

  if (
    !Number.isInteger(resolvedTargetPageIndex) ||
    resolvedTargetPageIndex < 0 ||
    resolvedTargetPageIndex >= pdfDoc.getPageCount()
  ) {
    return;
  }

  const targetPage = pdfDoc.getPage(resolvedTargetPageIndex);
  if (!targetPage) return;

  const annotation = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y, x + width, y + height],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "GoTo",
      D: [targetPage.ref, "XYZ", null, null, null]
    }
  });

  const annotationRef = pdfDoc.context.register(annotation);
  sourcePage.node.addAnnot(annotationRef);
}

function truncateTextToWidth(text, font, size, maxWidth) {
  const value = sanitizePDFTextForFont(text, font);

  if (font.widthOfTextAtSize(value, size) <= maxWidth) {
    return value;
  }

  let shortened = value;

  while (
    shortened.length > 0 &&
    font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth
  ) {
    shortened = shortened.slice(0, -1);
  }

  return `${shortened.trim()}...`;
}

function normalizePDFText(text) {
  return String(text ?? "")
    .replace(/[\t\r\n\f\v]+/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizePDFTextForFont(text, font) {
  const value = normalizePDFText(text);

  if (!font || typeof font.encodeText !== "function") {
    return value;
  }

  try {
    font.encodeText(value);
    return value;
  } catch (error) {
    return Array.from(value)
      .map(char => {
        try {
          font.encodeText(char);
          return char;
        } catch (charError) {
          return " ";
        }
      })
      .join("")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
}

async function drawTOCOnExistingPage(
  pdfDoc,
  page,
  tocItems,
  sectionTargets = {}
) {
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const projectNumber = document.getElementById("projectNumber")?.value || "";
  const projectName = document.getElementById("projectName")?.value || "";
  const projectAddress = document.getElementById("projectAddress")?.value || "";

  const { width, height } = page.getSize();

  const leftMargin = 0.7 * 72;
  const topMargin = 0.44 * 72;
  const rightMargin = 0.38 * 72;
  const footerMargin = 65;

  const pageRight = width - rightMargin;
  const startY = height - topMargin;
  let tocInsertIndex = pdfDoc.getPages().indexOf(page) + 1;
  const firstInsertedTOCPageIndex = tocInsertIndex;
  let insertedTOCPageCount = 0;
  const pendingTOCLinks = [];

  function cleanText(text, font = times) {
    return sanitizePDFTextForFont(text, font);
  }

  function markTOCPage(tocPage) {
    tocPage.node.set(
      window.PDFLib.PDFName.of("PacketSection"),
      window.PDFLib.PDFString.of("Table of Contents")
    );
  }

  function queueInternalPageLink(sourcePage, x, y, width, height, targetPageIndex) {
    pendingTOCLinks.push({
      sourcePage,
      x,
      y,
      width,
      height,
      targetPageIndex
    });
  }

  function getFinalTOCTargetPageIndex(targetPageIndex) {
    const pageIndex = Number(targetPageIndex);
    if (!Number.isInteger(pageIndex)) return null;

    const shiftedPageIndex =
      pageIndex >= firstInsertedTOCPageIndex
        ? pageIndex + insertedTOCPageCount
        : pageIndex;

    return Math.max(
      0,
      Math.min(pdfDoc.getPageCount() - 1, shiftedPageIndex)
    );
  }

  function centerText(text, y, size, font) {
    const safeText = cleanText(text, font);
    const textWidth = font.widthOfTextAtSize(safeText, size);

    page.drawText(safeText, {
      x: (width - textWidth) / 2,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    });
  }

  function drawUnderlinedText(text, x, y, size, font) {
    const safeText = cleanText(text, font);

    page.drawText(safeText, {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    });

    const textWidth = font.widthOfTextAtSize(safeText, size);

    page.drawLine({
      start: { x, y: y - 2 },
      end: { x: x + textWidth, y: y - 2 },
      thickness: 0.75,
      color: rgb(0, 0, 0)
    });
  }

  function drawDottedLeader(startX, endX, y) {
    let x = startX;
    const dotGap = 4;

    while (x < endX) {
      page.drawText(".", {
        x,
        y,
        size: 12,
        font: times,
        color: rgb(0, 0, 0)
      });

      x += dotGap;
    }
  }

  page.drawText(cleanText(`NS Corp. Project No.: ${projectNumber}`), {
    x: leftMargin,
    y: startY,
    size: 12,
    font: times
  });

  page.drawText(cleanText(`Project Name: ${projectName}`), {
    x: leftMargin,
    y: startY - 15,
    size: 12,
    font: times
  });

  page.drawText(cleanText(`Project Address: ${projectAddress}`), {
    x: leftMargin,
    y: startY - 30,
    size: 12,
    font: times
  });

  const isOM =
    typeof isOMPacket === "function" &&
    isOMPacket();

  const packetTitle =
    typeof getPacketTitle === "function"
      ? getPacketTitle()
      : "Product Submittal";

  const packetSubtitle =
    typeof getPacketSubtitle === "function"
      ? getPacketSubtitle()
      : "";

  if (isOM) {
    centerText(packetTitle, startY - 50, 18, timesBoldItalic);
    centerText(packetSubtitle, startY - 72, 18, timesBoldItalic);
  } else {
    centerText(packetTitle, startY - 50, 18, timesBold);
  }

  const tocText = "Table of Contents";
  const tocSize = 20;
  const tocWidth = timesBoldItalic.widthOfTextAtSize(tocText, tocSize);
  const tocX = (width - tocWidth) / 2;
  const pageNoX = pageRight - 55;

  const tocHeaderY = isOM ? startY - 115 : startY - 90;
  const pageNoY = isOM ? startY - 155 : startY - 130;
  let y = isOM ? startY - 185 : startY - 160;

  drawUnderlinedText(
    tocText,
    tocX,
    tocHeaderY,
    tocSize,
    timesBoldItalic
  );

  page.drawText("Page No.", {
    x: pageNoX,
    y: pageNoY,
    size: 12,
    font: times
  });

  const sectionDefinitions = getPacketTOCSectionDefinitions();

  let sectionNumber = 0;
  const displayedPageNumbers = new Set();

  sectionDefinitions.forEach(section => {
    const items = tocItems.filter(item => item.section === section);
    const sectionTarget = sectionTargets[section];

    if (items.length === 0 && !sectionTarget) return;
    const roman = sectionTarget?.roman || toRoman(sectionNumber + 1);
    sectionNumber++;

    const sectionLabel = getSectionLabel(section);
    const sectionText = cleanText(`${roman}. ${sectionLabel}`, timesBold);
    if (y < footerMargin + 25) {
      page = pdfDoc.insertPage(tocInsertIndex, [612, 792]);
      tocInsertIndex++;
      insertedTOCPageCount++;

      markTOCPage(page);

      y = height - topMargin - 30;

      page.drawText(cleanText("Table of Contents (Continued)", timesBold), {
        x: leftMargin,
        y,
        size: 16,
        font: timesBold
      });

      y -= 28;
    }
    page.drawText(sectionText, {
      x: leftMargin,
      y,
      size: 12,
      font: timesBold
    });

    if (sectionTarget) {
      const sectionPageNumber = String(sectionTarget.pageNumber);
      const sectionTextWidth =
        timesBold.widthOfTextAtSize(sectionText, 12);
      const sectionPageWidth =
        timesBold.widthOfTextAtSize(sectionPageNumber, 12);
      const sectionPageX = pageRight - sectionPageWidth;

      drawDottedLeader(
        leftMargin + sectionTextWidth + 6,
        sectionPageX - 8,
        y
      );

      page.drawText(sectionPageNumber, {
        x: sectionPageX,
        y,
        size: 12,
        font: timesBold
      });
      displayedPageNumbers.add(sectionPageNumber);

      queueInternalPageLink(
        page,
        leftMargin,
        y - 2,
        sectionTextWidth,
        14,
        sectionTarget.targetPageIndex
      );

      queueInternalPageLink(
        page,
        sectionPageX,
        y - 2,
        sectionPageWidth,
        14,
        sectionTarget.targetPageIndex
      );
    }

    y -= 14;

    const filteredItems = getFilteredTOCItemsForSection(items, sectionLabel);

        filteredItems.forEach(item => {
        // Move to a new TOC page before drawing into the footer
        if (y < footerMargin) {
          page = pdfDoc.insertPage(tocInsertIndex, [612, 792]);
          tocInsertIndex++;
          insertedTOCPageCount++;
          markTOCPage(page);

          y = height - topMargin - 30;

          page.drawText(cleanText("Table of Contents (Continued)", timesBold), {
            x: leftMargin,
            y,
            size: 16,
            font: timesBold
          });

          y -= 28;
        }

        const level = normalizePacketTOCLevel(item.tocLevel);
      const levelSettings = {
        0: { bullet: "•", bulletX: leftMargin + 18, titleX: leftMargin + 32 },
        1: { bullet: "-", bulletX: leftMargin + 48, titleX: leftMargin + 62 },
        2: { bullet: "", bulletX: leftMargin + 84, titleX: leftMargin + 104 }
      };

      const settings = levelSettings[level] || levelSettings[0];

      let bullet = settings.bullet;

      if (level === 2) {        const levelTwoSiblings = filteredItems.filter(other =>
          Number(other.tocLevel || 0) === 2 &&
          (other.parentId || "") === (item.parentId || "")
        );

        const siblingIndex = levelTwoSiblings.findIndex(other => other === item);
        bullet = `${String.fromCharCode(97 + Math.max(siblingIndex, 0))}.`;
      }

      const bulletX = settings.bulletX;
      const titleX = settings.titleX;
      const pageNum = `${item.startPage}`;
      const showPageNumber = !displayedPageNumbers.has(pageNum);
      const pageNumWidth = times.widthOfTextAtSize(pageNum, 12);
      const pageNumX = pageRight - pageNumWidth;

      page.drawText(bullet, {
        x: bulletX,
        y,
        size: 14,
        font: times
      });

      const maxTitleWidth = pageNumX - titleX - 34;
      const safeTitle = truncateTextToWidth(item.title, times, 12, maxTitleWidth);

      page.drawText(safeTitle, {
        x: titleX,
        y,
        size: 12,
        font: times
      });

      const titleWidth = times.widthOfTextAtSize(safeTitle, 12);

      if (showPageNumber) {
        drawDottedLeader(titleX + titleWidth + 6, pageNumX - 8, y);
      }

      if (item.targetPageIndex !== undefined) {
        queueInternalPageLink(
          page,
          titleX,
          y - 2,
          titleWidth,
          14,
          item.targetPageIndex
        );

        if (showPageNumber) {
          queueInternalPageLink(
            page,
            pageNumX,
            y - 2,
            pageNumWidth,
            14,
            item.targetPageIndex
          );
        }
      }

      if (showPageNumber) {
        page.drawText(pageNum, {
          x: pageNumX,
          y,
          size: 12,
          font: times
        });
        displayedPageNumbers.add(pageNum);
      }

      y -= 12;
    });

    y -= 4;
  });

  pendingTOCLinks.forEach(link => {
    const targetPageIndex = getFinalTOCTargetPageIndex(link.targetPageIndex);
    if (targetPageIndex == null) return;

    addInternalPageLink(
      pdfDoc,
      link.sourcePage,
      link.x,
      link.y,
      link.width,
      link.height,
      targetPageIndex
    );
  });
}

// Retained for compatibility reference. The guarded implementation below is the
// active helper and safely handles missing documents and out-of-range indexes.
function pageIndexIsTOCPageLegacy(pdfDoc, pageIndex) {
  const page = pdfDoc.getPage(pageIndex);
  const PDFName = window.PDFLib.PDFName;
  const sectionKey = PDFName.of("PacketSection");

  return page.node.get(sectionKey)?.decodeText?.() === "Table of Contents";
}

async function addPageNumbers(pdfDoc, skipPageIndexes = []) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const revision = document.getElementById("revision")?.value || "0";
  const dateMade = new Date().toLocaleDateString();

  let printedPageNumber = 1;
  let tocPrintedPageNumber = 1;

  pages.forEach((page, index) => {
    if (skipPageIndexes.includes(index)) return;

    const { width, height } = page.getSize();
    const mode = getPageNumberMode();
    const isTOCPage = pageIndexIsTOCPage(pdfDoc, index);

    let pageNumber;

    if (mode === "book" && isTOCPage) {
      pageNumber = toLowerRoman(tocPrintedPageNumber);
      tocPrintedPageNumber++;
    } else {
      pageNumber = `${printedPageNumber}`;
      printedPageNumber++;
    }

    const pageFontSize = 11;
    const revFontSize = 9;

    const bottomMargin = 3;
    const sideSafeMargin = 30;

    const rotation = page.getRotation().angle;

    const pageNumWidth = font.widthOfTextAtSize(pageNumber, pageFontSize);
    const revisionText = `Rev. ${revision} , ${dateMade}`;
    const revisionWidth = font.widthOfTextAtSize(revisionText, revFontSize);

    let pageX;
    let pageY;
    let revX;
    let revY;
    let rotate;

    switch (rotation) {
      case 90:
        pageX = width - bottomMargin;
        pageY = (height / 2) - (pageNumWidth / 2);

        revX = width - bottomMargin;
        revY = height - revisionWidth - sideSafeMargin;

        rotate = PDFLib.degrees(90);
        break;

      case 180:
        pageX = (width / 2) + (pageNumWidth / 2);
        pageY = height - bottomMargin;

        revX = sideSafeMargin;
        revY = height - bottomMargin;

        rotate = PDFLib.degrees(180);
        break;

      case 270:
        pageX = bottomMargin;
        pageY = (height / 2) + (pageNumWidth / 2);

        revX = bottomMargin;
        revY = revisionWidth + sideSafeMargin;

        rotate = PDFLib.degrees(270);
        break;

      default:
        pageX = (width - pageNumWidth) / 2;
        pageY = bottomMargin;

        revX = width - revisionWidth - sideSafeMargin;
        revY = bottomMargin;

        rotate = PDFLib.degrees(0);
        break;
    }

    page.drawText(pageNumber, {
      x: pageX,
      y: pageY,
      size: pageFontSize,
      font,
      rotate,
      color: rgb(0, 0, 0)
    });

    page.drawText(revisionText, {
      x: revX,
      y: revY,
      size: revFontSize,
      font,
      rotate,
      color: rgb(0, 0, 0)
    });
  });
}

function pageIndexIsTOCPage(pdfDoc, pageIndex) {
  if (!pdfDoc) return false;
  if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) return false;

  const page = pdfDoc.getPage(pageIndex);
  const PDFName = window.PDFLib.PDFName;
  const sectionKey = PDFName.of("PacketSection");

  return page.node.get(sectionKey)?.decodeText?.() === "Table of Contents";
}

function exportCSV() {
  const headers = [
    "Date",
    "File Name",
    "Display Title",
    "Document Type",
    "Packet Section",
    "Include",
    "Notes"
  ];

  const rows = pdfLibrary.map(item => [
    item.uploadDate,
    item.fileName,
    item.displayTitle,
    item.documentType,
    item.packetSection,
    item.include,
    item.notes
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadFile(csv, "submittal-library.csv", "text/csv");
}

function getOutputFileName() {
  const projectNumber = document.getElementById("projectNumber").value || "Project";
  const projectName = document.getElementById("projectName").value || "Submittal";
  const revision = document.getElementById("revision").value || "1";

  return `${projectNumber} - ${projectName} - Submittal Rev ${revision}.pdf`;
}
