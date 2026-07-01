let pdfLibrary = [];
let pendingBuild = false;
let customSectionLabels = {};
const sourcePDFBytesCache = new WeakMap();
let romanCoverPageBytesPromise = null;
let warrantyPromptHandled = false;
let selectedManagedPages = new Set();
let pendingSubmittalImportFile = null;
let submittalImportPreviewToken = 0;
let currentBuildPdfDoc = null;
let editingTOCEntryId = "";
const PDF_PARENT_TOC_ID = "__pdf_parent__";

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

const submittalImport = document.getElementById("submittalImport");
if (submittalImport) {
  submittalImport.addEventListener("change", handleSubmittalImportSelection);
}

document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");
  setupSubmittalImportDropZone();
  renderPacketHistory();

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
      include: true,
      notes: "",
      datasheetOrder: null,
      tocEntries: [],
      hideParentTOC: false
    };

    if (duplicateItem) {
      const action = await promptDuplicatePDFAction(cleanName, duplicateItem);

      if (action === "skip") {
        skippedFileCount += 1;
        continue;
      }

      if (action === "replace") {
        Object.assign(duplicateItem, {
          ...newItem,
          id: duplicateItem.id,
          tocEntries: duplicateItem.tocEntries || [],
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

    item.displayTitle = cleanTitle;

    const detectedSection = guessPacketSection(cleanTitle);
    const detectedType = guessDocumentType(cleanTitle);

    item.packetSection = detectedSection;
    item.documentType = detectedType;

    if (detectedSection !== "Datasheets") {
      item.datasheetOrder = null;
    }

    sortLibraryBySection();
    renderUploadedPdfList();
}

function updateUploadedPDFSection(id, newSection) {
  const item = pdfLibrary.find(x => x.id === id);
  if (!item) return;

  item.packetSection = newSection;
  item.documentType = guessDocumentType(newSection);

  if (newSection !== "Datasheets") {
    item.datasheetOrder = null;
  }

  sortLibraryBySection();
  renderUploadedPdfList();
}

function renderUploadedPdfList() {
  const container = document.getElementById("uploadedPdfList");
  if (!container) return;

  container.innerHTML = "";

  pdfLibrary.forEach(item => {
    const row = document.createElement("div");
    row.className = "uploaded-pdf-row";

    const canFormatTOC = item.packetSection !== "Warranty";
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
          Format TOC
        </button>
      `
      : "";

    const managePdfButton = !canFormatTOC
      ? `
        <button onclick="openPageManager('${item.id}')">
          Manage PDF
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
        ${managePdfButton}

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
    countEl.textContent = "0 PDFs uploaded.";
    return;
  }

  const included = pdfLibrary.filter(item => item.include !== false).length;
  const tocCounts = pdfLibrary.reduce(
    (counts, item) => {
      const itemCounts = getTOCEntryCounts(item.tocEntries || []);
      counts.sections += itemCounts.sections;
      counts.subsections += itemCounts.subsections;
      return counts;
    },
    { sections: 0, subsections: 0 }
  );

  countEl.textContent =
    `${total} PDF(s) uploaded | ${included} included | ${tocCounts.sections} section(s) | ${tocCounts.subsections} subsection(s)`;
}

function getTOCEntryCounts(entries = []) {
  return entries.reduce(
    (counts, entry) => {
      if (entry.entryType === "section") {
        counts.sections += 1;
      } else {
        counts.subsections += 1;
      }
      return counts;
    },
    { sections: 0, subsections: 0 }
  );
}

function formatTOCEntryCount(entries = []) {
  const counts = getTOCEntryCounts(entries);
  const parts = [];

  if (counts.sections > 0) {
    parts.push(`${counts.sections} section(s)`);
  }

  parts.push(`${counts.subsections} subsection(s)`);
  return parts.join(", ");
}

async function openPageManager(id) {
  const item = pdfLibrary.find(entry => entry.id === id);
  const modal = document.getElementById("pageManagerModal");
  const activeId = document.getElementById("activePageManagerPdfId");
  const title = document.getElementById("pageManagerTitle");

  if (!item || !modal || !activeId || !title) return;

  activeId.value = id;
  title.textContent = item.displayTitle || item.fileName;
  selectedManagedPages = new Set();
  modal.classList.remove("hidden");

  await renderPageManagerPreviews(item);
}

function closePageManager() {
  document.getElementById("pageManagerModal")?.classList.add("hidden");
  selectedManagedPages = new Set();
}

function getActivePageManagerItem() {
  const pageManagerModal = document.getElementById("pageManagerModal");
  const pageManagerOpen =
    pageManagerModal && !pageManagerModal.classList.contains("hidden");
  const id = pageManagerOpen
    ? document.getElementById("activePageManagerPdfId")?.value
    : document.getElementById("activeSubsectionPdfId")?.value;

  return pdfLibrary.find(item => item.id === id);
}

async function renderPageManagerPreviews(item) {
  const previewList = document.getElementById("pageManagerPreviewList");
  const status = document.getElementById("pageManagerStatus");

  if (!previewList) return;

  previewList.innerHTML = "";
  if (status) status.textContent = "Loading pages...";

  try {
    const sourceBytes = await getSourcePDFBytes(item.file);
    const pdf = await pdfjsLib.getDocument({ data: sourceBytes.slice(0) }).promise;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const card = document.createElement("div");
      const header = document.createElement("label");
      const checkbox = document.createElement("input");
      const label = document.createElement("span");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      card.className = "page-manager-card";
      card.dataset.pageNumber = String(pageNumber);
      header.className = "page-manager-card-header";
      checkbox.type = "checkbox";
      checkbox.value = String(pageNumber);
      label.textContent = `Page ${pageNumber}`;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const updateSelection = checked => {
        checkbox.checked = checked;
        card.classList.toggle("selected", checked);

        if (checked) {
          selectedManagedPages.add(pageNumber);
        } else {
          selectedManagedPages.delete(pageNumber);
        }

        updatePageManagerStatus(pdf.numPages);
      };

      checkbox.addEventListener("change", () => {
        updateSelection(checkbox.checked);
      });
      card.addEventListener("click", event => {
        if (event.target === checkbox) return;
        updateSelection(!checkbox.checked);
      });

      header.appendChild(checkbox);
      header.appendChild(label);
      card.appendChild(header);
      card.appendChild(canvas);
      previewList.appendChild(card);

      await page.render({ canvasContext: context, viewport }).promise;
    }

    updatePageManagerStatus(pdf.numPages);
  } catch (error) {
    console.error("Could not render PDF pages:", error);
    if (status) status.textContent = "The PDF pages could not be loaded.";
  }
}

function updatePageManagerStatus(totalPages) {
  const status = document.getElementById("pageManagerStatus");
  if (!status) return;

  status.textContent =
    `${selectedManagedPages.size} of ${totalPages} page(s) selected`;
}

function updateSubsectionPageSelectionStatus(totalPages) {
  const status = document.getElementById("subsectionPageSelectionStatus");
  if (!status) return;

  status.textContent =
    `${selectedManagedPages.size} of ${totalPages} page(s) selected for PDF actions`;
}

function selectAllSubsectionPages() {
  const previews = Array.from(document.querySelectorAll(".pdf-page-preview"));
  selectedManagedPages = new Set(
    previews.map(preview => Number(preview.dataset.pageNumber))
  );

  previews.forEach(preview => {
    preview.classList.add("page-action-selected");
    const checkbox = preview.querySelector(".page-edit-checkbox");
    if (checkbox) checkbox.checked = true;
  });

  updateSubsectionPageSelectionStatus(previews.length);
}

function clearSubsectionPageSelection() {
  const previews = Array.from(document.querySelectorAll(".pdf-page-preview"));
  selectedManagedPages = new Set();

  previews.forEach(preview => {
    preview.classList.remove("page-action-selected");
    const checkbox = preview.querySelector(".page-edit-checkbox");
    if (checkbox) checkbox.checked = false;
  });

  updateSubsectionPageSelectionStatus(previews.length);
}

function selectAllManagedPages() {
  const cards = Array.from(document.querySelectorAll(".page-manager-card"));
  selectedManagedPages = new Set(
    cards.map(card => Number(card.dataset.pageNumber))
  );

  cards.forEach(card => {
    card.classList.add("selected");
    const checkbox = card.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = true;
  });

  updatePageManagerStatus(cards.length);
}

function clearManagedPageSelection() {
  const cards = Array.from(document.querySelectorAll(".page-manager-card"));
  selectedManagedPages = new Set();

  cards.forEach(card => {
    card.classList.remove("selected");
    const checkbox = card.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = false;
  });

  updatePageManagerStatus(cards.length);
}

async function extractSelectedPages() {
  const item = getActivePageManagerItem();
  const selectedPages = Array.from(selectedManagedPages).sort((a, b) => a - b);

  if (!item || selectedPages.length === 0) {
    await showMessageModal("Pages Required", "Select at least one page to extract.");
    return;
  }

  try {
    const sourceBytes = await getSourcePDFBytes(item.file);
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const extractedPdf = await PDFDocument.create();
    const pageIndexes = selectedPages.map(pageNumber => pageNumber - 1);
    const copiedPages = await extractedPdf.copyPages(sourcePdf, pageIndexes);

    copiedPages.forEach(page => extractedPdf.addPage(page));

    const outputBytes = await extractedPdf.save();
    const baseName = item.fileName.replace(/\.pdf$/i, "");
    downloadFile(
      outputBytes,
      `${baseName} - Extracted Pages.pdf`,
      "application/pdf"
    );
  } catch (error) {
    console.error("Could not extract PDF pages:", error);
    await showMessageModal("Extract Failed", "The selected pages could not be extracted.");
  }
}

async function deleteSelectedPages() {
  const item = getActivePageManagerItem();
  const selectedPages = Array.from(selectedManagedPages).sort((a, b) => a - b);

  if (!item || selectedPages.length === 0) {
    await showMessageModal("Pages Required", "Select at least one page to delete.");
    return;
  }

  try {
    const sourceBytes = await getSourcePDFBytes(item.file);
    const sourcePdf = await PDFDocument.load(sourceBytes);

    if (selectedPages.length >= sourcePdf.getPageCount()) {
      await showMessageModal("Cannot Delete All Pages", "A PDF must keep at least one page.");
      return;
    }

    if (!(await showConfirmModal("Delete Pages", `Delete ${selectedPages.length} selected page(s)?`, "Delete"))) return;

    const deletedPageSet = new Set(selectedPages);
    const keptIndexes = sourcePdf.getPageIndices().filter(
      pageIndex => !deletedPageSet.has(pageIndex + 1)
    );
    const editedPdf = await PDFDocument.create();
    const copiedPages = await editedPdf.copyPages(sourcePdf, keptIndexes);

    copiedPages.forEach(page => editedPdf.addPage(page));

    const editedBytes = await editedPdf.save();
    item.file = new File(
      [editedBytes],
      item.fileName,
      { type: "application/pdf", lastModified: Date.now() }
    );
    item.tocEntries = (item.tocEntries || []).flatMap(entry => {
      if (deletedPageSet.has(entry.sourcePage)) return [];

      const deletedBefore = selectedPages.filter(
        pageNumber => pageNumber < entry.sourcePage
      ).length;

      return [{ ...entry, sourcePage: entry.sourcePage - deletedBefore }];
    });

    selectedManagedPages = new Set();
    renderUploadedPdfList();

    const pageManagerModal = document.getElementById("pageManagerModal");
    const pageManagerOpen =
      pageManagerModal && !pageManagerModal.classList.contains("hidden");

    if (pageManagerOpen) {
      await renderPageManagerPreviews(item);
    } else {
      renderCurrentSubsectionList();
      await renderPDFPagePreviews(item);
    }
  } catch (error) {
    console.error("Could not delete PDF pages:", error);
    await showMessageModal("Delete Failed", "The selected pages could not be deleted.");
  }
}

function removeUploadedPDF(id) {
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

  pdfLibrary = [];

  const pdfUpload = document.getElementById("pdfUpload");
  if (pdfUpload) {
    pdfUpload.value = "";
  }
  const importInput = document.getElementById("submittalImport");
  if (importInput) importInput.value = "";
  const importStatus = document.getElementById("submittalImportStatus");
  if (importStatus) importStatus.textContent = "";
  const importModalStatus = document.getElementById("submittalImportModalStatus");
  if (importModalStatus) importModalStatus.textContent = "No PDF selected.";
  pendingSubmittalImportFile = null;
  closeSubmittalImportModal();

  const modal = document.getElementById("datasheetOrderModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  pendingBuild = false;
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

function getPacketBuildLabel() {
  return typeof isOMPacket === "function" && isOMPacket()
    ? "O&M manual"
    : "Submittal packet";
}

function updatePacketBuildStatus(message = "") {
  const status = document.getElementById("packetBuildStatus");
  if (!status) return;

  status.textContent = message || "Ready to build.";
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

async function getPacketHistoryItems() {
  const type = getPacketHistoryType();

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
    include: item.include !== false,
    hideParentTOC: !!item.hideParentTOC
  };
});

  customSectionLabels = { ...(builderState.customSectionLabels || {}) };
  pendingBuild = false;
  warrantyPromptHandled = false;
  selectedManagedPages = new Set();
  pendingSubmittalImportFile = null;

  Object.entries(builderState.fields || {}).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value || "";
  });

  const pdfUpload = document.getElementById("pdfUpload");
  if (pdfUpload) pdfUpload.value = "";
  const importInput = document.getElementById("submittalImport");
  if (importInput) importInput.value = "";
  const importStatus = document.getElementById("submittalImportStatus");
  if (importStatus) importStatus.textContent = "";
  const importModalStatus = document.getElementById("submittalImportModalStatus");
  if (importModalStatus) importModalStatus.textContent = "No PDF selected.";

  [
    "warrantyPromptModal",
    "datasheetOrderModal",
    "subsectionModal",
    "pageManagerModal",
    "submittalImportModal"
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

  try {
    const items = await getPacketHistoryItems();
    const label = getPacketHistoryTitle();

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

  pendingBuild = false;
  updatePacketBuildStatus(`Building ${buildLabel}...`);

  try {
  buildContext = "creating a new PDF";
  const finalPdf = await PDFDocument.create();
  currentBuildPdfDoc = finalPdf;
  const noNumberPageIndexes = [];

  const included = pdfLibrary.filter(item => item.include);
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

    // Warranty document titles are added only when tocDetection finds them.
    if (!item.hideParentTOC && item.packetSection !== "Warranty") {
      tocItems.push({
        title: item.displayTitle,
        section: item.packetSection,
        startPage,
        targetPageIndex: finalPdf.getPageCount(),
        tocLevel: 0,
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
    } else {
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

  buildContext = "saving the local history copy";
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

  updatePacketBuildStatus("Downloading final PDF...");
  downloadFile(pdfBytes, outputName, "application/pdf");
  console.log("Download function ran.");
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

  buildContext = "resetting the builder";
  resetPacketBuilder();
  updatePacketBuildStatus(`${buildLabel} downloaded. Ready for the next build.`);
  } catch (error) {
    console.error(`Could not build ${buildLabel}:`, error);
    pendingBuild = false;
    warrantyPromptHandled = false;
    const message = getBuildErrorMessage(buildLabel, error, buildContext);
    updatePacketBuildStatus(message);
    await showMessageModal("Build Paused", message);
  }
}

function resetPacketBuilder() {
  pdfLibrary = [];
  pendingBuild = false;
  warrantyPromptHandled = false;
  customSectionLabels = {};

  const pdfUpload = document.getElementById("pdfUpload");
  if (pdfUpload) pdfUpload.value = "";
  const importInput = document.getElementById("submittalImport");
  if (importInput) importInput.value = "";
  const importStatus = document.getElementById("submittalImportStatus");
  if (importStatus) importStatus.textContent = "";
  const importModalStatus = document.getElementById("submittalImportModalStatus");
  if (importModalStatus) importModalStatus.textContent = "No PDF selected.";
  pendingSubmittalImportFile = null;
  closeSubmittalImportModal();

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

  list.addEventListener("dragover", e => {
    e.preventDefault();

    const dragging = list.querySelector(".dragging");
    const afterElement = getDragAfterElement(list, e.clientY);

    if (!dragging) return;

    if (afterElement == null) {
      list.appendChild(dragging);
    } else {
      list.insertBefore(dragging, afterElement);
    }
  });

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
    `TOC Entries: ${item.displayTitle}`;
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
      item.hideParentTOC = hideParent.checked;
      cleanInvalidTOCParents(item);
      renderCurrentSubsectionList();
      updateTOCParentDropdown();
    };
  }
  if (tocEntryType) tocEntryType.value = "section";

  previewList.innerHTML = "Loading page previews...";

  const tocEntryLevel = document.getElementById("tocEntryLevel");
  const tocEntryParent = document.getElementById("tocEntryParent");

  if (tocEntryLevel) tocEntryLevel.value = "0";
  if (tocEntryParent) {
    tocEntryParent.innerHTML = `<option value="">N/A</option>`;
    tocEntryParent.disabled = true;
  }

  renderCurrentSubsectionList();
  updateTOCParentDropdown();

  modal.classList.remove("hidden");

  await renderPDFPagePreviews(item);
}

function closeSubsectionModal() {
  const modal = document.getElementById("subsectionModal");
  if (modal) modal.classList.add("hidden");

  selectedManagedPages = new Set();
  clearTOCEntryForm();
  renderUploadedPdfList();
}

function openSubmittalImportModal() {
  const modal = document.getElementById("submittalImportModal");
  const status =
    document.getElementById("submittalImportModalStatus") ||
    document.getElementById("submittalImportStatus");

  if (!modal) {
    document.getElementById("submittalImport")?.click();
    return;
  }

  if (status) status.textContent = "No PDF selected.";
  clearSubmittalImportSummary();
  modal.classList.remove("hidden");
}

function closeSubmittalImportModal() {
  const modal = document.getElementById("submittalImportModal");
  if (modal) modal.classList.add("hidden");
  clearSubmittalImportSummary();
}

function setupSubmittalImportDropZone() {
  const dropZone = document.getElementById("submittalImportDropZone");
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

    const file = getFirstPDFFile(event.dataTransfer.files);
    setPendingSubmittalImportFile(file);
  });
}

function getFirstPDFFile(fileList) {
  return Array.from(fileList || []).find(file =>
    file.type === "application/pdf" || /\.pdf$/i.test(file.name)
  ) || null;
}

function setPendingSubmittalImportFile(file) {
  const status =
    document.getElementById("submittalImportModalStatus") ||
    document.getElementById("submittalImportStatus");
  const previewToken = ++submittalImportPreviewToken;

  pendingSubmittalImportFile = file || null;
  clearSubmittalImportSummary();

  if (status) {
    status.textContent = pendingSubmittalImportFile
      ? `Reading sections from ${pendingSubmittalImportFile.name}...`
      : "Drop or choose a complete Submittal PDF.";
  }

  if (!pendingSubmittalImportFile) return;

  previewSubmittalImportFile(pendingSubmittalImportFile, previewToken);
}

function handleSubmittalImportSelection(event) {
  setPendingSubmittalImportFile(getFirstPDFFile(event.target.files));
}

async function confirmSubmittalImport() {
  const input = document.getElementById("submittalImport");
  const file = pendingSubmittalImportFile || getFirstPDFFile(input?.files);
  const status =
    document.getElementById("submittalImportModalStatus") ||
    document.getElementById("submittalImportStatus");

  if (!file) {
    if (status) status.textContent = "Drop or choose a complete Submittal PDF first.";
    return;
  }

  await importSubmittalFile(file);
}

async function previewSubmittalImportFile(file, previewToken) {
  const status =
    document.getElementById("submittalImportModalStatus") ||
    document.getElementById("submittalImportStatus");

  try {
    const summary = await getSubmittalImportSummary(file);
    if (previewToken !== submittalImportPreviewToken) return;

    renderSubmittalImportSummary(summary);
    if (status) {
      status.textContent = summary.some(item => item.range)
        ? `Ready to import ${file.name}.`
        : "No matching sections were detected in this PDF.";
    }
  } catch (error) {
    if (previewToken !== submittalImportPreviewToken) return;
    console.error("Could not preview Submittal import:", error);
    if (status) {
      status.textContent =
        error.message || "The Submittal PDF could not be previewed.";
    }
  }
}

async function getSubmittalImportSummary(file) {
  const bytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(bytes);
  const pageCount = sourcePdf.getPageCount();
  const sectionMarkers = await detectImportedPacketSections(bytes, sourcePdf);
  const tocSectionRanges = await getImportedTOCSectionRanges(bytes, pageCount);
  const sections = [
    {
      section: "Warranty",
      range: getImportedSectionRange(sectionMarkers, "Warranty", pageCount),
      subsections: []
    },
    {
      section: "Datasheets",
      range:
        tocSectionRanges.Datasheets ||
        getImportedSectionRange(sectionMarkers, "Datasheets", pageCount),
      subsections: []
    },
    {
      section: "Shop Drawings",
      range:
        tocSectionRanges["Shop Drawings"] ||
        getImportedSectionRange(sectionMarkers, "Shop Drawings", pageCount),
      subsections: []
    }
  ];

  for (const item of sections) {
    if (!item.range) continue;

    if (item.section === "Datasheets") {
      item.subsections = await getImportedDatasheetRanges(
        bytes,
        sourcePdf,
        item.range
      );
    } else if (
      item.section === "Shop Drawings"
    ) {
      item.subsections = await detectImportedSubsectionRangesFromCompleteTOC(
        bytes,
        item.range,
        item.section
      );
    }
  }

  return sections;
}

function clearSubmittalImportSummary() {
  const container = document.getElementById("submittalImportDetectedSections");
  if (!container) return;

  container.replaceChildren();
  container.classList.add("hidden");
}

function renderSubmittalImportSummary(summary) {
  const container = document.getElementById("submittalImportDetectedSections");
  if (!container) return;

  container.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = "Detected sections";
  container.appendChild(heading);

  summary.forEach(item => {
    const sectionBlock = document.createElement("div");
    sectionBlock.className = "import-summary-section";

    const title = document.createElement("strong");
    title.textContent = item.range
      ? `${item.section} - pages ${item.range.startPageIndex + 1}-${item.range.endPageIndex}`
      : `${item.section} - not detected`;
    sectionBlock.appendChild(title);

    const subsections = item.subsections || [];
    if (subsections.length > 0) {
      const list = document.createElement("ul");
      subsections.forEach((subsection, index) => {
        const listItem = document.createElement("li");
        const title = subsection.title || `${item.section} ${index + 1}`;
        const nestedEntries = subsection.tocEntries || [];
        listItem.textContent = nestedEntries.length > 0
          ? `${title} (${formatTOCEntryCount(nestedEntries)})`
          : title;

        if (nestedEntries.length > 0) {
          const nestedList = document.createElement("ul");
          nestedEntries.forEach(entry => {
            const nestedItem = document.createElement("li");
            nestedItem.textContent = entry.title;
            nestedList.appendChild(nestedItem);
          });
          listItem.appendChild(nestedList);
        }

        list.appendChild(listItem);
      });
      sectionBlock.appendChild(list);
    } else if (item.range) {
      const note = document.createElement("span");
      note.textContent = "No subsections detected; this will import as one PDF.";
      sectionBlock.appendChild(note);
    }

    container.appendChild(sectionBlock);
  });

  container.classList.remove("hidden");
}

async function importSubmittalToOM(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;

  await importSubmittalFile(file, {
    importWarranty: true,
    importDatasheets: true
  });
}

async function importSubmittalFile(file, options = {}) {
  const input = document.getElementById("submittalImport");
  const status = document.getElementById("submittalImportStatus");
  const modalStatus =
    document.getElementById("submittalImportModalStatus") || status;
  const importWarranty = options.importWarranty !== false;
  const importDatasheets = options.importDatasheets !== false;

  if (!file) return;
  if (!importWarranty && !importDatasheets) {
    if (modalStatus) {
      modalStatus.textContent = "Select at least one section to import.";
    }
    return;
  }

  const existingImports = pdfLibrary.filter(item => item.importedFromSubmittal);
  if (
    existingImports.length > 0 &&
    !(await showConfirmModal("Replace Imported Sections", "Replace the previously imported Submittal sections?", "Replace"))
  ) {
    if (input) input.value = "";
    return;
  }

  if (status) status.textContent = "Reading Submittal sections...";
  if (modalStatus) modalStatus.textContent = "Reading Submittal sections...";

  try {
    const bytes = await file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(bytes);
    const sectionMarkers = await detectImportedPacketSections(bytes, sourcePdf);
    const tocSectionRanges = await getImportedTOCSectionRanges(
      bytes,
      sourcePdf.getPageCount()
    );
    const importedItems = [];

    const warrantyRange = importWarranty
      ? getImportedSectionRange(
          sectionMarkers,
          "Warranty",
          sourcePdf.getPageCount()
        )
      : null;
    const datasheetRange = importDatasheets
      ? tocSectionRanges.Datasheets ||
        getImportedSectionRange(
          sectionMarkers,
          "Datasheets",
          sourcePdf.getPageCount()
        )
      : null;
    const shopDrawingsRange =
      tocSectionRanges["Shop Drawings"] ||
      getImportedSectionRange(
        sectionMarkers,
        "Shop Drawings",
        sourcePdf.getPageCount()
      );
    console.table([
      { section: "Warranty", ...(warrantyRange || {}) },
      { section: "Datasheets", ...(datasheetRange || {}) },
      { section: "Shop Drawings", ...(shopDrawingsRange || {}) }
    ]);

    if (warrantyRange) {
      const warrantyFile = await extractImportedSection(
        sourcePdf,
        warrantyRange,
        "Imported Submittal - Warranty.pdf"
      );

      importedItems.push(createImportedLibraryItem({
        file: warrantyFile,
        sourceName: file.name,
        displayTitle: "Manufacturer's Limited Warranty",
        documentType: "Warranty",
        packetSection: "Warranty",
        hideParentTOC: true,
        datasheetOrder: null
      }));
    }

    if (datasheetRange) {
      importedItems.push(
        ...(await createImportedDatasheetItems({
          bytes,
          sourcePdf,
          sourceName: file.name,
          datasheetRange
        }))
      );
    }

    if (shopDrawingsRange) {
      importedItems.push(
        ...(await createImportedSectionItems({
          bytes,
          sourcePdf,
          sourceName: file.name,
          sectionRange: shopDrawingsRange,
          packetSection: "Shop Drawings",
          documentType: "Shop Drawing",
          fallbackTitle: "Imported Submittal Shop Drawings",
          filePrefix: "Imported Submittal - Shop Drawings"
        }))
      );
    }

    if (importedItems.length === 0) {
      throw new Error(
        "No Warranty, Datasheets, or Shop Drawings entries were detected in the Submittal PDF."
      );
    }

    pdfLibrary = pdfLibrary.filter(item => !item.importedFromSubmittal);
    pdfLibrary.push(...importedItems);
    sortLibraryBySection();
    renderUploadedPdfList();

    const importedSections = Array.from(
      new Set(importedItems.map(item => item.packetSection))
    );
    const importSummary =
      `Imported ${importedSections.join(", ")} from ${file.name}.`;
    if (status) {
      status.textContent = importSummary;
    }
    if (modalStatus) {
      modalStatus.textContent = importSummary;
    }
    closeSubmittalImportModal();
  } catch (error) {
    console.error("Could not import Submittal PDF:", error);
    if (status) {
      status.textContent =
        error.message || "The Submittal PDF could not be imported.";
    }
    if (modalStatus) {
      modalStatus.textContent =
        error.message || "The Submittal PDF could not be imported.";
    }
  } finally {
    if (input) input.value = "";
    pendingSubmittalImportFile = null;
  }
}

function createImportedLibraryItem({
  file,
  sourceName,
  displayTitle,
  documentType,
  packetSection,
  hideParentTOC,
  datasheetOrder,
  tocEntries = []
}) {
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    uploadDate: new Date().toLocaleDateString(),
    displayTitle,
    documentType,
    packetSection,
    include: true,
    notes: `Imported from ${sourceName}`,
    datasheetOrder,
    tocEntries,
    hideParentTOC,
    importedFromSubmittal: true
  };
}

async function createImportedDatasheetItems({
  bytes,
  sourcePdf,
  sourceName,
  datasheetRange
}) {
  const subsectionRanges = await getImportedDatasheetRanges(
    bytes,
    sourcePdf,
    datasheetRange
  );

  if (subsectionRanges.length > 0) {
    const items = [];

    for (let index = 0; index < subsectionRanges.length; index++) {
      const range = subsectionRanges[index];
      const title = range.title || `Imported Datasheet ${index + 1}`;
      const datasheetFile = await extractImportedSection(
        sourcePdf,
        range,
        sanitizeImportedFileName(`${index + 1} - ${title}.pdf`)
      );

      items.push(createImportedLibraryItem({
        file: datasheetFile,
        sourceName,
        displayTitle: title,
        documentType: "Datasheet",
        packetSection: "Datasheets",
        hideParentTOC: false,
        datasheetOrder: -1000 + index,
        tocEntries: range.tocEntries || []
      }));
    }

    return items;
  }

  const datasheetFile = await extractImportedSection(
    sourcePdf,
    datasheetRange,
    "Imported Submittal - Datasheets.pdf"
  );

  return [
    createImportedLibraryItem({
      file: datasheetFile,
      sourceName,
      displayTitle: "Original Submittal Datasheets",
      documentType: "Datasheet",
      packetSection: "Datasheets",
      hideParentTOC: false,
      datasheetOrder: -1000
    })
  ];
}

async function createImportedSectionItems({
  bytes,
  sourcePdf,
  sourceName,
  sectionRange,
  packetSection,
  documentType,
  fallbackTitle,
  filePrefix
}) {
  const subsectionRanges = await detectImportedSubsectionRangesFromCompleteTOC(
    bytes,
    sectionRange,
    packetSection
  );

  if (subsectionRanges.length > 0) {
    const items = [];

    for (let index = 0; index < subsectionRanges.length; index++) {
      const range = subsectionRanges[index];
      const title = range.title || `${fallbackTitle} ${index + 1}`;
      const subsectionFile = await extractImportedSection(
        sourcePdf,
        range,
        sanitizeImportedFileName(`${index + 1} - ${title}.pdf`)
      );

      items.push(createImportedLibraryItem({
        file: subsectionFile,
        sourceName,
        displayTitle: title,
        documentType,
        packetSection,
        hideParentTOC: false,
        datasheetOrder: packetSection === "Datasheets" ? -1000 + index : null
      }));
    }

    return items;
  }

  const sectionFile = await extractImportedSection(
    sourcePdf,
    sectionRange,
    `${filePrefix}.pdf`
  );

  return [
    createImportedLibraryItem({
      file: sectionFile,
      sourceName,
      displayTitle: fallbackTitle,
      documentType,
      packetSection,
      hideParentTOC: false,
      datasheetOrder: packetSection === "Datasheets" ? -1000 : null
    })
  ];
}

async function getImportedDatasheetRanges(bytes, sourcePdf, datasheetRange) {
  const metadataRanges = getImportedDatasheetMetadataRanges(
    sourcePdf,
    datasheetRange
  );

  if (metadataRanges.length > 0) return metadataRanges;

  return detectImportedDatasheetRangesFromCompleteTOC(bytes, datasheetRange);
}

function getImportedDatasheetMetadataRanges(sourcePdf, datasheetRange) {
  const PDFName = window.PDFLib.PDFName;
  const titleKey = PDFName.of("PacketSubsectionTitle");
  const sectionKey = PDFName.of("PacketSubsectionSection");
  const markers = [];

  sourcePdf.getPages().forEach((page, pageIndex) => {
    if (
      pageIndex < datasheetRange.startPageIndex ||
      pageIndex >= datasheetRange.endPageIndex
    ) {
      return;
    }

    const section = page.node.get(sectionKey)?.decodeText?.();
    const title = page.node.get(titleKey)?.decodeText?.();

    if (section === "Datasheets" && title) {
      markers.push({ pageIndex, title });
    }
  });

  return buildRangesFromImportedMarkers(markers, datasheetRange);
}

async function detectImportedDatasheetRangesFromCompleteTOC(bytes, datasheetRange) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const tocItems = await detectImportedTOCEntries(pdf);
  const datasheetItems = tocItems
    .filter(item =>
      item.section === "Datasheets" &&
      !item.isSectionHeading
    )
    .filter(item =>
      item.pageIndex >= datasheetRange.startPageIndex &&
      item.pageIndex < datasheetRange.endPageIndex
    );

  return buildHierarchicalImportedRanges(datasheetItems, datasheetRange);
}

