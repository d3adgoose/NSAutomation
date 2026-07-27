/* --------------------------------------------------------------------------
   Build progress, autosave, local history, and undo/redo
   -------------------------------------------------------------------------- */

function getPacketBuildLabel() {
  return typeof isOMPacket === "function" && isOMPacket()
    ? "O&M manual"
    : "Submittal packet";
}

let packetBuildStartedAt = 0;
let packetBuildTimer = null;
let packetLastBuildMessage = "";
let lastPacketDownloadData = null;

function formatPacketBuildElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function updatePacketBuildElapsed() {
  if (!packetBuildStartedAt) return;
  const elapsedText = formatPacketBuildElapsed(performance.now() - packetBuildStartedAt);
  const mainElapsed = document.getElementById("packetBuildElapsed");
  const previewElapsed = document.getElementById("packetPreviewElapsed");
  if (mainElapsed) mainElapsed.textContent = elapsedText;
  if (previewElapsed) previewElapsed.textContent = `Elapsed ${elapsedText}`;
}

function recordPacketBuildMessage(message) {
  if (!message || message === packetLastBuildMessage) return;
  packetLastBuildMessage = message;
  const elapsedText = packetBuildStartedAt
    ? formatPacketBuildElapsed(performance.now() - packetBuildStartedAt)
    : "ready";
  ["packetBuildHistory", "packetPreviewBuildHistory"].forEach(id => {
    const history = document.getElementById(id);
    if (!history) return;
    const item = document.createElement("li");
    const time = document.createElement("time");
    const text = document.createElement("span");
    time.textContent = elapsedText;
    text.textContent = message;
    item.append(time, text);
    history.appendChild(item);
    while (history.children.length > 40) history.firstElementChild?.remove();
  });
}

function startPacketBuildTimer(message) {
  packetBuildStartedAt = performance.now();
  packetLastBuildMessage = "";
  document.getElementById("packetBuildHistory")?.replaceChildren();
  document.getElementById("packetPreviewBuildHistory")?.replaceChildren();
  document.getElementById("packetBuildProgress")?.classList.remove("hidden");
  clearInterval(packetBuildTimer);
  updatePacketBuildElapsed();
  packetBuildTimer = setInterval(updatePacketBuildElapsed, 250);
  updatePacketBuildStatus(message);
}

function stopPacketBuildTimer() {
  if (!packetBuildStartedAt) return;
  updatePacketBuildElapsed();
  clearInterval(packetBuildTimer);
  packetBuildTimer = null;
  packetBuildStartedAt = 0;
}

function setPacketDownloadRetryAvailable(isAvailable) {
  document.getElementById("retryPacketDownloadButton")?.classList.toggle("hidden", !isAvailable);
}

function requestPacketDownload(pdfBytes, outputName) {
  lastPacketDownloadData = { pdfBytes, outputName };
  setPacketDownloadRetryAvailable(true);

  if (navigator.userActivation && !navigator.userActivation.isActive) {
    updatePacketBuildStatus(
      "Download warning: browser click permission was no longer active. Use Retry download if the file does not appear."
    );
  }

  try {
    downloadFile(pdfBytes, outputName, "application/pdf");
    updatePacketBuildStatus(
      `Download requested: ${outputName}. If it does not appear, use Retry download.`
    );
  } catch (error) {
    const message = `Download failed to start: ${error?.message || "Browser download error."}`;
    console.error(message, error);
    updatePacketBuildStatus(message);
    throw new Error(message);
  }
}

function retryLastPacketDownload() {
  if (!lastPacketDownloadData) {
    updatePacketBuildStatus("No completed PDF is available to retry.");
    return;
  }

  try {
    downloadFile(
      lastPacketDownloadData.pdfBytes,
      lastPacketDownloadData.outputName,
      "application/pdf"
    );
    updatePacketBuildStatus(
      `Download requested again: ${lastPacketDownloadData.outputName}. Check the browser downloads list.`
    );
  } catch (error) {
    const message = `Retry failed: ${error?.message || "Browser download error."}`;
    console.error(message, error);
    updatePacketBuildStatus(message);
    showMessageModal("Download Failed", `${message} Check browser download permissions for this site.`);
  }
}

