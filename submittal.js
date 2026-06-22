let pdfLibrary = [];
let pendingBuild = false;
let customSectionLabels = {};
const sourcePDFBytesCache = new WeakMap();
let romanCoverPageBytesPromise = null;
let warrantyPromptHandled = false;
let selectedManagedPages = new Set();

const pdfUpload = document.getElementById("pdfUpload");
if (pdfUpload) {
  pdfUpload.addEventListener("change", handlePDFUpload);
}

document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("dropZone");

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

function handleDroppedFiles(fileList) {
  const files = Array.from(fileList)
    .filter(file => file.type === "application/pdf");

  files.forEach(file => {
    const cleanName = file.name.replace(/\.pdf$/i, "");

    pdfLibrary.push({
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
    });
  });

  sortLibraryBySection();
  renderUploadedPdfList();
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

    if (a.packetSection === "Datasheets" && b.packetSection === "Datasheets") {
      return (a.datasheetOrder ?? 999) - (b.datasheetOrder ?? 999);
    }

    return 0;
  });
}
function renameTOCSections() {
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

  sections.forEach(section => {
    const currentName = customSectionLabels[section] || section;

    const newName = prompt(
      `Rename TOC section "${section}" to:`,
      currentName
    );

    if (newName === null) return;

    const cleanName = newName.trim();

    if (cleanName) {
      customSectionLabels[section] = cleanName;
    }
  });

  alert("Section names updated for this packet.");
}