async function detectImportedSubsectionRangesFromCompleteTOC(
  bytes,
  parentRange,
  packetSection
) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const tocItems = await detectImportedTOCEntries(pdf);

  return buildRangesFromImportedMarkers(
    tocItems
      .filter(item =>
        item.section === packetSection &&
        !item.isSectionHeading
      )
      .filter(item =>
        item.pageIndex >= parentRange.startPageIndex &&
        item.pageIndex < parentRange.endPageIndex
      ),
    parentRange
  );
}

async function detectImportedDatasheetRangesFromTOC(bytes, datasheetRange) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const tocItems = [];
  let printedPageOffset = null;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = buildImportedTextLines(content.items);
    const pageText = normalizeImportedSectionText(lines.join(" "));

    if (!pageText.includes("table of contents")) continue;

    if (printedPageOffset === null) {
      printedPageOffset = pageNumber - 2;
    }

    let inDatasheets = false;

    lines.forEach(line => {
      const normalized = normalizeImportedSectionText(line);

      if (/^[ivxlcdm]+\s+/.test(normalized)) {
        inDatasheets =
          normalized.includes("datasheet") ||
          normalized.includes("equipment data");
        return;
      }

      if (!inDatasheets) return;

      const match = line
        .replace(/[•*]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .match(/^(.+?)\s+(\d+)$/);

      if (!match) return;

      const title = match[1].replace(/[.\-]+$/g, "").trim();
      const printedPage = Number(match[2]);
      const pageIndex = printedPage + printedPageOffset - 1;

      if (
        title &&
        pageIndex >= datasheetRange.startPageIndex &&
        pageIndex < datasheetRange.endPageIndex
      ) {
        tocItems.push({ pageIndex, title });
      }
    });
  }

  return buildRangesFromImportedMarkers(tocItems, datasheetRange);
}