function updatePacketBuildStatus(message = "") {
  const status = document.getElementById("packetBuildStatus");
  if (!status) return;

  status.textContent = message || "";
  document.getElementById("packetBuildProgress")?.classList.toggle(
    "hidden",
    !message && !packetBuildStartedAt
  );
  recordPacketBuildMessage(message);
}

function getBuildErrorMessage(buildLabel, error, context = "") {
  const reason = error?.message || "Please try again.";
  return context
    ? `${buildLabel} could not be built while ${context}. ${reason}`
    : `${buildLabel} could not be built. ${reason}`;
}

const PACKET_HISTORY_DB_NAME = "ns-packet-history";
const PACKET_HISTORY_STORE_NAME = "packets";
const PACKET_HISTORY_LIMIT = 5;
const PACKET_STORAGE_WARNING_PERCENT = 85;
const PACKET_DRAFT_AUTOSAVE_DELAY = 900;
let packetDraftAutosaveTimer = null;
let packetDraftReady = false;
let packetDraftSavePromise = Promise.resolve();
let packetLargeBuildConfirmed = false;

function getPacketDraftId() {
  return `draft-${getPacketHistoryType()}`;
}

function getPacketDraftFormState() {
  const fields = {};
  document.querySelectorAll("input[id], select[id], textarea[id]").forEach(field => {
    if (field.type === "file" || field.id.startsWith("appPrompt")) return;
    fields[field.id] = field.type === "checkbox" || field.type === "radio"
      ? { checked: field.checked, value: field.value }
      : { value: field.value };
  });
  return fields;
}

function applyPacketDraftFormState(fields = {}) {
  Object.entries(fields).forEach(([id, state]) => {
    const field = document.getElementById(id);
    if (!field || field.type === "file") return;
    if (field.type === "checkbox" || field.type === "radio") {
      field.checked = !!state.checked;
    } else {
      field.value = state.value ?? "";
    }
  });
}

