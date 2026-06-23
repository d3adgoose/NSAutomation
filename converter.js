let converterPdfFile = null;
let converterExcelFile = null;
let converterMap = [];
let converterMatches = [];
let converterChangedPages = [];
let converterReplacementDetails = [];

const { PDFDocument, StandardFonts, rgb } = PDFLib;

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
      setConverterExcelFile(event.target.files[0]);
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

    const file = event.dataTransfer.files[0];
    if (!file) return;

    if (expectedType === "pdf") {
      setConverterPdfFile(file);
    }

    if (expectedType === "excel") {
      setConverterExcelFile(file);
    }
  });
}

function setConverterPdfFile(file) {
  if (!file) return;

  const name = file.name.toLowerCase();

  if (!(file.type === "application/pdf" || name.endsWith(".pdf"))) {
    alert("Please drop or choose a PDF file in the PDF box.");
    return;
  }

  converterPdfFile = file;
  converterMatches = [];
  converterChangedPages = [];
  converterReplacementDetails = [];

  const selected = document.getElementById("selectedConverterPdf");
  if (selected) {
    selected.textContent = `Selected PDF: ${file.name}`;
  }

  resetConverterPreview();
  updateConverterStatus();
}

function setConverterExcelFile(file) {
  if (!file) return;

  const name = file.name.toLowerCase();

  if (
    !(
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      name.endsWith(".csv")
    )
  ) {
    alert("Please drop or choose an Excel file in the Excel box.");
    return;
  }

  converterExcelFile = file;
  converterMap = [];
  converterMatches = [];
  converterChangedPages = [];
  converterReplacementDetails = [];

  const selected = document.getElementById("selectedConverterExcel");
  if (selected) {
    selected.textContent = `Selected Excel: ${file.name}`;
  }

  resetConverterPreview();
  updateConverterStatus();
}

function updateConverterStatus(message = "") {
  const status = document.getElementById("converterStatus");
  if (!status) return;

  if (message) {
    status.textContent = message;
    return;
  }

  const pdfText = converterPdfFile
    ? `PDF: ${converterPdfFile.name}`
    : "No PDF selected";

  const excelText = converterExcelFile
    ? `Excel: ${converterExcelFile.name}`
    : "No Excel selected";

  status.textContent = `${pdfText} | ${excelText}`;
}

async function readExcelConverterMap() {
  if (!converterExcelFile) {
    alert("Upload an Excel file first.");
    return [];
  }

  const buffer = await converterExcelFile.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: ""
  });

  const map = rows
    .map(row => {
      const oldPart =
        row["Old Part #"] ||
        row["Old Part#"] ||
        row["Old Part Number"] ||
        row["Old Part"] ||
        "";

      const itemCode =
        row["Item Code"] ||
        row["ItemCode"] ||
        row["New Part #"] ||
        row["New Part Number"] ||
        "";

      return {
        oldPart: String(oldPart).trim(),
        itemCode: String(itemCode).trim()
      };
    })
    .filter(item => item.oldPart && item.itemCode);

  converterMap = map;
  return map;
}

async function extractPDFTextByPage(file) {
  const bytes = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: bytes.slice(0)
  }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const textItems = textContent.items.map(item => ({
      text: item.str,
      transform: item.transform,
      width: item.width,
      height: item.height
    }));

    pages.push({
      pageNumber,
      text: textItems.map(item => item.text).join(" "),
      textItems
    });
  }

  return pages;
}

async function previewPartNumberChanges() {
  if (!converterPdfFile) {
    alert("Upload a PDF first.");
    return;
  }

  if (!converterExcelFile) {
    alert("Upload an Excel file first.");
    return;
  }

  updateConverterStatus("Reading Excel and scanning PDF...");

  const map = await readExcelConverterMap();

  if (!map.length) {
    updateConverterStatus("No Old Part # / Item Code rows found in the Excel file.");
    alert("No valid rows found. Make sure the Excel columns are named Old Part # and Item Code.");
    return;
  }

  const pages = await extractPDFTextByPage(converterPdfFile);

  converterMatches = map.map(item => {
    const foundPageCounts = pages
      .map(page => ({
        pageNumber: page.pageNumber,
        count: countTextOccurrences(page.text, item.oldPart)
      }))
      .filter(page => page.count > 0);
    const foundPages = foundPageCounts.map(page => page.pageNumber);

    return {
      ...item,
      foundPages,
      foundPageCounts,
      foundCount: foundPageCounts.reduce((sum, page) => sum + page.count, 0)
    };
  });

  renderConverterPreview();

  const foundCount = converterMatches.filter(item => item.foundPages.length).length;
  updateConverterStatus(`Preview complete. Found ${foundCount} matching part number(s).`);
}