function buildImportedTextLines(items) {
  return buildImportedTextRows(items).map(row => row.text);
}

function buildImportedTextRows(items) {
  const rows = [];

  items.forEach(item => {
    const text = String(item.str || "").replace(/\s+/g, " ").trim();
    if (!text) return;

    const transform = item.transform || [];
    const x = transform[4] || 0;
    const y = transform[5] || 0;
    let row = rows.find(existing => Math.abs(existing.y - y) < 8);

    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }

    row.parts.push({ x, text });
  });

  return rows
    .sort((a, b) => b.y - a.y)
    .map(row => {
      const parts = row.parts
        .sort((a, b) => a.x - b.x)
        .map(part => ({ ...part }));

      return {
        y: row.y,
        parts,
        text: parts
          .map(part => part.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      };
    })
    .filter(row => row.text);
}

function buildRangesFromImportedMarkers(markers, parentRange) {
  const uniqueMarkers = [];
  const seenPages = new Set();

  markers
    .sort((a, b) => a.pageIndex - b.pageIndex)
    .forEach(marker => {
      if (seenPages.has(marker.pageIndex)) return;
      seenPages.add(marker.pageIndex);
      uniqueMarkers.push(marker);
    });

  if (uniqueMarkers.length === 0) return [];

  return uniqueMarkers
    .map((marker, index) => ({
      startPageIndex: marker.pageIndex,
      endPageIndex:
        uniqueMarkers[index + 1]?.pageIndex ?? parentRange.endPageIndex,
      title: marker.title
    }))
    .filter(range => range.startPageIndex < range.endPageIndex);
}