function setPacketDraftStatus(message, className = "") {
  const status = document.getElementById("draftSaveStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `draft-save-status${className ? ` ${className}` : ""}`;
}

async function savePacketDraft({ manual = false } = {}) {
  if (!packetDraftReady && !manual) return;
  clearTimeout(packetDraftAutosaveTimer);
  const snapshot = getLivePacketBuilderSnapshot();
  const entry = {
    id: getPacketDraftId(),
    type: `draft-${getPacketHistoryType()}`,
    updatedAt: Date.now(),
    builderState: snapshot,
    formFields: getPacketDraftFormState()
  };

  setPacketDraftStatus(manual ? "Saving progress..." : "Autosaving...", "is-saving");
  packetDraftSavePromise = packetDraftSavePromise.catch(() => {}).then(() =>
    runPacketHistoryTransaction("readwrite", store => store.put(entry))
  );

  try {
    await packetDraftSavePromise;
    const time = new Date(entry.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setPacketDraftStatus(`${manual ? "Progress saved" : "Autosaved"} at ${time}.`, "is-saved");
  } catch (error) {
    console.warn("Could not save packet draft:", error);
    const storageFull = error?.name === "QuotaExceededError" || /quota|storage|space/i.test(error?.message || "");
    setPacketDraftStatus(
      storageFull
        ? "Browser storage is full. Clear local history, then try Save Progress again."
        : "Progress could not be saved. Try Save Progress again.",
      "is-error"
    );
    updatePacketStorageStatus();
  }
}

function schedulePacketDraftAutosave() {
  if (!packetDraftReady) return;
  clearTimeout(packetDraftAutosaveTimer);
  packetDraftAutosaveTimer = setTimeout(() => savePacketDraft(), PACKET_DRAFT_AUTOSAVE_DELAY);
}

async function restorePacketDraft() {
  try {
    const draft = await getPacketHistoryItem(getPacketDraftId());
    if (!draft?.builderState) return;
    applyPacketBuilderSnapshot(draft.builderState);
    applyPacketDraftFormState(draft.formFields);
    renderUploadedPdfList();
    const time = new Date(draft.updatedAt || draft.builderState.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setPacketDraftStatus(`Saved progress restored from ${time}. Autosave is on.`, "is-saved");
  } catch (error) {
    console.warn("Could not restore packet draft:", error);
    setPacketDraftStatus("Autosave is unavailable in this browser.", "is-error");
  }
}

function setupPacketDraftAutosave() {
  packetDraftReady = true;
  document.addEventListener("input", schedulePacketDraftAutosave);
  document.addEventListener("change", schedulePacketDraftAutosave);

  // Builder actions can change PDFs and TOC data without changing a form field.
  window.setInterval(schedulePacketDraftAutosave, 5000);

  document.querySelectorAll("#sideMenu a").forEach(link => {
    link.addEventListener("click", async event => {
      if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      await savePacketDraft();
      window.location.href = link.href;
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") savePacketDraft();
  });
}

function getPacketHistoryType() {
  return typeof isOMPacket === "function" && isOMPacket()
    ? "om"
    : "submittal";
}

function getPacketHistoryTitle() {
  return getPacketHistoryType() === "om"
    ? "O&M manual"
    : "submittal";
}

function getPacketHistoryStatusElement() {
  return document.getElementById("packetHistoryStatus");
}

function updatePacketHistoryStatus(message = "") {
  const status = getPacketHistoryStatusElement();
  if (status) status.textContent = message;
}

function formatPacketStorageBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function getPacketHistoryEntrySize(entry) {
  const outputSize = Number(entry?.blob?.size || 0);
  const sourceSize = (entry?.builderState?.pdfLibrary || []).reduce(
    (total, item) => total + Number(item?.file?.size || 0),
    0
  );
  return outputSize + sourceSize;
}

async function makeRoomForPacketHistoryEntry(entry) {
  if (!navigator.storage?.estimate) return;

  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  if (!quota) return;

  const maximumUsage = quota * (PACKET_STORAGE_WARNING_PERCENT / 100);
  let projectedUsage = usage + getPacketHistoryEntrySize(entry);
  if (projectedUsage <= maximumUsage) return;

  const savedItems = (
    await Promise.all(["om", "submittal"].map(type => getPacketHistoryItems(type)))
  )
    .flat()
    .sort((a, b) => b.createdAt - a.createdAt);
  while (projectedUsage > maximumUsage && savedItems.length > 0) {
    const oldestItem = savedItems.pop();
    await runPacketHistoryTransaction("readwrite", store => {
      store.delete(oldestItem.id);
    });
    projectedUsage = Math.max(0, projectedUsage - getPacketHistoryEntrySize(oldestItem));
  }
}

async function warnIfPacketStorageHigh() {
  if (!navigator.storage?.estimate) return;

  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  if (!quota) return;

  const percent = (usage / quota) * 100;
  if (percent < PACKET_STORAGE_WARNING_PERCENT) return;

  await showMessageModal(
    "Browser Storage Warning",
    `Local storage is ${percent.toFixed(1)}% full. The app will remove the oldest O&M or submittal history as needed, but your current draft will be kept. Download any saved versions you need and remove unused history.`
  );
}

async function updatePacketStorageStatus() {
  const usageCard = document.getElementById("packetStorageUsage");
  if (!usageCard) return;
  const label = usageCard.querySelector(".storage-usage-label span");
  const bar = usageCard.querySelector(".storage-usage-bar span");
  const detail = usageCard.querySelector("p");
  usageCard.classList.remove("warning", "danger");

  if (!navigator.storage?.estimate) {
    if (label) label.textContent = "Usage unavailable";
    if (bar) bar.style.width = "0%";
    if (detail) detail.textContent = "This browser does not report local storage capacity.";
    return;
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const percent = quota ? Math.min(100, (usage / quota) * 100) : 0;
    if (label) label.textContent = quota
      ? `${formatPacketStorageBytes(usage)} of ${formatPacketStorageBytes(quota)} used`
      : `${formatPacketStorageBytes(usage)} used`;
    if (bar) bar.style.width = `${percent.toFixed(1)}%`;
    if (detail) detail.textContent = quota
      ? `Local drafts and history - ${percent.toFixed(1)}% used${percent >= 80 ? " - storage is running low" : ""}`
      : "Local drafts and history";
    usageCard.classList.toggle("warning", percent >= 75 && percent < 90);
    usageCard.classList.toggle("danger", percent >= 90);
  } catch (error) {
    if (label) label.textContent = "Usage unavailable";
    if (bar) bar.style.width = "0%";
    if (detail) detail.textContent = "Could not calculate local drafts and history storage.";
  }
}

function openPacketHistoryDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Local browser history is not supported in this browser."));
      return;
    }

    const request = indexedDB.open(PACKET_HISTORY_DB_NAME, 1);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(PACKET_HISTORY_STORE_NAME)) {
        const store = db.createObjectStore(PACKET_HISTORY_STORE_NAME, {
          keyPath: "id"
        });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local history."));
  });
}

function runPacketHistoryTransaction(mode, callback) {
  return openPacketHistoryDB().then(db =>
    new Promise((resolve, reject) => {
      const transaction = db.transaction(PACKET_HISTORY_STORE_NAME, mode);
      const store = transaction.objectStore(PACKET_HISTORY_STORE_NAME);
      const result = callback(store);

      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("Local history update failed."));
      };
    })
  );
}

