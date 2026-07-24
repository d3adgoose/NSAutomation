/* PDF page rendering, extraction, and deletion for Submittal and O&M packets. */

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
    const pdf = await pdfjsLib.getDocument(
      getPacketPDFJSOptions(sourceBytes.slice(0))
    ).promise;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const card = document.createElement("div");
      const header = document.createElement("div");
      const label = document.createElement("span");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      card.className = "page-manager-card";
      card.dataset.pageNumber = String(pageNumber);
      header.className = "page-manager-card-header";
      label.textContent = `Page ${pageNumber}`;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const updateSelection = checked => {
        card.classList.toggle("selected", checked);
        if (checked) selectedManagedPages.add(pageNumber);
        else selectedManagedPages.delete(pageNumber);
        updatePageManagerStatus(pdf.numPages);
      };

      card.addEventListener("click", () => {
        updateSelection(!selectedManagedPages.has(pageNumber));
      });

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
    downloadFile(outputBytes, `${baseName} - Extracted Pages.pdf`, "application/pdf");
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

    recordBuilderUndoState();
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
      if (!hasValidTOCSourcePage(entry)) return [entry];
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

    if (pageManagerOpen) await renderPageManagerPreviews(item);
    else {
      renderCurrentSubsectionList();
      await renderPDFPagePreviews(item);
    }
  } catch (error) {
    console.error("Could not delete PDF pages:", error);
    await showMessageModal("Delete Failed", "The selected pages could not be deleted.");
  }
}