function buildHierarchicalImportedRanges(markers, parentRange) {
  const sortedMarkers = [...markers]
    .filter(marker => marker.pageIndex != null)
    .sort((a, b) => a.pageIndex - b.pageIndex);
  const sectionMarkers = sortedMarkers.filter(marker =>
    marker.tocLevel !== "subsection"
  );

  if (sectionMarkers.length === 0) {
    return buildRangesFromImportedMarkers(sortedMarkers, parentRange);
  }

  return sectionMarkers
    .map((marker, index) => {
      const nextSection = sectionMarkers[index + 1];
      const startPageIndex = marker.pageIndex;
      const endPageIndex = nextSection?.pageIndex ?? parentRange.endPageIndex;
      const tocEntries = sortedMarkers
        .filter(child =>
          child.tocLevel === "subsection" &&
          child.pageIndex >= startPageIndex &&
          child.pageIndex < endPageIndex
        )
        .map(child => ({
          id: crypto.randomUUID(),
          title: child.title,
          sourcePage: child.pageIndex - startPageIndex + 1,
          entryType: "subsection"
        }));

      return {
        startPageIndex,
        endPageIndex,
        title: marker.title,
        tocEntries
      };
    })
    .filter(range => range.startPageIndex < range.endPageIndex);
}

function sanitizeImportedFileName(fileName) {
  return String(fileName || "Imported Datasheet.pdf")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanImportedTOCTitle(title) {
  return String(title || "")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/(?:\s+\.\s*){2,}/g, " ")
    .replace(/\s+\.\s+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s*\-]+/g, "")
    .replace(/[\s.\-]+$/g, "")
    .trim();
}