async function getPacketHistoryItems(type = getPacketHistoryType()) {

  const items = await runPacketHistoryTransaction("readonly", store =>
    new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    })
  );

  return items
    .filter(item => item.type === type)
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function getPacketHistoryItem(id) {
  return runPacketHistoryTransaction("readonly", store =>
    new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    })
  );
}

function getPacketBuilderState(includedCount = 0) {
  const fieldIds = [
    "projectNumber",
    "projectName",
    "projectLocation",
    "projectAddress",
    "washType",
    "systemName",
    "revision"
  ];
  const fields = {};

  fieldIds.forEach(id => {
    const field = document.getElementById(id);
    if (field) fields[id] = field.value || "";
  });

  return {
    version: 1,
    savedAt: Date.now(),
    includedCount,
    fields,
    customSectionLabels: { ...customSectionLabels },
    pdfLibrary: pdfLibrary.map(item => ({
      ...item,
      file: item.file || null
    }))
  };
}

function cloneBuilderHistoryItem(item) {
  return {
    ...item,
    file: item.file || null,
    tocEntries: (item.tocEntries || []).map(entry => ({ ...entry }))
  };
}

function getLivePacketBuilderSnapshot() {
  const snapshot = getPacketBuilderState(pdfLibrary.filter(item => item.include !== false).length);
  snapshot.pdfLibrary = pdfLibrary.map(cloneBuilderHistoryItem);
  snapshot.pageNumberMode = getPageNumberMode();
  return snapshot;
}

function areBuilderSnapshotsEqual(a, b) {
  if (!a || !b) return false;
  const stripFiles = snapshot => JSON.stringify({
    fields: snapshot.fields || {},
    pageNumberMode: snapshot.pageNumberMode || "normal",
    customSectionLabels: snapshot.customSectionLabels || {},
    pdfLibrary: (snapshot.pdfLibrary || []).map(item => ({
      ...item,
      file: item.file ? "[file]" : null,
      tocEntries: (item.tocEntries || []).map(entry => ({ ...entry }))
    }))
  });
  return stripFiles(a) === stripFiles(b);
}

function updateBuilderHistoryControls() {
  const undoButton = document.getElementById("builderUndoButton");
  const redoButton = document.getElementById("builderRedoButton");
  const status = document.getElementById("builderHistoryStatus");

  if (undoButton) undoButton.disabled = builderUndoStack.length === 0;
  if (redoButton) redoButton.disabled = builderRedoStack.length === 0;
  if (status) {
    status.textContent = builderUndoStack.length || builderRedoStack.length
      ? `${builderUndoStack.length} undo / ${builderRedoStack.length} redo`
      : "";
  }
}

