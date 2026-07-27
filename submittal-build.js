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
