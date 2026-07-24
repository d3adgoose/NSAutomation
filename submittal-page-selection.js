/* Page-selection state transitions shared by the Submittal and O&M builders.
   The selectedManagedPages state and status callbacks are owned by submittal.js. */

function setManagedPageSelection({
  selector,
  selectedClass,
  selectAll,
  updateStatus
}) {
  const pageElements = Array.from(document.querySelectorAll(selector));
  selectedManagedPages = selectAll
    ? new Set(pageElements.map(element => Number(element.dataset.pageNumber)))
    : new Set();

  pageElements.forEach(element => {
    element.classList.toggle(selectedClass, selectAll);
  });

  updateStatus(pageElements.length);
}

function updatePageManagerStatus(totalPages) {
  const status = document.getElementById("pageManagerStatus");
  if (!status) return;

  status.textContent =
    `${selectedManagedPages.size} of ${totalPages} page(s) selected`;
}

function updateSubsectionPageSelectionStatus(totalPages) {
  const status = document.getElementById("subsectionPageSelectionStatus");
  if (!status) return;

  status.textContent =
    `${selectedManagedPages.size} of ${totalPages} page(s) selected for PDF actions`;
}

function selectAllSubsectionPages() {
  setManagedPageSelection({
    selector: ".pdf-page-preview",
    selectedClass: "page-action-selected",
    selectAll: true,
    updateStatus: updateSubsectionPageSelectionStatus
  });
}

function clearSubsectionPageSelection() {
  setManagedPageSelection({
    selector: ".pdf-page-preview",
    selectedClass: "page-action-selected",
    selectAll: false,
    updateStatus: updateSubsectionPageSelectionStatus
  });
}

function selectAllManagedPages() {
  setManagedPageSelection({
    selector: ".page-manager-card",
    selectedClass: "selected",
    selectAll: true,
    updateStatus: updatePageManagerStatus
  });
}

function clearManagedPageSelection() {
  setManagedPageSelection({
    selector: ".page-manager-card",
    selectedClass: "selected",
    selectAll: false,
    updateStatus: updatePageManagerStatus
  });
}