function recordBuilderUndoState() {
  const snapshot = getLivePacketBuilderSnapshot();
  const last = builderUndoStack[builderUndoStack.length - 1];
  if (areBuilderSnapshotsEqual(snapshot, last)) return;

  builderUndoStack.push(snapshot);
  if (builderUndoStack.length > BUILDER_HISTORY_LIMIT) builderUndoStack.shift();
  builderRedoStack.length = 0;
  updateBuilderHistoryControls();
}

function applyPacketBuilderSnapshot(snapshot) {
  if (!snapshot) return;

  pdfLibrary = (snapshot.pdfLibrary || []).map(item => ({
    ...item,
    id: item.id || crypto.randomUUID(),
    file: restoreFileFromHistory(item),
    tocEntries: (item.tocEntries || []).map(entry => ({ ...entry })),
    tocEntriesReviewed: !!item.tocEntriesReviewed,
    include: item.include !== false,
    hideParentTOC: !!item.hideParentTOC
  }));

  customSectionLabels = { ...(snapshot.customSectionLabels || {}) };
  pendingBuild = false;
  finalBuildPreviewAccepted = false;
  finalBuildPreviewCache = null;
  warrantyPromptHandled = false;
  selectedManagedPages = new Set();

  Object.entries(snapshot.fields || {}).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value || "";
  });

  const mode = snapshot.pageNumberMode || "normal";
  const modeInput = document.querySelector(`input[name="pageNumberMode"][value="${mode}"]`);
  if (modeInput) modeInput.checked = true;

  const activeId = document.getElementById("activeSubsectionPdfId")?.value;
  renderUploadedPdfList();
  if (activeId && pdfLibrary.some(item => item.id === activeId)) {
    renderCurrentSubsectionList();
    updateTOCParentDropdown();
  }
  updatePacketBuildStatus("Change restored. Review the builder before building.");
}

function undoBuilderAction() {
  if (builderUndoStack.length === 0) return;
  const current = getLivePacketBuilderSnapshot();
  const previous = builderUndoStack.pop();
  builderRedoStack.push(current);
  applyPacketBuilderSnapshot(previous);
  updateBuilderHistoryControls();
}

function redoBuilderAction() {
  if (builderRedoStack.length === 0) return;
  const current = getLivePacketBuilderSnapshot();
  const next = builderRedoStack.pop();
  builderUndoStack.push(current);
  applyPacketBuilderSnapshot(next);
  updateBuilderHistoryControls();
}

function resetBuilderHistory() {
  builderUndoStack.length = 0;
  builderRedoStack.length = 0;
  builderHistoryFieldSnapshots = new Map();
  updateBuilderHistoryControls();
}

function setupBuilderHistoryControls() {
  const fieldIds = [
    "projectNumber",
    "projectName",
    "projectLocation",
    "projectAddress",
    "washType",
    "systemName",
    "revision"
  ];

  fieldIds.forEach(id => {
    const field = document.getElementById(id);
    if (!field) return;

    const capture = () => builderHistoryFieldSnapshots.set(id, getLivePacketBuilderSnapshot());
    const commit = () => {
      const before = builderHistoryFieldSnapshots.get(id);
      const after = getLivePacketBuilderSnapshot();
      if (before && !areBuilderSnapshotsEqual(before, after)) {
        builderUndoStack.push(before);
        if (builderUndoStack.length > BUILDER_HISTORY_LIMIT) builderUndoStack.shift();
        builderRedoStack.length = 0;
        updateBuilderHistoryControls();
      }
      builderHistoryFieldSnapshots.delete(id);
    };

    field.addEventListener("focus", capture);
    field.addEventListener("change", commit);
    field.addEventListener("blur", commit);
  });

  document.querySelectorAll('input[name="pageNumberMode"]').forEach(input => {
    const capturePageMode = () => builderHistoryFieldSnapshots.set("pageNumberMode", getLivePacketBuilderSnapshot());
    input.addEventListener("focus", capturePageMode);
    input.addEventListener("pointerdown", capturePageMode);
    input.addEventListener("keydown", capturePageMode);
    input.addEventListener("change", () => {
      const before = builderHistoryFieldSnapshots.get("pageNumberMode") || getLivePacketBuilderSnapshot();
      builderUndoStack.push(before);
      if (builderUndoStack.length > BUILDER_HISTORY_LIMIT) builderUndoStack.shift();
      builderRedoStack.length = 0;
      builderHistoryFieldSnapshots.delete("pageNumberMode");
      updateBuilderHistoryControls();
    });
  });

  updateBuilderHistoryControls();
}

