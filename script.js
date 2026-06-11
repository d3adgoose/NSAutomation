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

function clearLibraryDB() {
  if (!confirm("Clear the library database? This cannot be undone.")) return;

  libraryDB = [];
  saveLibraryDB();
  renderLibraryDB();
}

let tocTemplate = {
  fileName: "",
  text: ""
};

document.getElementById("pdfUpload").addEventListener("change", handlePDFUpload);
document.getElementById("tocTemplateUpload").addEventListener("change", handleTOCTemplateUpload);

document.getElementById("tocTemplatePreview").addEventListener("input", event => {
  tocTemplate.text = event.target.value;
});

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

function clearTOCTemplate() {
  tocTemplate = { fileName: "", text: "" };

  document.getElementById("tocTemplateUpload").value = "";
  document.getElementById("templateFileName").textContent = "No template imported";
  document.getElementById("tocTemplatePreview").value = "";
}

function sortLibraryBySection() {
  pdfLibrary.sort((a, b) => {
    return sectionOrder[a.packetSection] - sectionOrder[b.packetSection];
  });
}

function renderTable() {
  const tbody = document.getElementById("pdfTableBody");
  tbody.innerHTML = "";

  pdfLibrary.forEach((item, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${item.uploadDate}</td>
      <td>${item.fileName}</td>
      <td><input value="${item.displayTitle}" onchange="updateItem('${item.id}', 'displayTitle', this.value)" /></td>
      <td>${makeDropdown(item.id, "documentType", documentTypes, item.documentType)}</td>
      <td>${makeDropdown(item.id, "packetSection", packetSections, item.packetSection)}</td>
      <td><input type="checkbox" ${item.include ? "checked" : ""} onchange="updateItem('${item.id}', 'include', this.checked)" /></td>
      <td><input value="${item.notes}" onchange="updateItem('${item.id}', 'notes', this.value)" /></td>
      <td>
        <button onclick="moveItem(${index}, -1)">↑</button>
        <button onclick="moveItem(${index}, 1)">↓</button>
        <button onclick="removeItem('${item.id}')">Remove</button>
      </td>
    `;

    tbody.appendChild(row);
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

async function buildPacket() {
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

  // 1. Add cover page PDFs first
  for (const item of coverPages) {
    await appendPDF(finalPdf, item.file);
  }

  // 2. Always generate a TOC page after the cover page
  const tocPage = finalPdf.addPage([612, 792]);

  // 3. Add the rest of the PDFs and record their final start page numbers
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

  // 4. Draw the TOC onto the page after the cover
  await drawTOCOnExistingPage(finalPdf, tocPage, tocItems, tocTemplate.text);

  // 5. Add page numbers after the merge is complete
  await addPageNumbers(finalPdf);

  const pdfBytes = await finalPdf.save();
  downloadFile(pdfBytes, getOutputFileName(), "application/pdf");

  try {
    mergeSubmittalIntoLibrary(included);
  } catch (e) {
    console.error("Error merging into library", e);
  }
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

  const { width } = page.getSize();

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

  // Top left project info
  page.drawText(`NS Corp. Project No.: ${projectNumber}`, {
    x: 72,
    y: 720,
    size: 12,
    font: times
  });

  page.drawText(`Project Name: ${projectName}`, {
    x: 72,
    y: 705,
    size: 12,
    font: times
  });

  // No blank line gap after Project Name
  centerText("Product Submittal", 685, 18, timesBold);

  // One line gap after Product Submittal
  const tocText = "Table of Contents";
  const tocSize = 20;
  const tocWidth = timesBoldItalic.widthOfTextAtSize(tocText, tocSize);
  const tocX = (width - tocWidth) / 2;

  drawUnderlinedText(tocText, tocX, 645, tocSize, timesBoldItalic);

  // Page No. header on right
  page.drawText("Page No.", {
    x: 500,
    y: 600,
    size: 12,
    font: times
  });

  let y = 575;

  const sections = ["Warranty", "Datasheets", "Shop Drawings", "Appendix"];

  sections.forEach((section, index) => {
    const items = tocItems.filter(item => item.section === section);
    if (items.length === 0) return;

    const roman = ["II", "III", "IV", "V"][index];

    page.drawText(`${roman}. ${section}`, {
      x: 72,
      y,
      size: 12,
      font: timesBold
    });

    y -= 14;

    items.forEach(item => {
      page.drawText(item.title, {
        x: 95,
        y,
        size: 12,
        font: times
      });

      page.drawText(`${item.startPage}`, {
        x: 520,
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
    const { width } = page.getSize();

    page.drawText(`${index + 1}`, {
      x: width / 2,
      y: 25,
      size: 11,
      font,
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

  const clearBtn = document.getElementById("clearLibraryDB");
  if (clearBtn) clearBtn.addEventListener("click", clearLibraryDB);

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