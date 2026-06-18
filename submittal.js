let pdfLibrary = [];
let pendingBuild = false;
let customSectionLabels = {};

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
  const name = fileName.toLowerCase();
  if (name.includes("revision") || name.includes("remarks")) return "Revision Remarks";
  if (name.includes("cover")) return "Cover Page";
  if (name.includes("table of contents") || name.includes("toc")) return "Table of Contents";
  if (name.includes("warranty")) return "Warranty";
  if (name.includes("safety")) return "Safety Procedures";
  if (name.includes("maintenance")) return "Maintenance";
  if (name.includes("sequence of operations") || name.includes("sequence of operation") || name.includes("operations sequence")) return "Sequence of Operations";
  if (name.includes("parts list") || name.includes("part list")|| name.includes("parts") || name.includes("part")) return "Parts List";
  if (name.includes("electrical schematic") || name.includes("electrical schematics") || name.includes("electrical diagram") || name.includes("schematic") || name.includes("diagram")) return "Electrical Schematics";
  if (name.includes("control") || name.includes("panel")) return "Control Panel Components";
  
  // Handles:
  // - Shop Drawing
  // - Shop Drawings
  // - Drawing
  // - Drawings
  if (
    name.includes("shop drawing") ||
    name.includes("shop drawings") ||
    name.includes("shop") ||
    name.includes("drawing") ||
    name.includes("drawings")
  ) {
    return "Shop Drawing";
  }

  if (name.includes("manual")) return "Manual";
  if (name.includes("cert")) return "Certification";
  if (name.includes("spec")) return "Spec Sheet";
  if (name.includes("test")) return "Test Report";

  return "Datasheet";
}

function guessPacketSection(fileName) {
  const type = guessDocumentType(fileName);

  if (type === "Revision Remarks") return "Revision Remarks";
  if (type === "Cover Page") return "Cover Page";
  if (type === "Table of Contents") return "Table of Contents";
  if (type === "Warranty") return "Warranty";
  if (type === "Safety Procedures") return "Safety Procedures";
  if (type === "Maintenance") return "Maintenance";
  if (type === "Sequence of Operations") return "Sequence of Operations";
  if (type === "Parts List") return "Parts List";
  if (type === "Electrical Schematics") return "Electrical Schematics";
  if (type === "Control Panel Components") return "Control Panel Components";
  if (type === "Shop Drawing" || type === "Drawing") return "Shop Drawings";
  if (type === "Appendix" || type === "Other") return "Appendix";

  return "Datasheets";
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

function removeUploadedPDF(id) {
  pdfLibrary = pdfLibrary.filter(item => item.id !== id);
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
    const res = await fetch("Files/CoverPage/NSCoverLogo.png");

    if (!res.ok) {
      throw new Error("Cover logo not found");
    }

    const logoBytes = await res.arrayBuffer();
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
  const templateBytes = await fetch("Files/CoverPage/RomanCoverPage.pdf")
    .then(res => res.arrayBuffer());

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

  let currentSection = null;
  const sectionStartPages = {};

  for (const item of contentFiles) {
    if (item.packetSection !== currentSection) {
      currentSection = item.packetSection;

      const sectionLabel = getSectionLabel(currentSection);

      await drawSectionDividerPage(finalPdf, sectionLabel);

      sectionStartPages[currentSection] =
        finalPdf.getPageCount() - noNumberPageIndexes.length;
    }

    const startPage =
      finalPdf.getPageCount() + 1 - noNumberPageIndexes.length;

    if (!item.hideParentTOC) {
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
    sectionStartPages,
    noNumberPageIndexes
  );
  await addPageNumbers(finalPdf, noNumberPageIndexes);

  console.log("About to save PDF...");

  const pdfBytes = await finalPdf.save();

  console.log("PDF saved. About to download...");
  const outputName =
    typeof getOMOutputFileName === "function"
      ? getOMOutputFileName()
      : getOutputFileName();

  downloadFile(pdfBytes, outputName, "application/pdf");
  console.log("Download function ran.");

  if (typeof mergeSubmittalIntoLibrary === "function") {
    try {
      await mergeSubmittalIntoLibrary(included);
    } catch (e) {
      console.error("Error merging into library", e);
    }
  }
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

  renderUploadedPdfList();
}

async function renderPDFPagePreviews(item) {
  const previewList = document.getElementById("subsectionPagePreviewList");
  if (!previewList) return;

  previewList.innerHTML = "";

  const bytes = await item.file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: bytes
  }).promise;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const viewport = page.getViewport({ scale: 0.45 });

    const wrapper = document.createElement("div");
    wrapper.className = "pdf-page-preview";
    wrapper.dataset.pageNumber = pageNumber;

    const label = document.createElement("div");
    label.className = "page-preview-label";
    label.textContent = `Page ${pageNumber}`;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    wrapper.appendChild(label);
    wrapper.appendChild(canvas);
    previewList.appendChild(wrapper);

    wrapper.addEventListener("click", () => {
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

  const bytes = await file.arrayBuffer();
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

async function drawTOCOnExistingPage(pdfDoc, page, tocItems, sectionStartPages = {}, noNumberPageIndexes = []) {
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

  const romans = [
    "I", "II", "III", "IV", "V", "VI",
    "VII", "VIII", "IX", "X", "XI", "XII"
  ];

  let sectionNumber = 0;

  sectionDefinitions.forEach(section => {
    const items = tocItems.filter(item => item.section === section);

    if (items.length === 0) return;

    const roman = romans[sectionNumber] || `${sectionNumber + 1}`;
    sectionNumber++;

    const sectionLabel = getSectionLabel(section);
    const sectionPageNum = `${sectionStartPages[section] || ""}`;
    const sectionPageNumWidth = timesBold.widthOfTextAtSize(sectionPageNum, 12);
    const sectionPageNumX = pageRight - sectionPageNumWidth;

    page.drawText(`${roman}. ${sectionLabel}`, {
      x: leftMargin,
      y,
      size: 12,
      font: timesBold
    });

    if (sectionPageNum) {
      page.drawText(sectionPageNum, {
        x: sectionPageNumX,
        y,
        size: 12,
        font: timesBold
      });

      const sectionTitleText = `${roman}. ${sectionLabel}`;
      const sectionTitleWidth = timesBold.widthOfTextAtSize(sectionTitleText, 12);

      addInternalPageLink(
        pdfDoc,
        page,
        leftMargin,
        y - 2,
        sectionTitleWidth,
        14,
        sectionStartPages[section] + noNumberPageIndexes.length - 1
      );

      addInternalPageLink(
        pdfDoc,
        page,
        sectionPageNumX,
        y - 2,
        sectionPageNumWidth,
        14,
        sectionStartPages[section] + noNumberPageIndexes.length - 1
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
      drawDottedLeader(titleX + titleWidth + 6, pageNumX - 8, y);

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
      }

      page.drawText(pageNum, {
        x: pageNumX,
        y,
        size: 12,
        font: times
      });

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