function getImportedTOCLevel(title) {
  const value = String(title || "");
  if (/^\s*[-–—]/.test(value)) return "subsection";
  if (/^\s*(?:\u2022|\*)/.test(value)) return "section";
  return "section";
}

function isKnownImportedSectionHeading(title) {
  return getImportedSectionTitleMap().has(normalizeImportedSectionText(title));
}

function getImportedSectionTitleMap() {
  return new Map([
    ["warranty", "Warranty"],
    ["safety procedures", "Safety Procedures"],
    ["maintenance", "Maintenance"],
    ["testing checklist and testing procedures", "Testing Checklist and Testing Procedures"],
    ["testing checklist", "Testing Checklist and Testing Procedures"],
    ["testing procedures", "Testing Checklist and Testing Procedures"],
    ["testing procedure", "Testing Checklist and Testing Procedures"],
    ["testing", "Testing Checklist and Testing Procedures"],
    ["sequence of operations", "Sequence of Operations"],
    ["parts list", "Parts List"],
    ["equipment datasheets", "Datasheets"],
    ["equipment data", "Datasheets"],
    ["datasheets", "Datasheets"],
    ["control panel components", "Control Panel Components"],
    ["electrical schematics", "Electrical Schematics"],
    ["shop drawings", "Shop Drawings"],
    ["shop drawing", "Shop Drawings"],
    ["drawings", "Shop Drawings"],
    ["manuals", "Manuals"],
    ["appendix", "Appendix"]
  ]);
}

async function detectImportedSectionMarkersFromTOC(pdf) {
  const tocEntries = await detectImportedTOCEntries(pdf);
  const markersBySection = new Map();

  tocEntries.forEach(entry => {
    if (!entry.section) return;
    const existingMarker = markersBySection.get(entry.section);

    if (existingMarker) {
      if (!entry.isSectionHeading && existingMarker.firstChildPageIndex === undefined) {
        existingMarker.firstChildPageIndex = entry.pageIndex;
      }
      return;
    }

    markersBySection.set(entry.section, {
      pageIndex: entry.pageIndex,
      section: entry.section,
      skipMarkerPage: entry.isSectionHeading,
      firstChildPageIndex: entry.isSectionHeading ? undefined : entry.pageIndex
    });
  });

  return Array.from(markersBySection.values());
}

