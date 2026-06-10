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

// For dropdown options
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

// For dropdown options
const packetSections = [
  "Cover Page",
  "Table of Contents",
  "Warranty",
  "Datasheets",
  "Shop Drawings",
  "Appendix"
];

let tocTemplate = {
  fileName: "",
  text: ""
};

document.getElementById("pdfUpload").addEventListener("change", handlePDFUpload);
document.getElementById("tocTemplateUpload").addEventListener("change", handleTOCTemplateUpload);
document.getElementById("tocTemplatePreview").addEventListener("input", (event) => {
  tocTemplate.text = event.target.value;
});

function handlePDFUpload(event) {
  const files = Array.from(event.target.files);

  files.forEach((file) => {
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

// Heuristic to guess document type based on filename 
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

// Heuristic to guess packet section based on document type 
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
        document.getElementById("tocTemplatePreview").value = "Unable to read the DOCX file. Please try a .docx template.";
      });
  });
}

function clearTOCTemplate() {
  tocTemplate = { fileName: "", text: "" };
  document.getElementById("tocTemplateUpload").value = "";
  document.getElementById("templateFileName").textContent = "No template imported";
  document.getElementById("tocTemplatePreview").value = "";
}

// Sort library based on defined section order
function sortLibraryBySection() {
  pdfLibrary.sort((a, b) => {
    return sectionOrder[a.packetSection] - sectionOrder[b.packetSection];
  });
}

// Render the library table 
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

// Update 
function updateItem(id, field, value) {
  const item = pdfLibrary.find(x => x.id === id);
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

  const orderedFiles = [...coverPages];

  if (document.getElementById("autoTOC").checked) {
    orderedFiles.push({ generatedTOC: true, templateText: tocTemplate.text });
  }

  orderedFiles.push(...warranties, ...datasheets, ...shopDrawings, ...appendix);

  const tocItems = [];
  let currentPage = 1;

  for (const item of orderedFiles) {
    if (item.generatedTOC) {
      currentPage += 1;
      continue;
    }

    // Page count for TOC generation
    const pageCount = await getPageCount(item.file);
    tocItems.push({
      title: item.displayTitle,
      section: item.packetSection,
      startPage: currentPage
    });

    currentPage += pageCount;
  }

  for (const item of orderedFiles) {
    if (item.generatedTOC) {
      await addTOCPage(finalPdf, tocItems, item.templateText);
    } else {
      await appendPDF(finalPdf, item.file);
    }
  }

  await addPageNumbers(finalPdf);

  const pdfBytes = await finalPdf.save();
  downloadFile(pdfBytes, getOutputFileName(), "application/pdf");
}

async function getPageCount(file) {
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}

async function appendPDF(finalPdf, file) {
  const bytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(bytes);
  const copiedPages = await finalPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

  copiedPages.forEach(page => finalPdf.addPage(page));
}

async function addTOCPage(pdfDoc, tocItems, templateText = "") {
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const lines = templateText
    ? templateText.split(/\r?\n/)
    : ["Table of Contents", ""]; 

  let y = 750;
  const maxWidth = 520;
  const lineHeight = 18;

  lines.forEach((line, index) => {
    const text = line.trim();

    if (index === 0 && text) {
      page.drawText(text, {
        x: 60,
        y,
        size: 22,
        font: boldFont
      });
      y -= 34;
      return;
    }

    if (!text) {
      y -= lineHeight;
      return;
    }

    page.drawText(text, {
      x: 60,
      y,
      size: 12,
      font
    });
    y -= lineHeight;
  });

  if (y < 140) {
    y = 140;
  }

  const sections = ["Warranty", "Datasheets", "Shop Drawings", "Appendix"];

  sections.forEach((section, index) => {
    const items = tocItems.filter(item => item.section === section);
    if (items.length === 0) return;

    const roman = ["I", "II", "III", "IV"][index];

    page.drawText(`${roman}. ${section}`, {
      x: 60,
      y,
      size: 16,
      font: boldFont
    });

    y -= 24;

    items.forEach(item => {
      page.drawText(`• ${item.title}`, {
        x: 80,
        y,
        size: 11,
        font
      });

      page.drawText(`${item.startPage}`, {
        x: 530,
        y,
        size: 11,
        font
      });

      y -= 20;
    });

    y -= 14;
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
      size: 10,
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

// Generate output flename based on project info 
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

function clearLibrary() {
  pdfLibrary = [];
  renderTable();
}
