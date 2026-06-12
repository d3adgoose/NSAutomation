let pdfLibrary = [];
let pendingBuild = false;

const pdfUpload = document.getElementById("pdfUpload");
if (pdfUpload) {
  pdfUpload.addEventListener("change", handlePDFUpload);
}

function handlePDFUpload(event) {
  const files = Array.from(event.target.files);

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
      datasheetOrder: null
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

function renderUploadedPdfList() {
  const container = document.getElementById("uploadedPdfList");
  if (!container) return;

  container.innerHTML = "";

  pdfLibrary.forEach(item => {
    const row = document.createElement("div");
    row.className = "uploaded-pdf-row";

    row.innerHTML = `
      <div class="uploaded-pdf-name">
        ${item.fileName}
      </div>

      <button
        class="remove-pdf-btn"
        onclick="removeUploadedPDF('${item.id}')">
        Remove
      </button>
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
  const coverPages = included.filter(x => x.packetSection === "Cover Page");
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

  const contentFiles = [
    ...warranties,
    ...datasheets,
    ...controlPanelComponents,
    ...shopDrawings
  ];

  // Revision Remarks comes FIRST, but is not numbered or in TOC
  for (const item of revisionRemarks) {
    const addedIndexes = await appendPDF(finalPdf, item.file);
    noNumberPageIndexes.push(...addedIndexes);
  }

  // Cover Page comes after Revision Remarks
  for (const item of coverPages) {
    await appendPDF(finalPdf, item.file);
  }

  const tocPage = finalPdf.addPage([612, 792]);

  const tocItems = [];

  for (const item of contentFiles) {
    const startPage = finalPdf.getPageCount() + 1 - noNumberPageIndexes.length;

    tocItems.push({
      title: item.displayTitle,
      section: item.packetSection,
      startPage,
      tocLevel: 0
    });

    const detectedSubsections =
      await detectTOCSubsections(
        item.file,
        item.packetSection,
        startPage
      );

    tocItems.push(...detectedSubsections);
    await appendPDF(finalPdf, item.file);
  }

  await drawTOCOnExistingPage(finalPdf, tocPage, tocItems);
  await addPageNumbers(finalPdf, noNumberPageIndexes);

  console.log("About to save PDF...");

  const pdfBytes = await finalPdf.save();

  console.log("PDF saved. About to download...");
  downloadFile(pdfBytes, getOutputFileName(), "application/pdf");
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

  datasheets.forEach((item, index) => {
    const currentOrder = item.datasheetOrder || index + 1;

    const row = document.createElement("div");
    row.className = "order-row";

    row.innerHTML = `
      <select data-id="${item.id}">
        ${datasheets.map((_, i) => `
          <option value="${i + 1}" ${i + 1 === currentOrder ? "selected" : ""}>
            ${i + 1}
          </option>
        `).join("")}
      </select>

      <span>${item.displayTitle}</span>
    `;

    list.appendChild(row);
  });

  modal.classList.remove("hidden");
}

function closeDatasheetOrderModal() {
  const modal = document.getElementById("datasheetOrderModal");
  if (modal) modal.classList.add("hidden");
}

function confirmDatasheetOrder() {
  const selects = Array.from(document.querySelectorAll("#datasheetOrderList select"));

  selects.forEach(select => {
    const item = pdfLibrary.find(x => x.id === select.dataset.id);
    if (item) {
      item.datasheetOrder = Number(select.value);
    }
  });

  sortLibraryBySection();
  renderUploadedPdfList();
  closeDatasheetOrderModal();

  pendingBuild = true;
  buildPacket();
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

async function drawTOCOnExistingPage(pdfDoc, page, tocItems) {
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const projectNumber = document.getElementById("projectNumber").value || "";
  const projectName = document.getElementById("projectName").value || "";

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

  centerText("Product Submittal", startY - 35, 18, timesBold);

  const tocText = "Table of Contents";
  const tocSize = 20;
  const tocWidth = timesBoldItalic.widthOfTextAtSize(tocText, tocSize);
  const tocX = (width - tocWidth) / 2;

  drawUnderlinedText(tocText, tocX, startY - 75, tocSize, timesBoldItalic);

  const pageNoX = pageRight - 55;

  page.drawText("Page No.", {
    x: pageNoX,
    y: startY - 120,
    size: 12,
    font: times
  });

  let y = startY - 145;

  const sectionDefinitions = [
    "Warranty",
    "Datasheets",
    "Control Panel Components",
    "Shop Drawings",
    "Appendix"
  ];

  const romans = ["I", "II", "III", "IV", "V", "VI", "VII"];

  let sectionNumber = 0;

  sectionDefinitions.forEach(section => {
    const items = tocItems.filter(item => item.section === section);

    if (items.length === 0) return;

    const roman = romans[sectionNumber];
    sectionNumber++;

    page.drawText(`${roman}. ${section}`, {
      x: leftMargin,
      y,
      size: 12,
      font: timesBold
    });

    y -= 14;

    items.forEach(item => {
      const level = item.tocLevel || 0;
      const levelSettings = {
        0: { bullet: "•", bulletX: leftMargin + 18, titleX: leftMargin + 32 },
        1: { bullet: "*", bulletX: leftMargin + 48, titleX: leftMargin + 62 },
        2: { bullet: "▪", bulletX: leftMargin + 78, titleX: leftMargin + 92 }
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