function hasActivePacketBuilderState() {
  const hasFiles = pdfLibrary.length > 0;
  const hasFields = [
    "projectNumber",
    "projectName",
    "projectLocation",
    "projectAddress",
    "systemName",
    "revision"
  ].some(id => {
    const field = document.getElementById(id);
    return field && field.value.trim();
  });

  return hasFiles || hasFields;
}

function restoreFileFromHistory(item) {
  if (!item?.file) return null;

  if (item.file instanceof File) return item.file;

  const fileName = item.fileName || item.file?.name || "history-file.pdf";
  const fileType = item.file?.type || "application/pdf";
  const lastModified = item.file?.lastModified || Date.now();

  return new File([item.file], fileName, {
    type: fileType,
    lastModified
  });
}

async function restorePacketBuilderState(builderState) {
  if (!builderState || !Array.isArray(builderState.pdfLibrary)) {
    throw new Error("This history item does not include editable source files.");
  }

  pdfLibrary = builderState.pdfLibrary.map(item => {
  const detectionName = item.displayTitle || item.fileName || "";

  return {
    ...item,
    id: item.id || crypto.randomUUID(),
    file: restoreFileFromHistory(item),
    documentType: guessDocumentType(detectionName),
    packetSection: guessPacketSection(detectionName),
    tocEntries: Array.isArray(item.tocEntries) ? item.tocEntries : [],
    tocEntriesReviewed: !!item.tocEntriesReviewed,
    include: item.include !== false,
    hideParentTOC: !!item.hideParentTOC
  };
});

  customSectionLabels = { ...(builderState.customSectionLabels || {}) };
  pendingBuild = false;
  finalBuildPreviewAccepted = false;
  finalBuildPreviewCache = null;
  warrantyPromptHandled = false;
  selectedManagedPages = new Set();

  Object.entries(builderState.fields || {}).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value || "";
  });

  const pdfUpload = document.getElementById("pdfUpload");
  if (pdfUpload) pdfUpload.value = "";

  [
    "warrantyPromptModal",
    "datasheetOrderModal",
    "finalBuildPreviewModal",
    "subsectionModal",
    "pageManagerModal"
  ].forEach(id => {
    document.getElementById(id)?.classList.add("hidden");
  });

  sortLibraryBySection();
  renderUploadedPdfList();
  updatePacketBuildStatus("History restored. You can edit and build again.");
}

async function savePacketHistoryEntry({ pdfBytes, fileName, includedCount }) {
  const type = getPacketHistoryType();
  const entry = {
    id: crypto.randomUUID(),
    type,
    fileName,
    projectNumber: document.getElementById("projectNumber")?.value || "",
    projectName: document.getElementById("projectName")?.value || "",
    revision: document.getElementById("revision")?.value || "",
    includedCount,
    createdAt: Date.now(),
    blob: new Blob([pdfBytes], { type: "application/pdf" }),
    builderState: getPacketBuilderState(includedCount)
  };

  await makeRoomForPacketHistoryEntry(entry);

  while (true) {
    try {
      await runPacketHistoryTransaction("readwrite", store => {
        store.put(entry);
      });
      break;
    } catch (error) {
      const storageFull =
        error?.name === "QuotaExceededError" ||
        /quota|storage|space/i.test(error?.message || "");

      if (!storageFull) throw error;

      const savedItems = await getPacketHistoryItems(type);
      const oldestItem = savedItems[savedItems.length - 1];
      if (!oldestItem) throw error;

      await runPacketHistoryTransaction("readwrite", store => {
        store.delete(oldestItem.id);
      });
    }
  }

  const items = await getPacketHistoryItems(type);
  const oldItems = items.slice(PACKET_HISTORY_LIMIT);

  if (oldItems.length > 0) {
    await runPacketHistoryTransaction("readwrite", store => {
      oldItems.forEach(item => store.delete(item.id));
    });
  }

  await renderPacketHistory();
  await warnIfPacketStorageHigh();
}

