const { PDFDocument, StandardFonts, rgb } = PDFLib;

let pdfLibrary = [];

const sectionOrder = {
  "Cover Page": 1,
  "Table of Contents": 2,
  "Warranty": 3,
  "Datasheets": 4,
  "Shop Drawings": 5,
  "Appendix": 6
};

const documentTypes = [
  "Cover Page",
  "Table of Contents",
  "Warranty",
  "Datasheet",
  "Shop Drawing",
  "Drawing",
  "Manual",
  "Certification",
  "Spec Sheet",
  "Test Report",
  "Appendix",
  "Other"
];

const packetSections = [
  "Cover Page",
  "Table of Contents",
  "Warranty",
  "Datasheets",
  "Shop Drawings",
  "Appendix"
];

let libraryDB = [];
const LIB_DB_KEY = "submittalLibraryDB";

function loadLibraryDB() {
  try {
    const raw = localStorage.getItem(LIB_DB_KEY);
    libraryDB = raw ? JSON.parse(raw) : [];
  } catch (e) {
    libraryDB = [];
  }

  sortLibraryDB();
  renderLibraryDB();
}

function saveLibraryDB() {
  localStorage.setItem(LIB_DB_KEY, JSON.stringify(libraryDB));
}

function sortLibraryDB() {
  libraryDB.sort((a, b) => {
    if (a.documentType === b.documentType) {
      return a.displayTitle.localeCompare(b.displayTitle);
    }

    return a.documentType.localeCompare(b.documentType);
  });
}

function renderLibraryDB() {
  const tbody = document.getElementById("libraryDBBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const searchEl = document.getElementById("librarySearch");
  const search = searchEl && searchEl.value
    ? searchEl.value.trim().toLowerCase()
    : "";

  const list = search
    ? libraryDB.filter(item => {
        const hay = [
          item.fileName,
          item.displayTitle,
          item.documentType,
          item.notes
        ].join(" ").toLowerCase();

        return hay.includes(search);
      })
    : libraryDB;

  list.forEach(item => {
    const row = document.createElement("tr");

    const docOptions = documentTypes.map(opt => `
      <option value="${opt}" ${opt === item.documentType ? "selected" : ""}>${opt}</option>
    `).join("");

    row.innerHTML = `
      <td>${item.uploadDate || ""}</td>
      <td>${item.fileName || ""}</td>
      <td><input value="${item.displayTitle || ""}" onchange="updateLibraryDBItem('${item.id}', 'displayTitle', this.value)" /></td>
      <td><select onchange="updateLibraryDBItem('${item.id}', 'documentType', this.value)">${docOptions}</select></td>
      <td><input value="${item.notes || ""}" onchange="updateLibraryDBItem('${item.id}', 'notes', this.value)" /></td>
      <td><button onclick="removeLibraryDBEntry('${item.id}')">Remove</button></td>
    `;

    tbody.appendChild(row);
  });
}

function addLibraryEntryFromForm() {
  const fileName = document.getElementById("libFileName").value.trim();
  const displayTitle = document.getElementById("libDisplayTitle").value.trim();
  const documentType = document.getElementById("libDocumentType").value;
  const notes = document.getElementById("libNotes").value.trim();

  if (!displayTitle && !fileName) {
    return alert("Provide at least a file name or display title");
  }

  const entry = {
    id: crypto.randomUUID(),
    uploadDate: new Date().toLocaleDateString(),
    fileName,
    displayTitle: displayTitle || fileName,
    documentType,
    notes
  };

  addLibraryEntry(entry);

  document.getElementById("libFileName").value = "";
  document.getElementById("libDisplayTitle").value = "";
  document.getElementById("libNotes").value = "";
}

function addLibraryEntry(entry, options = {}) {
  const exists = libraryDB.find(x =>
    (x.fileName && entry.fileName && x.fileName === entry.fileName) ||
    x.displayTitle === entry.displayTitle
  );

  if (exists) {
    if (!options.silent) {
      alert(`Duplicate entry for "${entry.displayTitle}" already exists. Press OK to dismiss.`);
    }

    return;
  }

  libraryDB.push(entry);

  sortLibraryDB();
  saveLibraryDB();
  renderLibraryDB();
}

function removeLibraryDBEntry(id) {
  libraryDB = libraryDB.filter(x => x.id !== id);
  saveLibraryDB();
  renderLibraryDB();
}

function updateLibraryDBItem(id, field, value) {
  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  item[field] = value;

  saveLibraryDB();
  sortLibraryDB();
  renderLibraryDB();
}

function exportLibraryCSV() {
  const headers = ["Date", "File Name", "Display Title", "Document Type", "Notes"];

  const rows = libraryDB.map(i => [
    i.uploadDate,
    i.fileName,
    i.displayTitle,
    i.documentType,
    i.notes
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadFile(csv, "library-db.csv", "text/csv");
}


let tocTemplate = {
  fileName: "",
  text: ""
};

const pdfUpload = document.getElementById("pdfUpload");
if (pdfUpload) {
  pdfUpload.addEventListener("change", handlePDFUpload);
}

const tocUpload = document.getElementById("tocTemplateUpload");
if (tocUpload) {
  tocUpload.addEventListener("change", handleTOCTemplateUpload);
}

const tocPreview = document.getElementById("tocTemplatePreview");
if (tocPreview) {
  tocPreview.addEventListener("input", event => {
    tocTemplate.text = event.target.value;
  });
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
      notes: ""
    });
  });

  sortLibraryBySection();
  renderTable();
}