async function detectImportedTOCEntries(pdf) {
  const entries = [];
  const diagnostics = [];
  let currentSection = "";
  let pendingSectionHeading = null;
  let printedPageOffset = null;
  let foundTOC = false;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = buildImportedTextRows(content.items);
    const lines = rows.map(row => row.text);
    const pageText = normalizeImportedSectionText(lines.join(" "));
    const pageOffset = printedPageOffset ?? pageNumber - 2;
    const parsedRows = rows
      .map(row => {
        const parsed =
          parseImportedTOCRow(row, pageOffset) ||
          parseImportedTOCLine(row.text, pageOffset) ||
          parseImportedTOCHeadingLine(row.text);
        if (!parsed || !isLikelyImportedTOCRow(row, parsed)) return null;
        return parsed;
      })
      .filter(Boolean);
    const hasTOCLikeRows = parsedRows.length > 0;
    const hasTOCHeading = pageText.includes("table of contents");

    if (
      !hasTOCHeading &&
      !(foundTOC && hasTOCLikeRows) &&
      !(pageNumber <= 8 && hasTOCLikeRows)
    ) {
      if (foundTOC && pageNumber > 12) break;
      continue;
    }

    if (printedPageOffset === null) {
      printedPageOffset = pageNumber - 2;
    }

    foundTOC = true;
    diagnostics.push(...lines.slice(0, 80));

    parsedRows.forEach(parsed => {
      if (parsed.isSectionHeading && parsed.section) {
        currentSection = parsed.section;
        pendingSectionHeading = parsed;
        entries.push(parsed);
        return;
      }

      if (!parsed.section) {
        parsed.section = currentSection;
      }

      if (!parsed.section) return;

      if (
        pendingSectionHeading &&
        pendingSectionHeading.section === parsed.section &&
        pendingSectionHeading.pageIndex == null
      ) {
        pendingSectionHeading.pageIndex = Math.max(0, parsed.pageIndex - 1);
      }

      entries.push(parsed);
    });
  }

  if (entries.length === 0 && diagnostics.length > 0) {
    console.warn("Submittal import could not parse TOC lines:", diagnostics);
  } else {
    console.table(entries.map(entry => ({
      title: entry.title,
      section: entry.section,
      pageIndex: entry.pageIndex,
      tocLevel: entry.tocLevel,
      isSectionHeading: entry.isSectionHeading
    })));
  }

  return entries;
}

function isLikelyImportedTOCRow(row, parsed) {
  if (parsed.isSectionHeading) return true;

  const text = String(row?.text || "");
  if (/\.{2,}|…|\. \./.test(text)) return true;

  const normalizedTitle = normalizeImportedSectionText(parsed.title);
  return getImportedSectionTitleMap().has(normalizedTitle);
}

async function getImportedTOCSectionRanges(bytes, totalPages) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const entries = await detectImportedTOCEntries(pdf);
  const ranges = {};

  [
    "Warranty",
    "Testing Checklist and Testing Procedures",
    "Datasheets",
    "Shop Drawings"
  ].forEach(section => {
    const sectionEntryIndex = entries.findIndex(entry =>
      entry.section === section
    );

    if (sectionEntryIndex < 0) return;

    const sectionEntry = entries[sectionEntryIndex];
    const firstChildEntry = entries
      .slice(sectionEntryIndex + 1)
      .find(entry =>
        entry.section === section &&
        !entry.isSectionHeading &&
        entry.pageIndex != null &&
        (
          sectionEntry.pageIndex == null ||
          entry.pageIndex >= sectionEntry.pageIndex
        )
      );
    const nextSectionEntry = entries
      .slice(sectionEntryIndex + 1)
      .find(entry =>
        entry.isSectionHeading &&
        entry.section !== section &&
        entry.pageIndex != null &&
        sectionEntry.pageIndex != null &&
        entry.pageIndex > sectionEntry.pageIndex
      );
    if (sectionEntry.pageIndex == null && !firstChildEntry) return;

    const startPageIndex = firstChildEntry?.pageIndex ??
      sectionEntry.pageIndex + (sectionEntry.isSectionHeading ? 1 : 0);
    const endPageIndex = nextSectionEntry?.pageIndex ?? totalPages;
    const safeStartPageIndex = Math.max(
      0,
      Math.min(totalPages, Number(startPageIndex) || 0)
    );
    const safeEndPageIndex = Math.max(
      safeStartPageIndex,
      Math.min(totalPages, Number(endPageIndex) || safeStartPageIndex)
    );

    if (safeStartPageIndex < safeEndPageIndex) {
      ranges[section] = {
        startPageIndex: safeStartPageIndex,
        endPageIndex: safeEndPageIndex
      };
    }
  });

  console.table(Object.entries(ranges).map(([section, range]) => ({
    section,
    ...range
  })));

  return ranges;
}

function parseImportedTOCLine(line, printedPageOffset) {
  const rawLine = String(line || "");
  const cleanedLine = rawLine
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = cleanedLine.match(/^(.+?)\s+(\d+)$/);
  const rawMatch = rawLine
    .replace(/\s+/g, " ")
    .trim()
    .match(/^(.+?)\s+(\d+)$/);

  if (!match) return null;

  const rawTitle = rawMatch?.[1] ?? match[1];
  let title = cleanImportedTOCTitle(match[1]);
  const printedPage = Number(match[2]);
  const pageIndex = printedPage + printedPageOffset - 1;
  const normalizedTitle = normalizeImportedSectionText(title);
  const sectionMatch = normalizedTitle.match(/^([ivxlcdm]+)\s+(.+)$/i);
  const sectionTitle = sectionMatch ? sectionMatch[2] : normalizedTitle;
  const section = resolveImportedTOCSectionTitle(sectionTitle);

  if (sectionMatch) {
    title = cleanImportedTOCTitle(title.replace(/^[ivxlcdm]+\.?\s+/i, ""));
  }

  return {
    title,
    pageIndex,
    section,
    tocLevel: getImportedTOCLevel(rawTitle),
    isSectionHeading:
      !!section &&
      (!!sectionMatch || isKnownImportedSectionHeading(title))
  };
}