function getSectionLabel(section) {
  return customSectionLabels[section] || section;
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

function renamePdfTitle(id) {
  const item = pdfLibrary.find(x => x.id === id);
  if (!item) return;

  const newTitle = prompt(
    "Enter the name you want shown in the Table of Contents:",
    item.displayTitle
  );

  if (newTitle === null) return;

  const cleanTitle = newTitle.trim();

  if (!cleanTitle) {
    alert("The TOC name cannot be blank.");
    return;
  }

  item.displayTitle = cleanTitle;
  renderUploadedPdfList();
}

function renderUploadedPdfList() {
  const container = document.getElementById("uploadedPdfList");
  if (!container) return;

  container.innerHTML = "";

  pdfLibrary.forEach(item => {
    const row = document.createElement("div");
    row.className = "uploaded-pdf-row";

    const canHaveSubsections =
      item.packetSection === "Datasheets" ||
      item.packetSection === "Control Panel Components" ||
      item.packetSection === "Electrical Schematics" ||
      item.packetSection === "Shop Drawings";

    const subsectionButton = canHaveSubsections
      ? `
        <button onclick="openSubsectionModal('${item.id}')">
          Format TOC
        </button>
      `
      : "";

    const managePdfButton = !canHaveSubsections
      ? `
        <button onclick="openPageManager('${item.id}')">
          Manage PDF
        </button>
      `
      : "";

    const subsectionCount = canHaveSubsections
      ? `
        <div class="subsection-count">
          ${(item.tocEntries || []).length} subsection(s)
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
      const viewport = page.getViewport({ scale: 0.42 });
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
    alert("Select at least one page to extract.");
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
    alert("The selected pages could not be extracted.");
  }
}

async function deleteSelectedPages() {
  const item = getActivePageManagerItem();
  const selectedPages = Array.from(selectedManagedPages).sort((a, b) => a - b);

  if (!item || selectedPages.length === 0) {
    alert("Select at least one page to delete.");
    return;
  }

  try {
    const sourceBytes = await getSourcePDFBytes(item.file);
    const sourcePdf = await PDFDocument.load(sourceBytes);

    if (selectedPages.length >= sourcePdf.getPageCount()) {
      alert("A PDF must keep at least one page.");
      return;
    }

    if (!confirm(`Delete ${selectedPages.length} selected page(s)?`)) return;

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
    alert("The selected pages could not be deleted.");
  }
}

function removeUploadedPDF(id) {
  const removedItem = pdfLibrary.find(item => item.id === id);
  pdfLibrary = pdfLibrary.filter(item => item.id !== id);

  if (removedItem?.packetSection === "Warranty") {
    warrantyPromptHandled = false;
  }

  renderUploadedPdfList();
}

function clearUploadedPDFs() {
  if (!confirm("Clear all uploaded PDFs from the packet builder?")) return;

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
  warrantyPromptHandled = false;
  renderUploadedPdfList();
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

async function drawSectionDividerPage(pdfDoc, sectionTitle) {
  if (!romanCoverPageBytesPromise) {
    romanCoverPageBytesPromise = loadCoverPageAsset("RomanCoverPage.pdf");
  }

  const templateBytes = await romanCoverPageBytesPromise;

  const templatePdf = await PDFDocument.load(templateBytes);
  const [templatePage] = await pdfDoc.copyPages(templatePdf, [0]);

  const page = pdfDoc.addPage(templatePage);

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

async function buildPacket() {
  const hasIncludedWarranty = pdfLibrary.some(item =>
    item.include && item.packetSection === "Warranty"
  );

  const warrantyModal = document.getElementById("warrantyPromptModal");

  if (!hasIncludedWarranty && !warrantyPromptHandled && warrantyModal) {
    openWarrantyPromptModal();
    return;
  }

  const includedDatasheets = pdfLibrary.filter(item =>
    item.include && item.packetSection === "Datasheets"
  );

  if (includedDatasheets.length > 1 && !pendingBuild) {
    openDatasheetOrderModal(includedDatasheets);
    return;
  }

  pendingBuild = false;

  const finalPdf = await PDFDocument.create();
  const noNumberPageIndexes = [];

  const included = pdfLibrary.filter(item => item.include);

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
  for (const item of revisionRemarks) {
    const addedIndexes = await appendPDF(finalPdf, item.file);
    noNumberPageIndexes.push(...addedIndexes);
  }

  // Generated Cover Page comes after Revision Remarks
  await drawGeneratedCoverPage(finalPdf);

  const tocPage = finalPdf.addPage([612, 792]);

  const tocItems = [];
  const sectionTargets = {};

  let currentSection = null;

  for (const item of contentFiles) {
    if (item.packetSection !== currentSection) {
      currentSection = item.packetSection;

      const sectionNumber = Object.keys(sectionTargets).length + 1;
      const romanNumber = toRoman(sectionNumber);
      const sectionLabel = getSectionLabel(currentSection);
      const sectionTitle = `${romanNumber}. ${sectionLabel}`;
      const targetPageIndex = finalPdf.getPageCount();

      await drawSectionDividerPage(finalPdf, sectionTitle);

      sectionTargets[currentSection] = {
        roman: romanNumber,
        title: sectionLabel,
        targetPageIndex,
        pageNumber:
          targetPageIndex + 1 - noNumberPageIndexes.length
      };
    }

    const startPage =
      finalPdf.getPageCount() + 1 - noNumberPageIndexes.length;

    // Warranty document titles are added only when tocDetection finds them.
    if (!item.hideParentTOC && item.packetSection !== "Warranty") {
      tocItems.push({
        title: item.displayTitle,
        section: item.packetSection,
        startPage,
        targetPageIndex: finalPdf.getPageCount(),
        tocLevel: 0
      });
    }

    if (
      item.packetSection === "Datasheets" ||
      item.packetSection === "Control Panel Components" ||
      item.packetSection === "Electrical Schematics" ||
      item.packetSection === "Shop Drawings"
    ) {
      const manualEntries = (item.tocEntries || [])
        .sort((a, b) => a.sourcePage - b.sourcePage)
        .map(entry => ({
          title: entry.title,
          section: item.packetSection,
          startPage: startPage + entry.sourcePage - 1,
          targetPageIndex:
            finalPdf.getPageCount() + entry.sourcePage - 1,
          tocLevel:
            entry.entryType === "section"
              ? 0
              : 1
        }));

      tocItems.push(...manualEntries);
    } else {
      const detectedSubsections =
        await detectTOCSubsections(
          item.file,
          item.packetSection,
          startPage
        );

      tocItems.push(...detectedSubsections);
    }


    await appendPDF(finalPdf, item.file);
  }

  await drawTOCOnExistingPage(
    finalPdf,
    tocPage,
    tocItems,
    sectionTargets
  );
  await addPageNumbers(finalPdf, noNumberPageIndexes);

  const pdfBytes = await finalPdf.save();

  const outputName =
    typeof getOMOutputFileName === "function"
      ? getOMOutputFileName()
      : getOutputFileName();

  downloadFile(pdfBytes, outputName, "application/pdf");
  console.log("Download function ran.");

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

  resetPacketBuilder();
}

function resetPacketBuilder() {
  pdfLibrary = [];
  pendingBuild = false;
  warrantyPromptHandled = false;
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
    "subsectionModal",
    "pageManagerModal"
  ].forEach(id => {
    document.getElementById(id)?.classList.add("hidden");
  });

  const datasheetOrderList = document.getElementById("datasheetOrderList");
  if (datasheetOrderList) datasheetOrderList.innerHTML = "";

  renderUploadedPdfList();
}

function openWarrantyPromptModal() {
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

  if (!modal || !createCheckbox) return;

  createCheckbox.checked = false;
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

  updateWarrantyPeriodEnd();
  updateWarrantyVehicleFields();
  toggleWarrantyCreator();
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

  fields.classList.toggle("hidden", !createCheckbox.checked);
  continueButton.textContent = createCheckbox.checked
    ? "Add Warranty & Continue"
    : "Continue Without Warranty";
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

  if (!Number.isInteger(materialYears) || materialYears < 1) {
    if (status) status.textContent = "Enter the material warranty years.";
    return;
  }

  if (!Number.isInteger(duration) || duration < 1) {
    if (status) status.textContent = "Enter a whole number greater than zero.";
    return;
  }

  if (vehicleType === "transit" && (!commencementDate || !periodEndDate)) {
    if (status) status.textContent = "Select the warranty commencement date.";
    return;
  }

  if (continueButton) continueButton.disabled = true;
  if (status) status.textContent = "Creating warranty sheet...";

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
    closeWarrantyPromptModal();
    await buildPacket();
  } catch (error) {
    console.error("Could not continue warranty build:", error);

    if (warrantyAdded) {
      alert(
        "The warranty sheet was added, but the PDF packet could not be built. " +
        "Click Build PDF Packet to try again."
      );
    } else if (status) {
      status.textContent = "The warranty sheet could not be created. Try again.";
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

function confirmDatasheetOrder() {
  const rows = Array.from(
    document.querySelectorAll("#datasheetOrderList .order-row")
  );

  rows.forEach((row, index) => {
    const item = pdfLibrary.find(x => x.id === row.dataset.id);

    if (item) {
      item.datasheetOrder = index + 1;
    }
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

  if (subsectionPageNumber) subsectionPageNumber.value = "";
  if (subsectionTitle) subsectionTitle.value = "";

  const hideParent =
    document.getElementById("hideParentTOC");

  if (hideParent) {
    hideParent.checked = item.hideParentTOC || false;
  }
  if (hideParent) {
    hideParent.onchange = () => {
      item.hideParentTOC = hideParent.checked;
    };
  }
  if (tocEntryType) tocEntryType.value = "section";

  previewList.innerHTML = "Loading page previews...";

  renderCurrentSubsectionList();

  modal.classList.remove("hidden");

  await renderPDFPagePreviews(item);
}

function closeSubsectionModal() {
  const modal = document.getElementById("subsectionModal");
  if (modal) modal.classList.add("hidden");

  selectedManagedPages = new Set();
  renderUploadedPdfList();
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

    const viewport = page.getViewport({ scale: 0.45 });

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

function addTOCEntry(entryType) {
  const activeIdInput = document.getElementById("activeSubsectionPdfId");
  const pageInput = document.getElementById("subsectionPageNumber");
  const titleInput = document.getElementById("subsectionTitle");

  if (!activeIdInput || !pageInput || !titleInput) {
    alert("TOC modal is missing required HTML fields. Check the modal IDs.");
    return;
  }

  const activeId = activeIdInput.value;
  const pageNumber = Number(pageInput.value);
  const title = titleInput.value.trim();

  const item = pdfLibrary.find(x => x.id === activeId);
    if (!item) return;
    const hideParent =
    document.getElementById("hideParentTOC");

  item.hideParentTOC =
    hideParent ? hideParent.checked : false;

  if (!pageNumber || pageNumber < 1) {
    alert("Select a page.");
    return;
  }

  if (!title) {
    alert("Enter a TOC name.");
    return;
  }

  if (!item.tocEntries) {
    item.tocEntries = [];
  }

  item.tocEntries.push({
    id: crypto.randomUUID(),
    title,
    sourcePage: pageNumber,
    entryType,
    tocLevel: entryType === "section" ? 0 : 1
  });

  item.tocEntries.sort((a, b) => a.sourcePage - b.sourcePage);

  pageInput.value = "";
  titleInput.value = "";

  document.querySelectorAll(".pdf-page-preview").forEach(el => {
    el.classList.remove("selected");
  });

  renderCurrentSubsectionList();
}

function removeSubsectionEntry(entryId) {
  const activeId = document.getElementById("activeSubsectionPdfId").value;
  const item = pdfLibrary.find(x => x.id === activeId);
  if (!item) return;

  item.tocEntries = (item.tocEntries || []).filter(entry => entry.id !== entryId);

  renderCurrentSubsectionList();
}

function renderCurrentSubsectionList() {
  const activeId = document.getElementById("activeSubsectionPdfId").value;
  const list = document.getElementById("currentSubsectionList");

  if (!list) return;

  const item = pdfLibrary.find(x => x.id === activeId);

  if (!item || !item.tocEntries || item.tocEntries.length === 0) {
    list.innerHTML = "<p>No subsections added yet.</p>";
    return;
  }

  list.innerHTML = "";

  item.tocEntries
    .sort((a, b) => a.sourcePage - b.sourcePage)
    .forEach(entry => {
      const row = document.createElement("div");
      row.className = "subsection-entry-row";

      row.innerHTML = `
        <div class="subsection-entry-info">
          <strong>
            ${entry.entryType === "section"
                ? "Section"
                : "Subsection"}
          </strong>
          <br>
          Page ${entry.sourcePage}
          <br>
          ${entry.title}
        </div>

        <button onclick="removeSubsectionEntry('${entry.id}')">
          Remove
        </button>
      `;

      list.appendChild(row);
    });
}

async function appendPDF(finalPdf, file) {
  const startIndex = finalPdf.getPageCount();

  const bytes = await getSourcePDFBytes(file);
  const sourcePdf = await PDFDocument.load(bytes);
  const copiedPages = await finalPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

  copiedPages.forEach(page => finalPdf.addPage(page));

  const endIndex = finalPdf.getPageCount() - 1;

  const addedIndexes = [];
  for (let i = startIndex; i <= endIndex; i++) {
    addedIndexes.push(i);
  }

  return addedIndexes;
}

async function getSourcePDFBytes(file) {
  if (!sourcePDFBytesCache.has(file)) {
    sourcePDFBytesCache.set(file, file.arrayBuffer());
  }

  return sourcePDFBytesCache.get(file);
}

function addInternalPageLink(pdfDoc, sourcePage, x, y, width, height, targetPageIndex) {
  const targetPage = pdfDoc.getPage(targetPageIndex);

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

  const pageRight = width - rightMargin;
  const startY = height - topMargin;

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

      addInternalPageLink(
        pdfDoc,
        page,
        leftMargin,
        y - 2,
        sectionTextWidth,
        14,
        sectionTarget.targetPageIndex
      );

      addInternalPageLink(
        pdfDoc,
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

      return itemTitle !== sectionTitle;
    });

    filteredItems.forEach(item => {
      const level = item.tocLevel || 0;
      const levelSettings = {
        0: { bullet: "•", bulletX: leftMargin + 18, titleX: leftMargin + 32 },
        1: { bullet: "-", bulletX: leftMargin + 48, titleX: leftMargin + 62 },
        2: { bullet: "*", bulletX: leftMargin + 78, titleX: leftMargin + 92 }
      };

      const settings = levelSettings[level] || levelSettings[0];

      const bullet = settings.bullet;
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

      page.drawText(item.title, {
        x: titleX,
        y,
        size: 12,
        font: times
      });

      const titleWidth = times.widthOfTextAtSize(item.title, 12);

      if (showPageNumber) {
        drawDottedLeader(titleX + titleWidth + 6, pageNumX - 8, y);
      }

      if (item.targetPageIndex !== undefined) {
        addInternalPageLink(
          pdfDoc,
          page,
          titleX,
          y - 2,
          titleWidth,
          14,
          item.targetPageIndex
        );

        if (showPageNumber) {
          addInternalPageLink(
            pdfDoc,
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
}

async function addPageNumbers(pdfDoc, skipPageIndexes = []) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const revision = document.getElementById("revision")?.value || "0";
  const dateMade = new Date().toLocaleDateString();

  let printedPageNumber = 1;

  pages.forEach((page, index) => {
    if (skipPageIndexes.includes(index)) return;

    const { width, height } = page.getSize();

    const pageNumber = `${printedPageNumber}`;
    printedPageNumber++;

    const pageFontSize = 11;
    const revFontSize = 9;

    const bottomMargin = 3; // lower on page
    const sideSafeMargin = 30; // keeps revision from clipping right edge

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