function renderConverterPreview() {
  const tbody = document.getElementById("converterPreviewBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!converterMatches.length) {
    resetConverterPreview();
    return;
  }

  converterMatches.forEach(match => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeConverterHTML(match.oldPart)}</td>
      <td>${escapeConverterHTML(match.itemCode)}</td>
      <td>
        ${
          match.foundPages.length
            ? `Yes — Page(s): ${match.foundPages.join(", ")}`
            : "No"
        }
      </td>
    `;

    row.innerHTML = row.innerHTML.replace(/Yes .+ Page\(s\):/, "Yes - Page(s):");
    row.cells[2].textContent = getConverterFoundText(match);

    tbody.appendChild(row);
  });
}

function getConverterFoundText(match) {
  if (!match.foundPages.length) return "No";

  return `Yes - ${match.foundCount} mention(s) on page(s): ${match.foundPages.join(", ")}`;
}

async function generateConvertedPDF() {
  const result = await buildConvertedPDFBytes(true);
  if (!result) return;

  const outputName = converterPdfFile.name.replace(
    /\.pdf$/i,
    " - Converted.pdf"
  );

  downloadConverterFile(result.bytes, outputName, "application/pdf");
}

async function buildConvertedPDFBytes(showFinalStatus = false) {
  if (!converterPdfFile) {
    alert("Upload a PDF first.");
    return null;
  }

  if (!converterExcelFile) {
    alert("Upload an Excel file first.");
    return null;
  }

  updateConverterStatus("Generating converted PDF...");

  const map = converterMap.length
    ? converterMap
    : await readExcelConverterMap();

  if (!map.length) {
    alert("No valid Old Part # / Item Code rows were found.");
    updateConverterStatus("Could not generate PDF because no valid Excel rows were found.");
    return null;
  }

  const originalBytes = await converterPdfFile.arrayBuffer();
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

  let replacementCount = 0;
  const changedPages = new Set();
  const replacementDetails = [];
  const backgroundSamplers = new Map();
  const expectedReplacementCounts = new Map(
    map.map(item => [item.oldPart, 0])
  );

  for (let pageIndex = 0; pageIndex < pdfDoc.getPageCount(); pageIndex++) {
    const pdfLibPage = pdfDoc.getPage(pageIndex);
    const page = await pdfForText.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();
    const pageSize = pdfLibPage.getSize();

    for (const textItem of textContent.items) {
      const text = textItem.str;
      if (!text) continue;

      const replacements = getTextItemReplacements(text, map);
      if (!replacements.length) continue;

      const replacementText = applyTextItemReplacements(text, replacements);
      const replacementFont = getReplacementFont(textItem, fonts);
      const placement = getTextItemReplacementPlacement(
        textItem,
        text,
        replacementText,
        replacementFont
      );
      const backgroundColor = await getTextItemBackgroundColor(
        page,
        pageIndex,
        placement,
        pageSize,
        backgroundSamplers
      );

      pdfLibPage.drawRectangle({
        x: placement.rectX,
        y: placement.rectY,
        width: placement.rectWidth,
        height: placement.rectHeight,
        color: backgroundColor
      });

      pdfLibPage.drawText(replacementText, {
        x: placement.textX,
        y: placement.textY,
        size: placement.fontSize,
        font: replacementFont,
        color: rgb(0, 0, 0)
      });

      replacements.forEach(replacement => {
        replacement.matches.forEach(() => {
          replacementCount++;
          expectedReplacementCounts.set(
            replacement.oldPart,
            (expectedReplacementCounts.get(replacement.oldPart) || 0) + 1
          );
          changedPages.add(pageIndex + 1);
          replacementDetails.push({
            pageNumber: pageIndex + 1,
            oldPart: replacement.oldPart,
            itemCode: replacement.itemCode
          });
        });
      });
    }
  }

  let convertedBytes = await pdfDoc.save();
  converterChangedPages = Array.from(changedPages).sort((a, b) => a - b);
  converterReplacementDetails = replacementDetails;
  const overlayVerification = await verifyConvertedPDF(
    convertedBytes,
    map,
    expectedReplacementCounts
  );
  convertedBytes = await flattenChangedPDFPages(
    convertedBytes,
    converterChangedPages
  );
  const finalVerification = await verifyNoSelectableOldParts(
    convertedBytes,
    map
  );
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

  return {
    bytes: convertedBytes,
    changedPages: converterChangedPages,
    replacementDetails,
    verification
  };
}

function getTextItemReplacements(text, map) {
  return map
    .filter(item => text.includes(item.oldPart))
    .map(item => ({
      ...item,
      matches: findExactMatchesInTextItem(text, item.oldPart)
    }))
    .filter(item => item.matches.length > 0);
}

function applyTextItemReplacements(text, replacements) {
  return replacements.reduce(
    (result, item) => result.split(item.oldPart).join(item.itemCode),
    text
  );
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

function getTextItemReplacementPlacement(textItem, originalText, replacementText, font) {
  const transform = textItem.transform || [1, 0, 0, 8, 0, 0];
  const baseX = transform[4] || 0;
  const baseY = transform[5] || 0;
  const fontSize = Math.max(
    6,
    Math.abs(transform[3]) || Math.abs(transform[0]) || textItem.height || 8
  );
  const pdfTextWidth = textItem.width || 0;
  const measuredFullWidth = font.widthOfTextAtSize(originalText, fontSize);
  const usableTextWidth = pdfTextWidth || measuredFullWidth;
  const coverWidth = usableTextWidth + 2;
  let replacementFontSize = fontSize;
  let replacementTextWidth = font.widthOfTextAtSize(
    replacementText,
    replacementFontSize
  );

  while (replacementTextWidth > coverWidth && replacementFontSize > 5) {
    replacementFontSize -= 0.25;
    replacementTextWidth = font.widthOfTextAtSize(
      replacementText,
      replacementFontSize
    );
  }

  return {
    fontSize: replacementFontSize,
    textX: baseX,
    textY: baseY + (fontSize - replacementFontSize) * 0.35,
    rectX: baseX - 1,
    rectY: baseY - (fontSize * 0.22),
    rectWidth: Math.max(coverWidth, replacementTextWidth + 2),
    rectHeight: fontSize * 1.08
  };
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

  const points = [
    { x: placement.rectX + 1, y: placement.rectY + 1 },
    { x: placement.rectX + placement.rectWidth - 1, y: placement.rectY + 1 },
    { x: placement.rectX + 1, y: placement.rectY + placement.rectHeight - 1 },
    {
      x: placement.rectX + placement.rectWidth - 1,
      y: placement.rectY + placement.rectHeight - 1
    }
  ];
  const colors = points
    .map(point => sampler.sample(point.x, pageSize.height - point.y))
    .filter(Boolean);

  if (!colors.length) return rgb(1, 1, 1);

  const average = colors.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b
    }),
    { r: 0, g: 0, b: 0 }
  );

  return rgb(
    average.r / colors.length / 255,
    average.g / colors.length / 255,
    average.b / colors.length / 255
  );
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

async function openConverterPdfPreview() {
  if (!converterPdfFile) {
    alert("Upload a PDF first.");
    return;
  }

  if (!converterExcelFile) {
    alert("Upload an Excel file first.");
    return;
  }

  const modal = document.getElementById("converterPreviewModal");
  const status = document.getElementById("converterPreviewModalStatus");
  const beforeContainer = document.getElementById("converterBeforePreview");
  const afterContainer = document.getElementById("converterAfterPreview");

  if (modal) modal.classList.remove("hidden");
  if (status) status.textContent = "Building before and after preview...";

  if (beforeContainer) beforeContainer.innerHTML = "";
  if (afterContainer) afterContainer.innerHTML = "";

  const originalBytes = await converterPdfFile.arrayBuffer();
  const result = await buildConvertedPDFBytes(false);

  if (!result) {
    if (status) status.textContent = "Preview could not be created.";
    return;
  }

  const pagesToPreview = result.changedPages.length
    ? result.changedPages
    : getPreviewPagesFromMatches();

  await renderPdfPreviewBytes(originalBytes, beforeContainer, pagesToPreview);
  await renderPdfPreviewBytes(result.bytes, afterContainer, pagesToPreview);

  if (status) {
    status.textContent = pagesToPreview.length
      ? `Preview ready. Showing changed page(s): ${pagesToPreview.join(", ")}.`
      : "Preview ready. No changed pages were found.";
  }
}

function closeConverterPdfPreview() {
  document.getElementById("converterPreviewModal")?.classList.add("hidden");
}

function getPreviewPagesFromMatches() {
  return Array.from(
    new Set(
      converterMatches.flatMap(match => match.foundPages || [])
    )
  ).sort((a, b) => a - b);
}

async function renderPdfPreviewBytes(bytes, container, pageNumbers = []) {
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

    const canvas = document.createElement("canvas");
    canvas.className = "converter-preview-page";
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    container.appendChild(canvas);

    await page.render({
      canvasContext: canvas.getContext("2d", { willReadFrequently: true }),
      viewport
    }).promise;
  }

  if (!pageNumbers.length && pdf.numPages > pagesToRender.length) {
    const note = document.createElement("p");
    note.textContent = `Showing first ${pagesToRender.length} page(s) only.`;
    container.appendChild(note);
  }
}

function clearConverterFiles() {
  converterPdfFile = null;
  converterExcelFile = null;
  converterMap = [];
  converterMatches = [];
  converterChangedPages = [];
  converterReplacementDetails = [];

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

  resetConverterPreview();
  updateConverterStatus("No files selected yet.");
}

function resetConverterPreview() {
  const tbody = document.getElementById("converterPreviewBody");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3">No changes previewed yet.</td>
      </tr>
    `;
  }
}

function downloadConverterFile(bytes, fileName, mimeType) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function escapeConverterHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