function parseImportedTOCHeadingLine(line) {
  const cleanedLine = cleanImportedTOCTitle(
    String(line || "")
      .replace(/[^\x20-\x7E]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
  if (!cleanedLine || /\d+\s*$/.test(cleanedLine)) return null;

  const normalizedTitle = normalizeImportedSectionText(cleanedLine);
  const sectionMatch = normalizedTitle.match(/^([ivxlcdm]+)\s+(.+)$/i);
  const sectionTitle = sectionMatch ? sectionMatch[2] : normalizedTitle;
  const section = resolveImportedTOCSectionTitle(sectionTitle);

  if (!section || !isKnownImportedSectionHeading(sectionTitle)) return null;

  const title = sectionMatch
    ? cleanImportedTOCTitle(cleanedLine.replace(/^[ivxlcdm]+\.?\s+/i, ""))
    : cleanedLine;

  return {
    title,
    pageIndex: null,
    section,
    tocLevel: "heading",
    isSectionHeading: true
  };
}

function parseImportedTOCRow(row, printedPageOffset) {
  const numberPart = [...row.parts]
    .reverse()
    .find(part => /\d+\s*$/.test(part.text.trim()));

  if (!numberPart) return null;

  const numberMatch = numberPart.text.trim().match(/(\d+)\s*$/);
  const pageNumberText = numberMatch?.[1];
  if (!pageNumberText) return null;

  const titleParts = row.parts
    .filter(part => part.x < numberPart.x)
    .map(part => part.text)
    .join(" ");
  const embeddedTitle = numberPart.text
    .replace(/(\d+)\s*$/, "")
    .trim();
  const title = titleParts || embeddedTitle;

  if (!cleanImportedTOCTitle(title) || /^page no\.?$/i.test(title)) return null;

  return parseImportedTOCLine(
    `${title} ${pageNumberText}`,
    printedPageOffset
  );
}

function resolveImportedTOCSectionTitle(title) {
  const normalizedTitle = normalizeImportedSectionText(title);
  const exactSection = resolveImportedSectionTitle(
    normalizedTitle,
    getImportedSectionTitleMap()
  );

  if (exactSection) return exactSection;
  if (normalizedTitle.includes("manufacturer") && normalizedTitle.includes("warranty")) {
    return "Warranty";
  }
  if (normalizedTitle.includes("limited warranty")) return "Warranty";
  if (
    normalizedTitle.includes("testing checklist") ||
    normalizedTitle.includes("testing procedure") ||
    normalizedTitle === "testing"
  ) {
    return "Testing Checklist and Testing Procedures";
  }
  if (normalizedTitle.includes("data sheet")) return "Datasheets";
  if (normalizedTitle.includes("datasheet")) return "Datasheets";
  if (normalizedTitle.includes("equipment data")) return "Datasheets";
  if (normalizedTitle.includes("shop drawing")) return "Shop Drawings";
  if (normalizedTitle === "drawings" || normalizedTitle.endsWith(" drawings")) {
    return "Shop Drawings";
  }
  return "";
}

async function detectImportedPacketSections(bytes, sourcePdf) {
  const sectionTitleMap = getImportedSectionTitleMap();
  const markers = [];
  const PDFName = window.PDFLib.PDFName;
  const markerKey = PDFName.of("PacketSection");

  sourcePdf.getPages().forEach((page, pageIndex) => {
    const markerValue = page.node.get(markerKey)?.decodeText?.();
    if (markerValue) {
      markers.push({ pageIndex, section: markerValue, skipMarkerPage: true });
    }
  });

  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const tocMarkers = await detectImportedSectionMarkersFromTOC(pdf);
  const pageTextMarkers = await detectImportedSectionMarkersFromPageText(pdf);

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = content.items
      .map(item => String(item.str || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const pageText = lines.join(" ").toLowerCase();
    const normalizedPageText = normalizeImportedSectionText(pageText);

    if (pageText.includes("table of contents")) continue;

    const candidates = new Set();
    const maxWindowSize = Math.min(6, lines.length);

    for (let windowSize = 1; windowSize <= maxWindowSize; windowSize++) {
      for (
        let startIndex = 0;
        startIndex <= lines.length - windowSize;
        startIndex++
      ) {
        candidates.add(
          lines.slice(startIndex, startIndex + windowSize).join(" ")
        );
      }
    }

    const foundSections = new Set();
    candidates.forEach(candidate => {
      const normalizedCandidate = normalizeImportedSectionText(candidate);
      const match = normalizedCandidate.match(/^([ivxlcdm]+)\s+(.+)$/i);
      if (!match) return;

      const normalizedTitle = match[2];
      const section = resolveImportedSectionTitle(
        normalizedTitle,
        sectionTitleMap
      );
      if (section) foundSections.add(section);
    });

    if (foundSections.size === 0) {
      const titleOnlySections = new Set();

      sectionTitleMap.forEach((section, title) => {
        const exactTitleItem = lines.some(
          line => normalizeImportedSectionText(line) === title
        );
        const titleAppearsOnSparsePage =
          normalizedPageText.includes(title) &&
          lines.length <= 35 &&
          normalizedPageText.length <= 900;

        if (exactTitleItem || titleAppearsOnSparsePage) {
          titleOnlySections.add(section);
        }
      });

      if (titleOnlySections.size === 1) {
        foundSections.add(Array.from(titleOnlySections)[0]);
      }
    }

    if (foundSections.size === 1) {
      markers.push({
        pageIndex: pageNumber - 1,
        section: Array.from(foundSections)[0],
        skipMarkerPage: true
      });
    }
  }

  tocMarkers.forEach(tocMarker => {
    const existingIndex = markers.findIndex(
      marker => marker.section === tocMarker.section
    );

    if (existingIndex >= 0) {
      markers[existingIndex] = tocMarker;
    } else {
      markers.push(tocMarker);
    }
  });

  pageTextMarkers.forEach(pageTextMarker => {
    const existingMarker = markers.find(
      marker => marker.section === pageTextMarker.section
    );

    if (!existingMarker) markers.push(pageTextMarker);
  });

  return markers.sort((a, b) => a.pageIndex - b.pageIndex);
}

async function detectImportedSectionMarkersFromPageText(pdf) {
  const markers = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = buildImportedTextLines(content.items);
    const normalizedPageText = normalizeImportedSectionText(lines.join(" "));

    if (normalizedPageText.includes("table of contents")) continue;

    if (
      !markers.some(marker => marker.section === "Datasheets") &&
      isImportedDatasheetsMarkerPage(normalizedPageText)
    ) {
      markers.push({
        pageIndex: pageNumber - 1,
        section: "Datasheets",
        skipMarkerPage: true
      });
    }

    const stopSection = resolveImportedSparseSectionMarker(normalizedPageText);
    if (
      stopSection &&
      !["Warranty", "Datasheets"].includes(stopSection) &&
      !markers.some(marker => marker.section === stopSection)
    ) {
      markers.push({
        pageIndex: pageNumber - 1,
        section: stopSection,
        skipMarkerPage: true
      });
    }
  }

  if (markers.length === 0) {
    console.log(
      "Submittal import page-text detector found no extra section markers."
    );
  } else {
    console.log("Submittal import page-text markers:", markers);
  }

  return markers;
}

function isImportedDatasheetsMarkerPage(normalizedPageText) {
  const compactText = normalizedPageText.replace(/\s+/g, "");

  return (
    normalizedPageText === "datasheets" ||
    normalizedPageText === "data sheets" ||
    normalizedPageText === "equipment datasheets" ||
    normalizedPageText === "equipment data" ||
    /^([ivxlcdm]+ )?(datasheets|data sheets|equipment datasheets|equipment data)$/.test(
      normalizedPageText
    ) ||
    compactText === "datasheets" ||
    compactText === "equipmentdatasheets" ||
    compactText === "equipmentdata"
  );
}

function resolveImportedSparseSectionMarker(normalizedPageText) {
  const compactText = normalizedPageText.replace(/\s+/g, "");
  const cleanedText = normalizedPageText.replace(/^[ivxlcdm]+\s+/, "");
  const compactCleanedText = cleanedText.replace(/\s+/g, "");
  const sectionMap = new Map([
    ["warranty", "Warranty"],
    ["testing checklist and testing procedures", "Testing Checklist and Testing Procedures"],
    ["testing checklist", "Testing Checklist and Testing Procedures"],
    ["testing procedures", "Testing Checklist and Testing Procedures"],
    ["testing procedure", "Testing Checklist and Testing Procedures"],
    ["testing", "Testing Checklist and Testing Procedures"],
    ["datasheets", "Datasheets"],
    ["datasheet", "Datasheets"],
    ["equipment datasheets", "Datasheets"],
    ["data sheets", "Datasheets"],
    ["equipment data", "Datasheets"],
    ["control panel components", "Control Panel Components"],
    ["electrical schematics", "Electrical Schematics"],
    ["shop drawings", "Shop Drawings"],
    ["shop drawing", "Shop Drawings"],
    ["drawings", "Shop Drawings"],
    ["appendix", "Appendix"]
  ]);

  for (const [title, section] of sectionMap.entries()) {
    const compactTitle = title.replace(/\s+/g, "");
    if (
      cleanedText === title ||
      compactText === compactTitle ||
      compactCleanedText === compactTitle
    ) {
      return section;
    }
  }

  return "";
}

function normalizeImportedSectionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveImportedSectionTitle(title, sectionTitleMap) {
  const exactSection = sectionTitleMap.get(title);
  if (exactSection) return exactSection;
  if (title.includes("warranty")) return "Warranty";
  if (
    title.includes("testing checklist") ||
    title.includes("testing procedure") ||
    title === "testing"
  ) {
    return "Testing Checklist and Testing Procedures";
  }
  if (title.includes("datasheet") || title.includes("equipment data")) {
    return "Datasheets";
  }
  return null;
}

function getImportedSectionRange(markers, section, totalPages) {
  const markerIndex = markers.findIndex(marker => marker.section === section);
  if (markerIndex < 0) return null;
  const marker = markers[markerIndex];

  const startPageIndex =
    marker.firstChildPageIndex ??
    marker.pageIndex +
      (marker.skipMarkerPage === false ? 0 : 1);
  const endPageIndex =
    marker.endPageIndex ??
    markers[markerIndex + 1]?.pageIndex ??
    totalPages;

  if (startPageIndex >= endPageIndex) return null;
  return { startPageIndex, endPageIndex };
}

async function extractImportedSection(sourcePdf, range, fileName) {
  const outputPdf = await PDFDocument.create();
  const pageIndexes = [];
  const totalPages = sourcePdf.getPageCount();
  const startPageIndex = Math.max(
    0,
    Math.min(totalPages, Number(range.startPageIndex) || 0)
  );
  const endPageIndex = Math.max(
    startPageIndex,
    Math.min(totalPages, Number(range.endPageIndex) || startPageIndex)
  );

  if (startPageIndex >= endPageIndex) {
    throw new Error(
      `Could not extract ${fileName}: detected page range is outside the PDF.`
    );
  }

  for (
    let pageIndex = startPageIndex;
    pageIndex < endPageIndex;
    pageIndex++
  ) {
    pageIndexes.push(pageIndex);
  }

  const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);
  copiedPages.forEach(page => {
    clearImportedPacketFooter(page);
    outputPdf.addPage(page);
  });

  return new File(
    [await outputPdf.save()],
    fileName,
    { type: "application/pdf", lastModified: Date.now() }
  );
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

  const pdf = await pdfjsLib.getDocument({
    data: bytes.slice(0)
  }).promise;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const viewport = page.getViewport({ scale: 0.8 });

    const wrapper = document.createElement("div");
    wrapper.className = "pdf-page-preview";
    wrapper.dataset.pageNumber = pageNumber;

    const header = document.createElement("div");
    const checkbox = document.createElement("input");
    const label = document.createElement("div");
    header.className = "page-preview-header";
    checkbox.type = "checkbox";
    checkbox.className = "page-edit-checkbox";
    checkbox.setAttribute("aria-label", `Select page ${pageNumber} for PDF actions`);
    label.className = "page-preview-label";
    label.textContent = `Page ${pageNumber}`;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    header.appendChild(checkbox);
    header.appendChild(label);
    wrapper.appendChild(header);
    wrapper.appendChild(canvas);
    previewList.appendChild(wrapper);

    checkbox.addEventListener("click", event => {
      event.stopPropagation();
    });
    checkbox.addEventListener("change", () => {
      wrapper.classList.toggle("page-action-selected", checkbox.checked);

      if (checkbox.checked) {
        selectedManagedPages.add(pageNumber);
      } else {
        selectedManagedPages.delete(pageNumber);
      }

      updateSubsectionPageSelectionStatus(pdf.numPages);
    });

    wrapper.addEventListener("click", event => {
      if (event.target === checkbox) return;

      document.querySelectorAll(".pdf-page-preview").forEach(el => {
        el.classList.remove("selected");
      });

      wrapper.classList.add("selected");
      document.getElementById("subsectionPageNumber").value = pageNumber;
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

  if (parentLevel === 0 && !item.hideParentTOC) {
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

  parentSelect.innerHTML = parentOptions
    .map(entry => `
      <option value="${entry.id}" ${entry.id === currentParentId ? "selected" : ""}>
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
  const sorted = [...entries].sort((a, b) =>
    a.sourcePage - b.sourcePage ||
    Number(a.tocLevel || 0) - Number(b.tocLevel || 0)
  );

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
      duplicateEntry.title = title;
      duplicateEntry.sourcePage = pageNumber;
      duplicateEntry.entryType = tocLevel === 0 ? "section" : "subsection";
      duplicateEntry.tocLevel = tocLevel;
      duplicateEntry.parentId = tocLevel === 0 ? "" : parentId;

      if (existingEntry) {
        promoteTOCChildrenBeforeRemoval(item, existingEntry);
        item.tocEntries = item.tocEntries.filter(entry => entry.id !== existingEntry.id);
      }

      cleanInvalidTOCParents(item);
      item.tocEntries.sort((a, b) =>
        a.sourcePage - b.sourcePage ||
        Number(a.tocLevel || 0) - Number(b.tocLevel || 0)
      );
      clearTOCEntryForm();
      renderCurrentSubsectionList();
      updateTOCParentDropdown();
      return;
    }
  }

  if (existingEntry) {
    existingEntry.title = title;
    existingEntry.sourcePage = pageNumber;
    existingEntry.entryType = tocLevel === 0 ? "section" : "subsection";
    existingEntry.tocLevel = tocLevel;
    existingEntry.parentId = tocLevel === 0 ? "" : parentId;
    cleanInvalidTOCParents(item);
  } else {
    item.tocEntries.push({
      id: crypto.randomUUID(),
      title,
      sourcePage: pageNumber,
      entryType: tocLevel === 0 ? "section" : "subsection",
      tocLevel,
      parentId: tocLevel === 0 ? "" : parentId
    });
  }

  item.tocEntries.sort((a, b) =>
    a.sourcePage - b.sourcePage ||
    Number(a.tocLevel || 0) - Number(b.tocLevel || 0)
  );

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
      level === 1 &&
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
  const activeId = document.getElementById("activeSubsectionPdfId").value;
  const item = pdfLibrary.find(x => x.id === activeId);
  if (!item) return;

  const removedEntry = (item.tocEntries || []).find(entry => entry.id === entryId);
  promoteTOCChildrenBeforeRemoval(item, removedEntry);
  item.tocEntries = (item.tocEntries || []).filter(entry => entry.id !== entryId);
  cleanInvalidTOCParents(item);

  if (editingTOCEntryId === entryId) {
    clearTOCEntryForm();
  }

  renderCurrentSubsectionList();
  updateTOCParentDropdown();
}

function renderCurrentSubsectionList() {
  const activeId = document.getElementById("activeSubsectionPdfId").value;
  const list = document.getElementById("currentSubsectionList");

  if (!list) return;

  const item = pdfLibrary.find(x => x.id === activeId);

  if (!item || !item.tocEntries || item.tocEntries.length === 0) {
    list.innerHTML = "<p>No subsections added yet.</p>";
    updateTOCParentDropdown();
    return;
  }

  list.innerHTML = "";

  orderTOCEntriesForDisplay(item.tocEntries)
    .forEach(entry => {
      const row = document.createElement("div");
      row.className = "subsection-entry-row";

      row.innerHTML = `
        <div class="subsection-entry-info">
          <strong>
            ${Number(entry.tocLevel || 0) === 2
              ? `${getLevelTwoLetter(item, entry)} Level 2`
              : `Level ${entry.tocLevel ?? 0}`}
          </strong>

          <div>
            Parent: ${getTOCParentTitle(item, entry.parentId)}
          </div>
          <br>
          Page ${entry.sourcePage}
          <br>
          ${entry.title}
        </div>

        <div class="button-row">
          <button onclick="editSubsectionEntry('${entry.id}')">
            Edit
          </button>
          <button class="remove-pdf-btn" onclick="removeSubsectionEntry('${entry.id}')">
            Remove
          </button>
        </div>
      `;

      list.appendChild(row);
    });
}

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
  const value = String(text || "");

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
    const textWidth = font.widthOfTextAtSize(text, size);

    page.drawText(text, {
      x: (width - textWidth) / 2,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    });
  }

  function drawUnderlinedText(text, x, y, size, font) {
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    });

    const textWidth = font.widthOfTextAtSize(text, size);

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

  page.drawText(`NS Corp. Project No.: ${projectNumber}`, {
    x: leftMargin,
    y: startY,
    size: 12,
    font: times
  });

  page.drawText(`Project Name: ${projectName}`, {
    x: leftMargin,
    y: startY - 15,
    size: 12,
    font: times
  });

  page.drawText(`Project Address: ${projectAddress}`, {
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

  const sectionDefinitions = isOM
    ? [
        "Warranty",
        "Safety Procedures",
        "Maintenance",
        "Testing Checklist and Testing Procedures",
        "Sequence of Operations",
        "Parts List",
        "Datasheets",
        "Control Panel Components",
        "Electrical Schematics",
        "Shop Drawings",
        "Manuals",
        "Appendix"
      ]
    : [
        "Warranty",
        "Datasheets",
        "Control Panel Components",
        "Shop Drawings",
        "Appendix"
      ];

  let sectionNumber = 0;
  const displayedPageNumbers = new Set();

  sectionDefinitions.forEach(section => {
    const items = tocItems.filter(item => item.section === section);

    if (items.length === 0) return;

    const sectionTarget = sectionTargets[section];
    const roman = sectionTarget?.roman || toRoman(sectionNumber + 1);
    sectionNumber++;

    const sectionLabel = getSectionLabel(section);
    const sectionText = `${roman}. ${sectionLabel}`;
    if (y < footerMargin + 25) {
      page = pdfDoc.insertPage(tocInsertIndex, [612, 792]);
      tocInsertIndex++;
      insertedTOCPageCount++;

      markTOCPage(page);

      y = height - topMargin - 30;

      page.drawText("Table of Contents (Continued)", {
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

    const filteredItems = items.filter((item, index) => {
      if (index !== 0) return true;

      const itemTitle = item.title.trim().toLowerCase();
      const sectionTitle = sectionLabel.trim().toLowerCase();

      return !item.isParentTOC || itemTitle !== sectionTitle;
    });

        filteredItems.forEach(item => {
        // Move to a new TOC page before drawing into the footer
        if (y < footerMargin) {
          page = pdfDoc.insertPage(tocInsertIndex, [612, 792]);
          tocInsertIndex++;
          insertedTOCPageCount++;
          markTOCPage(page);

          y = height - topMargin - 30;

          page.drawText("Table of Contents (Continued)", {
            x: leftMargin,
            y,
            size: 16,
            font: timesBold
          });

          y -= 28;
        }

        const level = Number(item.tocLevel || 0);
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

function pageIndexIsTOCPage(pdfDoc, pageIndex) {
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
