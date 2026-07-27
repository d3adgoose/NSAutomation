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