function guessDocumentType(fileName) {
  const name = fileName.toLowerCase();

  if (name.includes("cover")) return "Cover Page";
  if (name.includes("table of contents") || name.includes("toc")) return "Table of Contents";
  if (name.includes("warranty")) return "Warranty";
  if (name.includes("shop")) return "Shop Drawing";
  if (name.includes("drawing")) return "Drawing";
  if (name.includes("manual")) return "Manual";
  if (name.includes("cert")) return "Certification";
  if (name.includes("spec")) return "Spec Sheet";
  if (name.includes("test")) return "Test Report";

  return "Datasheet";
}

function guessPacketSection(fileName) {
  const type = guessDocumentType(fileName);

  if (type === "Cover Page") return "Cover Page";
  if (type === "Table of Contents") return "Table of Contents";
  if (type === "Warranty") return "Warranty";
  if (type === "Shop Drawing" || type === "Drawing") return "Shop Drawings";
  if (type === "Appendix" || type === "Other") return "Appendix";

  return "Datasheets";
}

function handleTOCTemplateUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("templateFileName").textContent = file.name;

  file.arrayBuffer().then(arrayBuffer => {
    mammoth.extractRawText({ arrayBuffer })
      .then(result => {
        tocTemplate.fileName = file.name;
        tocTemplate.text = result.value.trim();
        document.getElementById("tocTemplatePreview").value = tocTemplate.text;
      })
      .catch(() => {
        tocTemplate.text = "";
        document.getElementById("tocTemplatePreview").value =
          "Unable to read the DOCX file. Please try a .docx template.";
      });
  });
}

function sortLibraryBySection() {
  pdfLibrary.sort((a, b) => {
    return sectionOrder[a.packetSection] - sectionOrder[b.packetSection];
  });
}