async function renderPacketHistory() {
  const list = document.getElementById("packetHistoryList");
  if (!list) return;

  list.innerHTML = "";
  updatePacketHistoryStatus("Loading local history...");
  updatePacketStorageStatus();

  try {
    const historyType = typeof isOMPacket === "function" && isOMPacket() && window.omPacketHistoryViewType
      ? window.omPacketHistoryViewType
      : getPacketHistoryType();
    const items = await getPacketHistoryItems(historyType);
    const label = historyType === "om" ? "O&M manual" : "submittal";
    const isSubmittalViewInOM = getPacketHistoryType() === "om" && historyType === "submittal";

    const heading = document.getElementById("packetHistoryHeading");
    const intro = document.getElementById("packetHistoryIntro");
    const toggle = document.getElementById("submittalHistoryToggle");
    if (heading) heading.textContent = isSubmittalViewInOM ? "Submittal History" : "Local History";
    if (intro) intro.textContent = isSubmittalViewInOM
      ? "Last 3 submittals built on this device. Edit one to load its packet-builder work into O&M."
      : "Last 3 O&M manuals built on this device.";
    if (toggle) toggle.textContent = isSubmittalViewInOM ? "O&M History" : "Submittal History";

    if (items.length === 0) {
      updatePacketHistoryStatus(`No local ${label} history yet.`);
      return;
    }

    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "packet-history-row";

      const createdAt = new Date(item.createdAt).toLocaleString();
      const meta = [
        item.projectNumber,
        item.projectName,
        item.revision ? `Rev ${item.revision}` : "",
        item.includedCount ? `${item.includedCount} PDF(s)` : ""
      ].filter(Boolean).join(" | ");

      row.innerHTML = `
        <div class="packet-history-info">
          <strong>${item.fileName}</strong>
          <span>${createdAt}</span>
          <span>${meta || "No project details saved."}</span>
        </div>

        <div class="button-row packet-history-actions">
          <button onclick="editPacketHistoryEntry('${item.id}')">Edit</button>
          <button onclick="downloadPacketHistoryEntry('${item.id}')">Download</button>
          <button onclick="renamePacketHistoryEntry('${item.id}')">Rename</button>
          <button class="delete-btn" onclick="removePacketHistoryEntry('${item.id}')">Remove</button>
        </div>
      `;

      list.appendChild(row);
    });

    updatePacketHistoryStatus(`Showing ${items.length} saved ${label}(s).`);
  } catch (error) {
    console.error("Could not render packet history:", error);
    updatePacketHistoryStatus(error.message || "Could not load local history.");
  }
}

async function clearCurrentPacketHistory() {
  const historyType = typeof isOMPacket === "function" && isOMPacket() && window.omPacketHistoryViewType
    ? window.omPacketHistoryViewType
    : getPacketHistoryType();
  const label = historyType === "om" ? "O&M" : "Submittal";
  if (!(await showConfirmModal("Clear Local History", `Remove all saved ${label} history from this browser? Your current draft will be kept.`, "Clear History"))) return;
  await runPacketHistoryTransaction("readwrite", store => {
    const request = store.getAll();
    request.onsuccess = () => (request.result || [])
      .filter(item => item.type === historyType)
      .forEach(item => store.delete(item.id));
  });
  await renderPacketHistory();
  updatePacketHistoryStatus(`${label} history cleared.`);
}

