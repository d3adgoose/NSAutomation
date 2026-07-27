/* --------------------------------------------------------------------------
   Datasheet order and page-level organization
   -------------------------------------------------------------------------- */

function openDatasheetOrderModal(datasheets) {
  const modal = document.getElementById("datasheetOrderModal");
  const list = document.getElementById("datasheetOrderList");

  if (!modal || !list) return;

  renderBuildSummary("datasheetBuildSummary");
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

  list.ondragover = e => {
    e.preventDefault();

    const dragging = list.querySelector(".dragging");
    const afterElement = getDragAfterElement(list, e.clientY);

    if (!dragging) return;

    if (afterElement == null) {
      list.appendChild(dragging);
    } else {
      list.insertBefore(dragging, afterElement);
    }
  };

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

function getSectionsNeedingOrganization() {
  const included = pdfLibrary.filter(item => item.include);

  const romanSections =
    typeof isOMPacket === "function" && isOMPacket()
      ? OM_SECTION_ORDER
      : [
          "Warranty",
          "Datasheets",
          "Control Panel Components",
          "Shop Drawings",
          "Appendix"
        ];

  return romanSections
    .map(section => ({
      section,
      files: included.filter(item => item.packetSection === section)
    }))
    .filter(group => group.files.length > 1);
}

function openSectionOrderModal(sectionGroups) {
  const modal = document.getElementById("datasheetOrderModal");
  const list = document.getElementById("datasheetOrderList");

  if (!modal || !list) return;

  renderBuildSummary("datasheetBuildSummary");
  list.innerHTML = "";

  sectionGroups.forEach(group => {
    const details = document.createElement("details");
    details.className = "section-order-group";

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <strong>${getSectionLabel(group.section)}</strong>
      <span>${group.files.length} PDF(s)</span>
    `;

    const sectionList = document.createElement("div");
    sectionList.className = "section-order-list";
    sectionList.dataset.section = group.section;

    group.files
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

        sectionList.appendChild(row);
      });

    sectionList.addEventListener("dragover", e => {
      e.preventDefault();

      const dragging = sectionList.querySelector(".dragging");
      const afterElement = getDragAfterElement(sectionList, e.clientY);

      if (!dragging) return;

      if (afterElement == null) {
        sectionList.appendChild(dragging);
      } else {
        sectionList.insertBefore(dragging, afterElement);
      }
    });

    details.appendChild(summary);
    details.appendChild(sectionList);
    list.appendChild(details);
  });

  modal.classList.remove("hidden");
}

function confirmDatasheetOrder() {
  recordBuilderUndoState();
  const groups = Array.from(
    document.querySelectorAll("#datasheetOrderList .section-order-list")
  );

  groups.forEach(group => {
    const rows = Array.from(group.querySelectorAll(".order-row"));

    rows.forEach((row, index) => {
      const item = pdfLibrary.find(x => x.id === row.dataset.id);

      if (item) {
        item.datasheetOrder = index + 1;
      }
    });
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
    `Format Levels: ${item.displayTitle}`;
  activeId.value = item.id;
  selectedManagedPages = new Set();

  const subsectionPageNumber = document.getElementById("subsectionPageNumber");
  const subsectionTitle = document.getElementById("subsectionTitle");
  const tocEntryType = document.getElementById("tocEntryType");

  clearTOCEntryForm();

  const hideParent =
    document.getElementById("hideParentTOC");

  if (hideParent) {
    hideParent.checked = item.hideParentTOC || false;
  }
  if (hideParent) {
    hideParent.onchange = () => {
      recordBuilderUndoState();
      item.hideParentTOC = hideParent.checked;
      cleanInvalidTOCParents(item);
      updatePDFParentTOCLevelControls();
      renderCurrentSubsectionList();
      applySmartTOCLevelDefault(item);
      updateTOCParentDropdown();
    };
  }
  if (tocEntryType) tocEntryType.value = "section";

  previewList.innerHTML = "Scanning TOC entries...";

  try {
    await scanTOCEntriesForEditor(item);
  } catch (error) {
    console.warn("TOC scan failed:", error);
  }

  previewList.innerHTML = "Loading page previews...";

  const tocEntryLevel = document.getElementById("tocEntryLevel");
  const tocEntryParent = document.getElementById("tocEntryParent");

  if (tocEntryLevel) tocEntryLevel.value = "0";
  if (tocEntryParent) {
    tocEntryParent.innerHTML = `<option value="">N/A</option>`;
    tocEntryParent.disabled = true;
  }

  renderCurrentSubsectionList();
  updatePDFParentTOCLevelControls();
  applySmartTOCLevelDefault(item);
  updateTOCParentDropdown();

  modal.classList.remove("hidden");

  await renderPDFPagePreviews(item);
}

async function closeSubsectionModal() {
  const item = getActiveSubsectionItem();
  if (await warnIncompleteTemplateTOCEntries(item)) return;

  const modal = document.getElementById("subsectionModal");
  if (modal) modal.classList.add("hidden");
  closeTOCTemplateModal();

  selectedManagedPages = new Set();
  clearTOCEntryForm();
  renderUploadedPdfList();
}

function clearImportedPacketFooter(page) {
  const { width, height } = page.getSize();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const edgeSize = 36;
  let rectangle;

  if (rotation === 90) {
    rectangle = { x: width - edgeSize, y: 0, width: edgeSize, height };
  } else if (rotation === 180) {
    rectangle = { x: 0, y: height - edgeSize, width, height: edgeSize };
  } else if (rotation === 270) {
    rectangle = { x: 0, y: 0, width: edgeSize, height };
  } else {
    rectangle = { x: 0, y: 0, width, height: edgeSize };
  }

  page.drawRectangle({ ...rectangle, color: rgb(1, 1, 1) });
}

async function renderPDFPagePreviews(item) {
  const previewList = document.getElementById("subsectionPagePreviewList");
  if (!previewList) return;

  previewList.innerHTML = "";
  selectedManagedPages = new Set();

  const bytes = await getSourcePDFBytes(item.file);

  const pdf = await pdfjsLib.getDocument(
    getPacketPDFJSOptions(bytes.slice(0))
  ).promise;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const viewport = page.getViewport({ scale: 0.8 });

    const wrapper = document.createElement("div");
    wrapper.className = "pdf-page-preview";
    wrapper.dataset.pageNumber = pageNumber;

    const header = document.createElement("div");
    const label = document.createElement("div");
    header.className = "page-preview-header";
    label.className = "page-preview-label";
    label.textContent = `Page ${pageNumber}`;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    header.appendChild(label);
    wrapper.appendChild(header);
    wrapper.appendChild(canvas);
    previewList.appendChild(wrapper);

    wrapper.addEventListener("click", event => {
      document.querySelectorAll(".pdf-page-preview").forEach(el => {
        el.classList.remove("selected");
      });

      wrapper.classList.add("selected");
      document.getElementById("subsectionPageNumber").value = pageNumber;

      // A normal click establishes one unambiguous page for TOC placement and
      // Extract/Delete. Ctrl/Cmd-click is the optional multi-page gesture.
      if (event.ctrlKey || event.metaKey) {
        if (selectedManagedPages.has(pageNumber)) {
          selectedManagedPages.delete(pageNumber);
        } else {
          selectedManagedPages.add(pageNumber);
        }
      } else {
        selectedManagedPages = new Set([pageNumber]);
      }

      document.querySelectorAll(".pdf-page-preview").forEach(el => {
        el.classList.toggle(
          "page-action-selected",
          selectedManagedPages.has(Number(el.dataset.pageNumber))
        );
      });
      updateSubsectionPageSelectionStatus(pdf.numPages);
    });

    await page.render({
      canvasContext: context,
      viewport
    }).promise;
  }

  updateSubsectionPageSelectionStatus(pdf.numPages);
}

function getActiveSubsectionItem() {
  const activeId = document.getElementById("activeSubsectionPdfId")?.value;
  return pdfLibrary.find(item => item.id === activeId);
}

function getTOCParentTitle(item, parentId) {
  if (!parentId) return "N/A";
  if (parentId === PDF_PARENT_TOC_ID) {
    return item.hideParentTOC ? "N/A" : item.displayTitle || item.fileName || "PDF Name";
  }

  const parent = (item.tocEntries || []).find(entry => entry.id === parentId);
  return parent ? parent.title : "N/A";
}

function hasValidTOCSourcePage(entry) {
  const page = Number(entry?.sourcePage);
  return Number.isInteger(page) && page > 0;
}

function compareTOCEntries(a, b) {
  const pageA = hasValidTOCSourcePage(a) ? Number(a.sourcePage) : Number.MAX_SAFE_INTEGER;
  const pageB = hasValidTOCSourcePage(b) ? Number(b.sourcePage) : Number.MAX_SAFE_INTEGER;

  return pageA - pageB ||
    Number(a?.tocLevel || 0) - Number(b?.tocLevel || 0);
}

function getIncompleteTOCEntries() {
  return pdfLibrary.flatMap(item =>
    (item.tocEntries || [])
      .filter(entry => !hasValidTOCSourcePage(entry))
      .map(entry => ({ item, entry }))
  );
}

function getIncompleteTemplateTOCEntries(item) {
  return (item?.tocEntries || []).filter(entry =>
    entry.requiresPageBeforeClose && !hasValidTOCSourcePage(entry)
  );
}

function focusFirstIncompleteTemplateTOCEntry(item) {
  const first = getIncompleteTemplateTOCEntries(item)[0];
  if (!first) return;

  const row = document.querySelector(`[data-toc-entry-id="${first.id}"]`);
  if (row) {
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.add("toc-tree-row-attention");
    window.setTimeout(() => row.classList.remove("toc-tree-row-attention"), 1600);
  }
}

async function warnIncompleteTemplateTOCEntries(item) {
  const missing = getIncompleteTemplateTOCEntries(item);
  if (missing.length === 0) return false;

  focusFirstIncompleteTemplateTOCEntry(item);
  await showMessageModal(
      "Template Pages Required",
      `${missing.length} template TOC row(s) still need a PDF page. Add pages to the rows marked Template page required, or remove those rows before closing Format Levels.`
  );
  return true;
}

function openTOCTemplateModal() {
  const item = getActiveSubsectionItem();
  const modal = document.getElementById("tocTemplateModal");
  const status = document.getElementById("tocTemplateStatus");

  if (!item || !modal) return;

  if (status) {
    status.textContent = "Template rows will be added with blank pages. Edit each row to assign pages before building.";
  }

  renderTOCTemplatePreview();
  modal.classList.remove("hidden");
}

function closeTOCTemplateModal() {
  const modal = document.getElementById("tocTemplateModal");
  if (modal) modal.classList.add("hidden");
}

function renderTOCTemplatePreview() {
  const container = document.getElementById("tocTemplatePreviewList");
  if (!container) return;

  container.replaceChildren();

  const searchInput = document.getElementById("tocTemplateSearch");
  const searchTerm = String(searchInput?.value || "").trim().toLowerCase();
  const templates = TOC_ENTRY_TEMPLATES
    .filter(template => {
      if (!searchTerm) return true;
      return [
        template.name,
        ...(template.entries || []).map(entry => entry.title)
      ].some(value => String(value || "").toLowerCase().includes(searchTerm));
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  if (templates.length === 0) {
    container.innerHTML = "<p>No templates match your search.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "toc-template-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Template</th><th>Levels</th><th></th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  templates.forEach(template => {
    const row = document.createElement("tr");

    const templateCell = document.createElement("td");
    templateCell.innerHTML = "<strong>" + template.name + "</strong>";

    const levelsCell = document.createElement("td");
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = template.entries.length + " level(s)";
    details.appendChild(summary);

    const levelList = document.createElement("div");
    levelList.className = "toc-template-level-list";

        template.entries.forEach(entry => {
      const levelNumber = Math.max(0, Math.min(2, Number(entry.tocLevel || 0)));
      const entryRow = document.createElement("div");
      entryRow.className = `toc-template-level-row toc-template-level-${levelNumber}`;
      entryRow.style.setProperty("--toc-level", String(levelNumber));

      const rail = document.createElement("span");
      rail.className = "toc-template-level-rail";

      const name = document.createElement("span");
      name.className = "toc-template-level-name";
      name.textContent = entry.title || "";

      const level = document.createElement("span");
      level.className = "toc-template-level-badge";
      level.textContent = "Level " + levelNumber;

      entryRow.append(rail, name, level);
      levelList.appendChild(entryRow);
    });
    details.appendChild(levelList);
    levelsCell.appendChild(details);

    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Select";
    button.addEventListener("click", () => applyTOCTemplate(template.id));
    actionCell.appendChild(button);

    row.append(templateCell, levelsCell, actionCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

async function applyTOCTemplate(templateId) {
  const item = getActiveSubsectionItem();
  const status = document.getElementById("tocTemplateStatus");
  const template = TOC_ENTRY_TEMPLATES.find(candidate => candidate.id === templateId);

  if (!item || !template) return;

  recordBuilderUndoState();
  item.hideParentTOC = true;
  const hideParent = document.getElementById("hideParentTOC");
  if (hideParent) hideParent.checked = true;

  const pendingEntries = template.entries.map(entry => ({
    id: crypto.randomUUID(),
    title: entry.title,
    sourcePage: null,
    entryType: Number(entry.tocLevel || 0) === 0 ? "section" : "subsection",
    tocLevel: Number(entry.tocLevel || 0),
    parentId: "",
    detectedTOCEntry: false,
    requiresPageBeforeClose: true
  }));

  const lastParentByLevel = new Map();
  pendingEntries.forEach(entry => {
    const level = Number(entry.tocLevel || 0);

    if (level > 0) {
      const parent = lastParentByLevel.get(level - 1);
      entry.parentId = parent?.id || "";

      if (!entry.parentId && level - 1 === getPDFParentTOCLevel(item) && !item.hideParentTOC) {
        entry.parentId = PDF_PARENT_TOC_ID;
      }
    }

    lastParentByLevel.set(level, entry);
    for (let deeperLevel = level + 1; deeperLevel <= 2; deeperLevel++) {
      lastParentByLevel.delete(deeperLevel);
    }
  });

  item.tocEntries = [
    ...(item.tocEntries || []),
    ...pendingEntries
  ];
  item.tocEntriesReviewed = true;
  cleanInvalidTOCParents(item);
  item.tocEntries.sort(compareTOCEntries);

  clearTOCEntryForm();
  clearSubsectionPageSelection();
  renderCurrentSubsectionList();
  updateTOCParentDropdown();
  if (status) status.textContent = "Template added. Edit the rows marked Page required before building.";
}

function updateTOCLevelFromSelect() {
  updateTOCParentDropdown();
}

function getDefaultTOCParentId(parentOptions = [], currentParentId = "") {
  if (currentParentId && parentOptions.some(entry => entry.id === currentParentId)) {
    return currentParentId;
  }

  return parentOptions.length ? parentOptions[parentOptions.length - 1].id : "";
}

function updatePDFParentTOCLevelControls() {
  const item = getActiveSubsectionItem();
  const levelSelect = document.getElementById("pdfParentTOCLevel");

  if (!item || !levelSelect) return;

  levelSelect.value = String(getPDFParentTOCLevel(item));
  levelSelect.disabled = !!item.hideParentTOC;
}

function updatePDFParentTOCLevelFromSelect() {
  const item = getActiveSubsectionItem();
  const levelSelect = document.getElementById("pdfParentTOCLevel");

  if (!item || !levelSelect) return;

  const cleanLevel = normalizePacketTOCLevel(levelSelect.value);
  if (getPDFParentTOCLevel(item) === cleanLevel) return;

  recordBuilderUndoState();
  item.tocLevel = cleanLevel;
  cleanInvalidTOCParents(item);
  renderCurrentSubsectionList();
  updateTOCParentDropdown();
  updateUploadedPdfCount();
}

function updateTOCParentDropdown(selectedParentId = "") {
  const item = getActiveSubsectionItem();
  const levelSelect = document.getElementById("tocEntryLevel");
  const parentSelect = document.getElementById("tocEntryParent");

  if (!item || !levelSelect || !parentSelect) return;

  const level = Number(levelSelect.value || 0);
  const currentParentId = selectedParentId || parentSelect.value || "";

  parentSelect.innerHTML = "";

  if (level === 0) {
    parentSelect.disabled = true;
    parentSelect.innerHTML = `<option value="">N/A</option>`;
    return;
  }

  const parentLevel = level - 1;
  const parentOptions = [];

  if (parentLevel === getPDFParentTOCLevel(item) && !item.hideParentTOC) {
    parentOptions.push({
      id: PDF_PARENT_TOC_ID,
      title: item.displayTitle || item.fileName || "PDF Name"
    });
  }

  parentOptions.push(
    ...(item.tocEntries || [])
      .filter(entry =>
        Number(entry.tocLevel || 0) === parentLevel &&
        entry.id !== editingTOCEntryId
      )
  );

  parentSelect.disabled = false;

  if (parentOptions.length === 0) {
    parentSelect.innerHTML = `<option value="">No Level ${parentLevel} parent yet</option>`;
    return;
  }

  const defaultParentId = getDefaultTOCParentId(parentOptions, currentParentId);

  parentSelect.innerHTML = parentOptions
    .map(entry => `
      <option value="${entry.id}" ${entry.id === defaultParentId ? "selected" : ""}>
        ${entry.id === PDF_PARENT_TOC_ID ? `PDF Name: ${entry.title}` : entry.title}
      </option>
    `)
    .join("");
}

function getLevelTwoLetter(item, entry) {
  const siblings = (item.tocEntries || []).filter(other =>
    Number(other.tocLevel || 0) === 2 &&
    other.parentId === entry.parentId
  );

  const index = siblings.findIndex(other => other.id === entry.id);
  return `${String.fromCharCode(97 + Math.max(index, 0))}.`;
}

function orderTOCEntriesForDisplay(entries = []) {
  const sorted = [...entries].sort(compareTOCEntries);

  const childrenByParent = new Map();

  sorted.forEach(entry => {
    const parentKey = entry.parentId || "";
    if (!childrenByParent.has(parentKey)) {
      childrenByParent.set(parentKey, []);
    }

    childrenByParent.get(parentKey).push(entry);
  });

  const ordered = [];

  function addChildren(parentId = "") {
    const children = childrenByParent.get(parentId) || [];

    children.forEach(child => {
      ordered.push(child);
      addChildren(child.id);
    });
  }

  addChildren(PDF_PARENT_TOC_ID);
  addChildren("");
  return ordered;
}

function clearTOCEntryForm() {
  editingTOCEntryId = "";

  const pageInput = document.getElementById("subsectionPageNumber");
  const titleInput = document.getElementById("subsectionTitle");
  const levelSelect = document.getElementById("tocEntryLevel");
  const parentSelect = document.getElementById("tocEntryParent");
  const actionButton = document.getElementById("tocEntryActionButton");

  if (pageInput) pageInput.value = "";
  if (titleInput) titleInput.value = "";
  if (levelSelect) levelSelect.value = "0";
  if (parentSelect) {
    parentSelect.innerHTML = `<option value="">N/A</option>`;
    parentSelect.disabled = true;
  }
  if (actionButton) actionButton.textContent = "Add TOC Entry";

  document.querySelectorAll(".pdf-page-preview").forEach(el => {
    el.classList.remove("selected");
  });

  applySmartTOCLevelDefault();
}

function applySmartTOCLevelDefault(item = getActiveSubsectionItem()) {
  const levelSelect = document.getElementById("tocEntryLevel");
  if (!item || !levelSelect || editingTOCEntryId) return;

  const hideParent = document.getElementById("hideParentTOC");
  const pdfNameHidden = hideParent ? hideParent.checked : !!item.hideParentTOC;
  const hasEntries = (item.tocEntries || []).length > 0;

  // The visible PDF name already occupies Level 0. When it is hidden, the
  // first named entry replaces it at Level 0 and following entries nest below.
  levelSelect.value = String(pdfNameHidden && !hasEntries ? 0 : 1);
  updateTOCParentDropdown();
}

async function saveTOCEntry() {
  const activeIdInput = document.getElementById("activeSubsectionPdfId");
  const pageInput = document.getElementById("subsectionPageNumber");
  const titleInput = document.getElementById("subsectionTitle");
  const levelSelect = document.getElementById("tocEntryLevel");
  const parentSelect = document.getElementById("tocEntryParent");

  if (!activeIdInput || !pageInput || !titleInput || !levelSelect || !parentSelect) {
    await showMessageModal("TOC Form Error", "TOC modal is missing required HTML fields. Check the modal IDs.");
    return;
  }

  const activeId = activeIdInput.value;
  const pageNumber = Number(pageInput.value);
  const title = titleInput.value.trim();
  const tocLevel = Number(levelSelect.value || 0);
  const parentId = parentSelect.value || "";

  const item = pdfLibrary.find(x => x.id === activeId);
  if (!item) return;

  const hideParent = document.getElementById("hideParentTOC");
  item.hideParentTOC = hideParent ? hideParent.checked : false;

  if (!pageNumber || pageNumber < 1) {
    await showMessageModal("Page Required", "Select a page.");
    return;
  }

  if (!title) {
    await showMessageModal("TOC Name Required", "Enter a TOC name.");
    return;
  }

  if (tocLevel > 0 && !parentId) {
    await showMessageModal("Parent Required", `Select a Level ${tocLevel - 1} parent first.`);
    return;
  }

  if (!item.tocEntries) {
    item.tocEntries = [];
  }

  const existingEntry = editingTOCEntryId
    ? item.tocEntries.find(entry => entry.id === editingTOCEntryId)
    : null;
  const duplicateEntry = item.tocEntries.find(entry =>
    entry.id !== editingTOCEntryId &&
    normalizeDuplicateName(entry.title) === normalizeDuplicateName(title)
  );

  if (duplicateEntry) {
    const duplicateAction = await promptDuplicateTOCEntryAction(title, duplicateEntry);

    if (duplicateAction === "skip") return;

    if (duplicateAction === "replace") {
      recordBuilderUndoState();
      duplicateEntry.title = title;
      duplicateEntry.sourcePage = pageNumber;
      duplicateEntry.entryType = tocLevel === 0 ? "section" : "subsection";
      duplicateEntry.tocLevel = tocLevel;
      duplicateEntry.parentId = tocLevel === 0 ? "" : parentId;
      duplicateEntry.detectedTOCEntry = false;
      duplicateEntry.requiresPageBeforeClose = false;
      item.tocEntriesReviewed = true;

      if (existingEntry) {
        promoteTOCChildrenBeforeRemoval(item, existingEntry);
        item.tocEntries = item.tocEntries.filter(entry => entry.id !== existingEntry.id);
      }

      cleanInvalidTOCParents(item);
      item.tocEntries.sort(compareTOCEntries);
      clearTOCEntryForm();
      renderCurrentSubsectionList();
      updateTOCParentDropdown();
      return;
    }
  }

  recordBuilderUndoState();

  if (existingEntry) {
    existingEntry.title = title;
    existingEntry.sourcePage = pageNumber;
    existingEntry.entryType = tocLevel === 0 ? "section" : "subsection";
    existingEntry.tocLevel = tocLevel;
    existingEntry.parentId = tocLevel === 0 ? "" : parentId;
    existingEntry.detectedTOCEntry = false;
    existingEntry.requiresPageBeforeClose = false;
    item.tocEntriesReviewed = true;
    cleanInvalidTOCParents(item);
  } else {
    item.tocEntries.push({
      id: crypto.randomUUID(),
      title,
      sourcePage: pageNumber,
      entryType: tocLevel === 0 ? "section" : "subsection",
      tocLevel,
      parentId: tocLevel === 0 ? "" : parentId,
      requiresPageBeforeClose: false
    });
    item.tocEntriesReviewed = true;
  }

  item.tocEntries.sort(compareTOCEntries);

  clearTOCEntryForm();
  renderCurrentSubsectionList();
  updateTOCParentDropdown();
}

function addTOCEntry() {
  saveTOCEntry();
}

function editSubsectionEntry(entryId) {
  const item = getActiveSubsectionItem();
  const entry = (item?.tocEntries || []).find(candidate => candidate.id === entryId);

  if (!item || !entry) return;

  editingTOCEntryId = entry.id;

  const pageInput = document.getElementById("subsectionPageNumber");
  const titleInput = document.getElementById("subsectionTitle");
  const levelSelect = document.getElementById("tocEntryLevel");
  const actionButton = document.getElementById("tocEntryActionButton");

  if (pageInput) pageInput.value = entry.sourcePage || "";
  if (titleInput) {
    titleInput.value = entry.title || "";
    titleInput.focus();
  }
  if (levelSelect) levelSelect.value = String(Number(entry.tocLevel || 0));
  if (actionButton) actionButton.textContent = "Save TOC Entry";

  updateTOCParentDropdown(entry.parentId || "");
}

function cleanInvalidTOCParents(item) {
  const entries = item.tocEntries || [];
  const validIds = new Set(entries.map(entry => entry.id));

  entries.forEach(entry => {
    const level = Number(entry.tocLevel || 0);

    if (level === 0) {
      entry.parentId = "";
      return;
    }

    const usesVisiblePdfParent =
      level - 1 === getPDFParentTOCLevel(item) &&
      entry.parentId === PDF_PARENT_TOC_ID &&
      !item.hideParentTOC;

    if (usesVisiblePdfParent) return;

    const parent = entries.find(candidate => candidate.id === entry.parentId);
    const expectedParentLevel = level - 1;

    if (!entry.parentId || !validIds.has(entry.parentId) || Number(parent?.tocLevel || 0) !== expectedParentLevel) {
      entry.parentId = "";
    }
  });
}

function promoteTOCChildrenBeforeRemoval(item, removedEntry) {
  if (!item || !removedEntry) return;

  const entries = item.tocEntries || [];
  const childrenByParent = new Map();

  entries.forEach(entry => {
    const parentKey = entry.parentId || "";
    if (!childrenByParent.has(parentKey)) {
      childrenByParent.set(parentKey, []);
    }
    childrenByParent.get(parentKey).push(entry);
  });

  function promoteBranch(parentId, replacementParentId = "") {
    const children = childrenByParent.get(parentId) || [];

    children.forEach(child => {
      const currentLevel = Number(child.tocLevel || 0);
      const promotedLevel = Math.max(0, currentLevel - 1);

      child.tocLevel = promotedLevel;
      child.entryType = promotedLevel === 0 ? "section" : "subsection";
      child.parentId = promotedLevel === 0 ? "" : replacementParentId;

      promoteDescendants(child.id);
    });
  }

  function promoteDescendants(parentId) {
    const children = childrenByParent.get(parentId) || [];

    children.forEach(child => {
      const promotedLevel = Math.max(0, Number(child.tocLevel || 0) - 1);
      child.tocLevel = promotedLevel;
      child.entryType = promotedLevel === 0 ? "section" : "subsection";
      if (promotedLevel === 0) child.parentId = "";
      promoteDescendants(child.id);
    });
  }

  promoteBranch(removedEntry.id, removedEntry.parentId || "");
}

function removeSubsectionEntry(entryId) {
  recordBuilderUndoState();
  const activeId = document.getElementById("activeSubsectionPdfId").value;
  const item = pdfLibrary.find(x => x.id === activeId);
  if (!item) return;

  const removedEntry = (item.tocEntries || []).find(entry => entry.id === entryId);
  promoteTOCChildrenBeforeRemoval(item, removedEntry);
  item.tocEntries = (item.tocEntries || []).filter(entry => entry.id !== entryId);
  item.tocEntriesReviewed = true;
  cleanInvalidTOCParents(item);

  if (editingTOCEntryId === entryId) {
    clearTOCEntryForm();
  }

  renderCurrentSubsectionList();
  updateTOCParentDropdown();
}

function getTOCEntryTreeRows(item) {
  const entries = orderTOCEntriesForDisplay(item.tocEntries || []);
  return entries.map(entry => ({
    entry,
    level: Math.max(0, Math.min(2, Number(entry.tocLevel || 0))),
    parentTitle: getTOCParentTitle(item, entry.parentId)
  }));
}

function getTOCLevelLabel(item, entry, level) {
  return level === 2 ? `${getLevelTwoLetter(item, entry)} Level 2` : `Level ${level}`;
}

function createTOCTreeMetaPill(text, className = "") {
  const pill = document.createElement("span");
  pill.className = `toc-tree-pill ${className}`.trim();
  pill.textContent = text;
  return pill;
}

function renderCurrentSubsectionList() {
  const activeId = document.getElementById("activeSubsectionPdfId").value;
  const list = document.getElementById("currentSubsectionList");

  if (!list) return;

  const item = pdfLibrary.find(x => x.id === activeId);

  if (!item || !item.tocEntries || item.tocEntries.length === 0) {
    list.className = "toc-tree-list";
    list.innerHTML = '<p class="toc-tree-empty">No TOC entries added yet.</p>';
    updateTOCParentDropdown();
    return;
  }

  list.innerHTML = "";
  list.className = "toc-tree-list";

  getTOCEntryTreeRows(item).forEach(({ entry, level, parentTitle }) => {
    const row = document.createElement("div");
    row.className = `toc-tree-row toc-tree-level-${level}`;
    row.dataset.tocEntryId = entry.id;
    if (!hasValidTOCSourcePage(entry)) row.classList.add("toc-tree-row-missing-page");
    if (entry.requiresPageBeforeClose && !hasValidTOCSourcePage(entry)) row.classList.add("toc-tree-row-required");
    row.style.setProperty("--toc-level", String(level));

    const rail = document.createElement("div");
    rail.className = "toc-tree-rail";

    const content = document.createElement("div");
    content.className = "toc-tree-content";

    const header = document.createElement("div");
    header.className = "toc-tree-header";

    const title = document.createElement("strong");
    title.className = "toc-tree-title";
    title.textContent = entry.title || "Untitled TOC entry";

    const levelBadge = document.createElement("span");
    levelBadge.className = "toc-tree-level-badge";
    levelBadge.textContent = getTOCLevelLabel(item, entry, level);

    header.append(title, levelBadge);

    const meta = document.createElement("div");
    meta.className = "toc-tree-meta";
    meta.append(
      createTOCTreeMetaPill(
        hasValidTOCSourcePage(entry) ? `PDF page ${entry.sourcePage}` : (entry.requiresPageBeforeClose ? "Template page required" : "Page required"),
        hasValidTOCSourcePage(entry) ? "" : "toc-entry-missing-page"
      ),
      createTOCTreeMetaPill(level === 0 ? "Top level" : `Under ${parentTitle}`)
    );

    content.append(header, meta);

    const actions = document.createElement("div");
    actions.className = "toc-tree-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editSubsectionEntry(entry.id));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-pdf-btn";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeSubsectionEntry(entry.id));

    actions.append(editButton, removeButton);
    row.append(rail, content, actions);
    list.appendChild(row);
  });
}