function renderTable() {
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
        onclick="removeItem('${item.id}')">
        Remove
      </button>
    `;

    container.appendChild(row);
  });
}

function makeDropdown(id, field, options, selected) {
  return `
    <select onchange="updateItem('${id}', '${field}', this.value)">
      ${options.map(option => `
        <option value="${option}" ${option === selected ? "selected" : ""}>${option}</option>
      `).join("")}
    </select>
  `;
}

function updateItem(id, field, value) {
  const item = pdfLibrary.find(x => x.id === id);
  if (!item) return;

  item[field] = value;

  if (field === "documentType") {
    item.packetSection = mapTypeToSection(value);
  }

  renderTable();
}

function mapTypeToSection(type) {
  if (type === "Cover Page") return "Cover Page";
  if (type === "Table of Contents") return "Table of Contents";
  if (type === "Warranty") return "Warranty";
  if (type === "Shop Drawing" || type === "Drawing") return "Shop Drawings";
  if (type === "Appendix" || type === "Other") return "Appendix";

  return "Datasheets";
}

function moveItem(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= pdfLibrary.length) return;

  const temp = pdfLibrary[index];
  pdfLibrary[index] = pdfLibrary[newIndex];
  pdfLibrary[newIndex] = temp;

  renderTable();
}

function removeItem(id) {
  pdfLibrary = pdfLibrary.filter(item => item.id !== id);
  renderTable();
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

  renderTable();
}

let pendingBuild = false;

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

  const included = pdfLibrary.filter(item => item.include);

  const coverPages = included.filter(x => x.packetSection === "Cover Page");
  const warranties = included.filter(x => x.packetSection === "Warranty");
  const datasheets = included.filter(x => x.packetSection === "Datasheets");
  const shopDrawings = included.filter(x => x.packetSection === "Shop Drawings");
  const appendix = included.filter(x => x.packetSection === "Appendix");

  const contentFiles = [
    ...warranties,
    ...datasheets,
    ...shopDrawings,
    ...appendix
  ];

  for (const item of coverPages) {
    await appendPDF(finalPdf, item.file);
  }

  const tocPage = finalPdf.addPage([612, 792]);

  const tocItems = [];

  for (const item of contentFiles) {
    const startPage = finalPdf.getPageCount() + 1;

    tocItems.push({
      title: item.displayTitle,
      section: item.packetSection,
      startPage
    });

    await appendPDF(finalPdf, item.file);
  }

  await drawTOCOnExistingPage(finalPdf, tocPage, tocItems, tocTemplate.text);
  await addPageNumbers(finalPdf);

  const pdfBytes = await finalPdf.save();
  downloadFile(pdfBytes, getOutputFileName(), "application/pdf");

  try {
    mergeSubmittalIntoLibrary(included);
  } catch (e) {
    console.error("Error merging into library", e);
  }
}

function openDatasheetOrderModal(datasheets) {
  const modal = document.getElementById("datasheetOrderModal");
  const list = document.getElementById("datasheetOrderList");

  list.innerHTML = "";

  datasheets.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "order-row";

    row.innerHTML = `
      <select data-id="${item.id}">
        ${datasheets.map((_, i) => `
          <option value="${i + 1}" ${i === index ? "selected" : ""}>${i + 1}</option>
        `).join("")}
      </select>

      <span>${item.displayTitle}</span>
    `;

    list.appendChild(row);
  });

  modal.classList.remove("hidden");
}

function closeDatasheetOrderModal() {
  document.getElementById("datasheetOrderModal").classList.add("hidden");
}

function confirmDatasheetOrder() {
  const selects = Array.from(document.querySelectorAll("#datasheetOrderList select"));

  const orderMap = {};

  selects.forEach(select => {
    orderMap[select.dataset.id] = Number(select.value);
  });

  pdfLibrary.sort((a, b) => {
    if (a.packetSection !== b.packetSection) {
      return sectionOrder[a.packetSection] - sectionOrder[b.packetSection];
    }

    if (a.packetSection === "Datasheets" && b.packetSection === "Datasheets") {
      return (orderMap[a.id] || 999) - (orderMap[b.id] || 999);
    }

    return 0;
  });

  renderTable();
  closeDatasheetOrderModal();

  pendingBuild = true;
  buildPacket();
}

async function appendPDF(finalPdf, file) {
  const bytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(bytes);
  const copiedPages = await finalPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

  copiedPages.forEach(page => finalPdf.addPage(page));
}

async function drawTOCOnExistingPage(pdfDoc, page, tocItems, templateText = "") {
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const projectNumber = document.getElementById("projectNumber").value || "";
  const projectName = document.getElementById("projectName").value || "";

  const { width, height } = page.getSize();

  // Margins converted from inches to PDF points
  const leftMargin = 0.7 * 72;     // 50.4
  const topMargin = 0.44 * 72;     // 31.68
  const rightMargin = 0.38 * 72;   // 27.36
  const bottomMargin = 0.13 * 72;  // 9.36

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

  const sections = ["Warranty", "Datasheets", "Shop Drawings", "Appendix"];

  sections.forEach((section, index) => {
    const items = tocItems.filter(item => item.section === section);
    if (items.length === 0) return;

    const roman = ["I","II", "III", "IV"][index];

    page.drawText(`${roman}. ${section}`, {
      x: leftMargin,
      y,
      size: 12,
      font: timesBold
    });

    y -= 14;

    items.forEach(item => {
      const bullet = "•";
      const bulletX = leftMargin + 18;
      const titleX = leftMargin + 32;
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

async function addPageNumbers(pdfDoc) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();

    const pageNumber = `${index + 1}`;
    const fontSize = 11;
    const textWidth = font.widthOfTextAtSize(pageNumber, fontSize);

    // CHANGE THIS
    const edgeMargin = 10;

    const rotation = page.getRotation().angle;

    let x;
    let y;
    let rotate;

    switch (rotation) {
      case 90:
        x = width - edgeMargin;
        y = (height / 2) - (textWidth / 2);
        rotate = PDFLib.degrees(90);
        break;

      case 180:
        x = (width / 2) + (textWidth / 2);
        y = height - edgeMargin;
        rotate = PDFLib.degrees(180);
        break;

      case 270:
        x = edgeMargin;
        y = (height / 2) + (textWidth / 2);
        rotate = PDFLib.degrees(270);
        break;

      default:
        x = (width - textWidth) / 2;
        y = edgeMargin;
        rotate = PDFLib.degrees(0);
        break;
    }

    page.drawText(pageNumber, {
      x,
      y,
      size: fontSize,
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

function mergeSubmittalIntoLibrary(items) {
  items.forEach(i => {
    const entry = {
      id: crypto.randomUUID(),
      uploadDate: new Date().toLocaleDateString(),
      fileName: i.fileName || "",
      displayTitle: i.displayTitle || (i.fileName || "").replace(/\.pdf$/i, ""),
      documentType: i.documentType || "Other",
      notes: i.notes || ""
    };

    addLibraryEntry(entry, { silent: true });
  });
}

window.addEventListener("load", () => {
  loadLibraryDB();

  const addBtn = document.getElementById("addLibraryEntryButton");
  if (addBtn) addBtn.addEventListener("click", addLibraryEntryFromForm);

  const exportBtn = document.getElementById("exportLibraryCSV");
  if (exportBtn) exportBtn.addEventListener("click", exportLibraryCSV);


  const searchEl = document.getElementById("librarySearch");
  if (searchEl) searchEl.addEventListener("input", renderLibraryDB);
});

function getOutputFileName() {
  const projectNumber = document.getElementById("projectNumber").value || "Project";
  const projectName = document.getElementById("projectName").value || "Submittal";
  const revision = document.getElementById("revision").value || "1";

  return `${projectNumber} - ${projectName} - Submittal Rev ${revision}.pdf`;
}

function downloadFile(data, fileName, type) {
  const blob = new Blob([data], { type });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(link.href);
}