async function getPacketBuildPreflight(included) {
  let totalPages = 0;
  let totalBytes = 0;
  for (const item of included) {
    totalBytes += Number(item.file?.size || 0);
    if (Number.isFinite(Number(item.pageCount)) && Number(item.pageCount) > 0) {
      totalPages += Number(item.pageCount);
      continue;
    }
    try {
      const bytes = await getSourcePDFBytes(item.file);
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      item.pageCount = pdf.getPageCount();
      totalPages += item.pageCount;
    } catch (error) {
      console.warn("Could not count pages for build preflight:", item.fileName, error);
    }
  }
  return { totalPages, totalBytes, fileCount: included.length };
}

function toggleOMSubmittalHistory() {
  if (getPacketHistoryType() !== "om") return;
  window.omPacketHistoryViewType = window.omPacketHistoryViewType === "submittal"
    ? "om"
    : "submittal";
  renderPacketHistory();
}

async function downloadPacketHistoryEntry(id) {
  try {
    const item = await getPacketHistoryItem(id);

    if (!item || !item.blob) {
      await showMessageModal("Saved PDF Not Found", "This saved PDF was not found.");
      await renderPacketHistory();
      return;
    }

    downloadFile(item.blob, item.fileName || "packet-history.pdf", "application/pdf");
    updatePacketHistoryStatus(`Downloaded ${item.fileName}.`);
  } catch (error) {
    console.error("Could not download packet history item:", error);
    await showMessageModal("Download Failed", "Could not download this saved PDF.");
  }
}

async function editPacketHistoryEntry(id) {
  try {
    const item = await getPacketHistoryItem(id);

    if (!item?.builderState) {
      await showMessageModal("Editable History Unavailable", "This saved PDF was created before editable history was added. Build it once more to save an editable version.");
      return;
    }

    if (
      hasActivePacketBuilderState() &&
      !(await showConfirmModal("Replace Current Builder", "Replace the current builder with this saved history item?", "Replace"))
    ) {
      return;
    }

    await restorePacketBuilderState(item.builderState);
    updatePacketHistoryStatus(`Loaded ${item.fileName} for editing.`);

    document.getElementById("dropZone")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    console.error("Could not edit packet history item:", error);
    await showMessageModal("History Load Failed", error.message || "Could not load this history item for editing.");
  }
}

async function renamePacketHistoryEntry(id) {
  try {
    const item = await getPacketHistoryItem(id);
    if (!item) return;

    let newName = await showTextModal({
      title: "Rename Saved PDF",
      message: "Rename saved PDF.",
      label: "PDF name",
      value: item.fileName || "",
      confirmLabel: "Save"
    });
    if (newName === null) return;

    newName = newName.trim();
    if (!newName) {
      await showMessageModal("Name Required", "History name cannot be blank.");
      return;
    }

    if (!newName.toLowerCase().endsWith(".pdf")) {
      newName += ".pdf";
    }

    item.fileName = newName;

    await runPacketHistoryTransaction("readwrite", store => {
      store.put(item);
    });

    await renderPacketHistory();
    updatePacketHistoryStatus(`Renamed saved PDF to ${newName}.`);
  } catch (error) {
    console.error("Could not rename packet history item:", error);
    await showMessageModal("Rename Failed", "Could not rename this saved PDF.");
  }
}

async function removePacketHistoryEntry(id) {
  const item = await getPacketHistoryItem(id);
  const name = item?.fileName || "this saved PDF";

  if (!(await showConfirmModal("Remove Saved PDF", `Remove ${name} from local history?`, "Remove"))) return;

  try {
    await runPacketHistoryTransaction("readwrite", store => {
      store.delete(id);
    });

    await renderPacketHistory();
    updatePacketHistoryStatus(`Removed ${name} from local history.`);
  } catch (error) {
    console.error("Could not remove packet history item:", error);
    await showMessageModal("Remove Failed", "Could not remove this saved PDF.");
  }
}
