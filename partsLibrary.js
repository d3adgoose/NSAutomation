const PARTS_STORAGE_KEY = "nsPartsDatabaseV1";
const PARTS_TABLES = {
  master: "parts_master",
  aliases: "part_number_aliases",
  usage: "drawing_usage",
  reviews: "part_match_reviews",
  history: "parts_import_history"
};
const PARTS_DOCUMENTS_BUCKET = "document-library";
const PARTS_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
const DESCRIPTION_MATCH_THRESHOLD = 0.9;
let partsRemoteStorageAvailable = true;
let partsCurrentUser = null;
let partsLoginRequired = true;
let partsStorageUsageCheckedAt = 0;
let partsStorageUsageChecking = false;
let partsMessageResolver = null;
const partsUndoStack = [];
const partsRedoStack = [];
const PARTS_HISTORY_LIMIT = 20;
const PARTS_RETRY_QUEUE_KEY = "ns_parts_retry_queue_v1";
const PARTS_HEALTH_EXCEPTIONS_KEY = "ns_parts_health_exceptions_v1";
let partsRetryInProgress = false;

let partsState = {
  master: [],
  aliases: [],
  usage: [],
  reviews: [],
  history: [],
  activeTab: "master",
  sort: { key: "current_part_number", direction: "asc" },
  page: 1,
  pageSize: 10,
  previewRows: [],
  previewType: "",
  previewFileName: "",
  cancelImport: false,
  isProcessing: false,
  editTarget: null,
  selected: {}
};

document.addEventListener("DOMContentLoaded", initPartsDatabase);

async function initPartsDatabase() {
  bindPartsDatabaseEvents();
  initializePartsSaveIndicator();
  registerPartsGhostAutocompleteSource();
  await checkPartsLogin();
  await loadPartsDatabase();
  applyPendingPartsChangesToState();
  const duplicateCleanup = deduplicatePartsDatabase();
  if (duplicateCleanup.removedCount || duplicateCleanup.changedCount) {
    saveLocalPartsDatabase();
    await persistPartsDuplicateCleanup(duplicateCleanup);
  }
  const reopenedReviews = reconcilePreviouslyAcceptedReviews();
  const autoResolved = autoResolveReviewsFromSavedNumbers();
  renderPartsDatabase();
  const reconciledReviews = [...new Map(
    [...reopenedReviews, ...autoResolved.reviews].map(row => [row.id, row])
  ).values()];
  if (reconciledReviews.length || autoResolved.usage.length) {
    saveLocalPartsDatabase();
    await persistPartsChanges({ master: [], aliases: [], usage: autoResolved.usage, reviews: reconciledReviews, history: [] });
    const messages = [];
    if (reopenedReviews.length) messages.push(`${reopenedReviews.length} incomplete prior review${reopenedReviews.length === 1 ? " was" : "s were"} returned to Items to Check`);
    if (autoResolved.reviews.length) messages.push(`${autoResolved.reviews.length} repeated review${autoResolved.reviews.length === 1 ? " was" : "s were"} resolved from saved part-number decisions`);
    setPartsStatus(`${messages.join("; ")}.`);
    renderPartsDatabase();
  }
  await retryPendingPartsChanges({ silent: true });
}

function reconcilePreviouslyAcceptedReviews() {
  const reopened = [];
  const updatedAt = nowISO();

  partsState.reviews.forEach(review => {
    if (review.status !== "accepted") return;
    const extractedKey = getPartNumberKey(review.extracted_part_number);
    const suggestedKey = getPartNumberKey(review.suggested_current_part_number);
    const hasExtractedCurrentPart = partsState.master.some(part =>
      getPartNumberKey(part.current_part_number) === extractedKey
    );
    const hasSavedOldNumber = partsState.aliases.some(alias =>
      getPartNumberKey(alias.old_part_number) === extractedKey &&
      (!suggestedKey || getPartNumberKey(alias.current_part_number) === suggestedKey)
    );
    const isSameNumberSuggestion = extractedKey && suggestedKey && extractedKey === suggestedKey &&
      partsState.master.some(part => getPartNumberKey(part.current_part_number) === suggestedKey);

    const hasAllowedExtractedCurrentPart = hasExtractedCurrentPart && !isOldPartNumberCandidate(review.extracted_part_number);
    if (hasAllowedExtractedCurrentPart || hasSavedOldNumber || isSameNumberSuggestion) return;
    review.status = "needs_review";
    review.updated_at = updatedAt;
    reopened.push(review);
  });

  return reopened;
}

function autoResolveReviewsFromSavedNumbers() {
  const resolvedReviews = [];
  const changedUsage = new Map();
  const updatedAt = nowISO();

  partsState.reviews.forEach(review => {
    if (["accepted", "ignored"].includes(review.status)) return;
    const extractedKey = getPartNumberKey(review.extracted_part_number);
    if (!extractedKey) return;

    let part = partsState.master.find(row => getPartNumberKey(row.current_part_number) === extractedKey) || null;
    let knownUnlinkedOldNumber = false;
    if (!part) {
      const alias = partsState.aliases.find(row =>
        getPartNumberKey(row.old_part_number) === extractedKey
      );
      if (alias?.current_part_number) part = findMasterPartByNumber(alias.current_part_number);
      else if (alias) knownUnlinkedOldNumber = true;
    }
    if (!part && !knownUnlinkedOldNumber) return;

    review.status = "accepted";
    review.updated_at = updatedAt;
    resolvedReviews.push(review);
    if (part) linkReviewUsageToPart(review, part).forEach(row => changedUsage.set(row.id, row));
  });

  return { reviews: resolvedReviews, usage: [...changedUsage.values()] };
}

function bindPartsDatabaseEvents() {
  document.getElementById("partsSearchInput")?.addEventListener("input", () => {
    resetPartsPage();
    renderPartsDatabase();
  });
  document.getElementById("partsSourceFilter")?.addEventListener("change", () => {
    resetPartsPage();
    renderPartsDatabase();
  });
  document.getElementById("partsSortSelect")?.addEventListener("change", event => setPartsSortFromValue(event.target.value));
  document.querySelectorAll("[data-parts-tab]").forEach(button => {
    button.addEventListener("click", () => setPartsActiveTab(button.dataset.partsTab));
  });
  document.getElementById("partsClearFiltersButton")?.addEventListener("click", clearPartsFilters);
  document.getElementById("partsHealthCheckButton")?.addEventListener("click", openPartsHealthReport);
  document.getElementById("partsHealthCloseButton")?.addEventListener("click", closePartsHealthReport);
  document.getElementById("partsRetrySaveButton")?.addEventListener("click", () => retryPendingPartsChanges());
  document.getElementById("partsExportButton")?.addEventListener("click", () => {
    if (ensurePartsUnlocked()) exportPartsDatabase();
  });
  document.getElementById("partsUndoButton")?.addEventListener("click", undoPartsAction);
  document.getElementById("partsRedoButton")?.addEventListener("click", redoPartsAction);
  document.getElementById("partsAddManualButton")?.addEventListener("click", () => {
    if (ensurePartsUnlocked()) openPartsEditModal("master");
  });
  document.getElementById("partsDrawingInput")?.addEventListener("change", event => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length) handlePartsDrawingFiles(files);
  });
  document.getElementById("partsExcelInput")?.addEventListener("change", event => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length) handlePartsExcelFiles(files);
  });
  bindPartsDropZone("partsDrawingDropZone", handlePartsDrawingFiles, file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  bindPartsDropZone("partsExcelDropZone", handlePartsExcelFiles, file => /\.(xlsx|xls|csv)$/i.test(file.name));
  document.getElementById("partsClosePreviewButton")?.addEventListener("click", closePartsPreview);
  document.getElementById("partsCancelImportButton")?.addEventListener("click", cancelPartsPreviewProcessing);
  document.getElementById("partsSaveImportButton")?.addEventListener("click", savePartsImportPreview);
  document.getElementById("partsSelectAllButton")?.addEventListener("click", togglePreviewSelection);
  document.getElementById("partsEditCloseButton")?.addEventListener("click", closePartsEditModal);
  document.getElementById("partsEditSaveButton")?.addEventListener("click", savePartsEditModal);
  document.getElementById("partsEditDestination")?.addEventListener("change", event => changePartsEditDestination(event.target.value));
  document.getElementById("partsSelectVisibleButton")?.addEventListener("click", toggleVisiblePartsSelection);
  document.getElementById("partsDeleteSelectedButton")?.addEventListener("click", deleteSelectedPartsRecords);
  document.getElementById("partsMessageCancelButton")?.addEventListener("click", () => closePartsMessage(false));
  document.getElementById("partsMessageConfirmButton")?.addEventListener("click", () => closePartsMessage(true));
  document.getElementById("partsSyncLocalButton")?.addEventListener("click", syncLocalPartsCopyToShared);
  document.getElementById("partsClearLocalButton")?.addEventListener("click", clearLocalPartsCopy);
  document.getElementById("partsEditFields")?.addEventListener("input", markPartsUnsaved);
  document.getElementById("partsEditDestination")?.addEventListener("change", markPartsUnsaved);
  window.addEventListener("online", () => retryPendingPartsChanges({ silent: true }));
}

function registerPartsGhostAutocompleteSource() {
  if (typeof window.registerGhostAutocompleteSource !== "function") return;
  window.registerGhostAutocompleteSource(() => getPartsGhostAutocompleteSuggestions());
}

function getPartsGhostAutocompleteSuggestions() {
  const values = [];
  const addValue = value => {
    const clean = String(value || "").trim();
    if (clean) values.push(clean);
  };
  const addMultiline = value => getMultilineValues(value).forEach(addValue);

  partsState.master.forEach(row => {
    addValue(row.current_part_number);
    addMultiline(row.description);
    addMultiline(row.source);
  });
  partsState.aliases.forEach(row => {
    addValue(row.old_part_number);
    addValue(row.current_part_number);
    addMultiline(row.description);
    addMultiline(row.source);
  });
  partsState.usage.forEach(row => {
    addValue(row.current_part_number);
    addValue(row.extracted_part_number);
    addMultiline(row.description);
    addValue(row.drawing_number);
    addValue(row.drawing_name);
    addMultiline(row.pdf_file_name);
  });

  const seen = new Set();
  return values.filter(value => {
    const key = normalizeSearch(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function openPartsLoginModal() {
  document.getElementById("partsLoginModal")?.classList.remove("hidden");
}

function closePartsLoginModal() {
  document.getElementById("partsLoginModal")?.classList.add("hidden");
}

function showPartsMessage(title, message, options = {}) {
  const modal = document.getElementById("partsMessageModal");
  const confirmButton = document.getElementById("partsMessageConfirmButton");
  const cancelButton = document.getElementById("partsMessageCancelButton");
  if (!modal || !confirmButton || !cancelButton) {
    return Promise.resolve(true);
  }

  if (partsMessageResolver) closePartsMessage(false);

  setText("partsMessageTitle", title || "Parts Library");
  setText("partsMessageText", message || "");
  confirmButton.textContent = options.confirmText || "OK";
  confirmButton.classList.toggle("danger", options.variant === "danger");
  cancelButton.textContent = options.cancelText || "Cancel";
  cancelButton.classList.toggle("hidden", options.cancelText === null);
  modal.classList.remove("hidden");
  confirmButton.focus();

  return new Promise(resolve => {
    partsMessageResolver = resolve;
  });
}

function closePartsMessage(result) {
  document.getElementById("partsMessageModal")?.classList.add("hidden");
  const confirmButton = document.getElementById("partsMessageConfirmButton");
  if (confirmButton) confirmButton.classList.remove("danger");
  const resolver = partsMessageResolver;
  partsMessageResolver = null;
  if (resolver) resolver(Boolean(result));
}

function showPartsError(message, title = "Parts Library Error") {
  setPartsStatus(message);
  return showPartsMessage(title, message, {
    confirmText: "OK",
    cancelText: null,
    variant: "error"
  });
}

async function checkPartsLogin() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    partsLoginRequired = false;
    setPartsLoginStatus("Shared login unavailable. Using local Parts Library.");
    return;
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  partsCurrentUser = sessionData.session?.user || null;
  if (!partsCurrentUser) {
    const { data } = await supabaseClient.auth.getUser();
    partsCurrentUser = data.user || null;
  }
  updatePartsLoginUI();

  if (!partsCurrentUser && partsLoginRequired) {
    openPartsLoginModal();
  }
}

function updatePartsLoginUI() {
  const loggedIn = !!partsCurrentUser;
  const loginButton = document.getElementById("partsLoginButton");
  const logoutButton = document.getElementById("partsLogoutButton");
  const main = document.querySelector(".parts-db-page");

  setPartsLoginStatus(loggedIn ? `Logged in as ${partsCurrentUser.email}` : "Not logged in.");
  setPartsStatus(loggedIn ? "Ready to use shared Parts Library." : "Log in to load the shared Parts Library.");

  if (loginButton) {
    loginButton.textContent = loggedIn ? partsCurrentUser.email : "Login";
    loginButton.classList.toggle("account-email-pill", loggedIn);
    loginButton.onclick = loggedIn ? null : openPartsLoginModal;
  }

  if (logoutButton) logoutButton.classList.toggle("hidden", !loggedIn);
  if (main) main.classList.toggle("parts-login-locked", partsLoginRequired && !loggedIn);
  updatePartsLocalButton();
  updatePartsSharedStorageUsage();
}

function setPartsLoginStatus(message) {
  const status = document.getElementById("partsLoginStatus");
  if (status) status.textContent = message;
}

function updatePartsLocalButton() {
  const clearButton = document.getElementById("partsClearLocalButton");
  const syncButton = document.getElementById("partsSyncLocalButton");
  const hasCache = hasLocalPartsCache();

  if (clearButton) clearButton.classList.toggle("hidden", hasSupabaseParts() || !hasCache);
  if (syncButton) {
    syncButton.classList.toggle("hidden", !hasCache);
    syncButton.disabled = false;
    syncButton.textContent = "Save Library";
  }
}

function hasLocalPartsCache() {
  return !!localStorage.getItem(PARTS_STORAGE_KEY);
}

async function syncLocalPartsCopyToShared() {
  const cached = loadLocalPartsDatabase();
  if (!hasSupabaseParts()) {
    openPartsLoginModal();
    setPartsStatus("Log in first, then click Save Library again.");
    return;
  }

  if (!getPartsDataCompletenessScore(cached)) {
    setPartsStatus("There is no local Parts Library copy to save.");
    updatePartsLocalButton();
    return;
  }

  applyPartsData(cached);
  normalizePartsFileNameLabels();
  setPartsStatus("Checking local copy and saving it to the shared Parts Library...");
  updatePartsLocalButton();

  const synced = await persistPartsChanges({
    master: partsState.master,
    aliases: partsState.aliases,
    usage: partsState.usage,
    reviews: partsState.reviews,
    history: partsState.history
  });

  if (synced) {
    saveLocalPartsDatabase("shared", { pendingSync: false });
    setPartsStatus("Local copy saved to the shared Parts Library. Other logged-in users should see it after refresh.");
    await showPartsMessage(
      "Shared Save Complete",
      "The local Parts Library copy was saved to Supabase. Other logged-in users should see it after refreshing.",
      { confirmText: "OK", cancelText: null }
    );
  } else {
    saveLocalPartsDatabase("shared", { pendingSync: true });
    setPartsStatus("The local copy is still saved in this browser, but Supabase did not accept everything yet. Check the status message for the table error.");
    await showPartsMessage(
      "Shared Save Failed",
      "The local copy is still saved in this browser, but it did not fully save to Supabase. Check the import/status message for the Supabase table error.",
      { confirmText: "OK", cancelText: null }
    );
  }

  updatePartsLocalButton();
  renderPartsDatabase();
}

async function loginPartsUser() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    setPartsLoginStatus("Shared login is unavailable.");
    return;
  }

  const email = document.getElementById("partsLoginEmail")?.value.trim();
  const password = document.getElementById("partsLoginPassword")?.value.trim();

  if (!email || !password) {
    setPartsLoginStatus("Enter your email and password.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    setPartsLoginStatus(error.message || "Could not log in.");
    return;
  }

  partsCurrentUser = data.user || null;
  closePartsLoginModal();
  updatePartsLoginUI();
  await loadPartsDatabase();
  applyPendingPartsChangesToState();
  await retryPendingPartsChanges({ silent: true });
  renderPartsDatabase();
}

async function logoutPartsUser() {
  if (typeof supabaseClient !== "undefined" && supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  partsCurrentUser = null;
  updatePartsLoginUI();
  openPartsLoginModal();
}

function bindPartsDropZone(id, onFile, isValidFile) {
  const zone = document.getElementById(id);
  if (!zone) return;

  ["dragenter", "dragover"].forEach(type => {
    zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.remove("drag-over");
    });
  });

  zone.addEventListener("drop", event => {
    const files = Array.from(event.dataTransfer?.files || []).filter(isValidFile);
    if (!files.length) {
      setPartsStatus(id === "partsDrawingDropZone" ? "Drop one or more PDF drawings." : "Drop one or more Excel or CSV files.");
      return;
    }
    onFile(files);
  });
}

function handlePartsDrawingFiles(files) {
  if (!ensurePartsUnlocked()) return;
  const validFiles = normalizePartsFileList(files, file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!validFiles.length) return;
  setText("selectedPartsDrawing", describeSelectedPartsFiles(validFiles, "drawing"));
  startDrawingPDFImport(validFiles);
}

function handlePartsExcelFiles(files) {
  if (!ensurePartsUnlocked()) return;
  const validFiles = normalizePartsFileList(files, file => /\.(xlsx|xls|csv)$/i.test(file.name));
  if (!validFiles.length) return;
  setText("selectedPartsExcel", describeSelectedPartsFiles(validFiles, "Excel file"));
  startExcelImport(validFiles);
}

function normalizePartsFileList(files, isValidFile) {
  return Array.from(files || []).filter(file => file && isValidFile(file));
}

function describeSelectedPartsFiles(files, label) {
  if (files.length === 1) return `Selected ${label}: ${files[0].name}`;
  const shown = files.slice(0, 3).map(file => file.name).join(", ");
  return `Selected ${files.length} ${label}s: ${shown}${files.length > 3 ? ", ..." : ""}`;
}

function getPartsImportFileLabel(files) {
  if (files.length === 1) return files[0].name;
  const shown = files.slice(0, 3).map(file => file.name).join(", ");
  return `${files.length} files: ${shown}${files.length > 3 ? ", ..." : ""}`;
}

function ensurePartsUnlocked() {
  if (!partsLoginRequired || partsCurrentUser) return true;
  openPartsLoginModal();
  setPartsStatus("Log in before using the shared Parts Library.");
  return false;
}

async function loadPartsDatabase() {
  updatePartsLocalButton();
  const cached = loadLocalPartsDatabase();

  if (!hasSupabaseParts()) {
    if (isSharedPartsCache(cached)) {
      applyPartsData(cached);
      normalizePartsFileNameLabels();
      setPartsStatus("Showing the last shared Parts Library saved in this browser. Log in or refresh to update it.");
    } else if (shouldUseLocalPartsCopy()) {
      applyPartsData(cached);
      normalizePartsFileNameLabels();
      saveLocalPartsDatabase("local");
      setPartsStatus("Showing this browser's local Parts Library copy because shared login is unavailable.");
    } else {
      clearRuntimePartsData();
      setPartsStatus("Log in to load the shared Parts Library.");
    }
    return;
  }

  try {
    setPartsStatus("Loading the full shared Parts Library...");
    const master = await fetchSupabaseRows(PARTS_TABLES.master);
    const [aliases, usage, reviews, history] = await Promise.all([
      fetchSupabaseRows(PARTS_TABLES.aliases),
      fetchSupabaseRows(PARTS_TABLES.usage),
      fetchSupabaseRows(PARTS_TABLES.reviews),
      fetchSupabaseRows(PARTS_TABLES.history)
    ]);
    const remote = { master, aliases, usage, reviews, history };
    if (shouldKeepCachedPartsData(cached, remote)) {
      applyPartsData(cached);
      normalizePartsFileNameLabels();
      setPartsStatus("Showing your latest imported Parts Library from this browser because shared storage is older or not fully synced.");
      updatePartsLocalButton();
      return;
    }

    applyPartsData(remote);
    normalizePartsFileNameLabels();
    saveLocalPartsDatabase("shared", { preserveSaveState: true });
    setPartsSaveState("shared");
    setPartsStatus("Loaded shared Parts Library.");
    updatePartsLocalButton();
  } catch (error) {
    console.warn("Could not load shared parts library.", error);
    if (isMissingPartsRemoteTableError(error)) {
      partsRemoteStorageAvailable = false;
    }
    const cached = loadLocalPartsDatabase();
    if (isSharedPartsCache(cached)) {
      applyPartsData(cached);
      normalizePartsFileNameLabels();
      setPartsStatus("Showing the last shared Parts Library saved in this browser. Shared storage could not be reached.");
    } else if (shouldUseLocalPartsCopy()) {
      applyPartsData(cached);
      normalizePartsFileNameLabels();
      setPartsStatus("Using this browser's local Parts Library copy. Shared storage could not be loaded.");
    } else {
      clearRuntimePartsData();
      setPartsStatus("Shared Parts Library could not be loaded. Try refreshing or logging in again.");
    }
    updatePartsLocalButton();
  }
}

function shouldUseLocalPartsCopy() {
  return !partsLoginRequired || !isSharedPartsLoginAvailable();
}

function isSharedPartsLoginAvailable() {
  return typeof supabaseClient !== "undefined" && !!supabaseClient;
}

function clearRuntimePartsData() {
  partsState.master = [];
  partsState.aliases = [];
  partsState.usage = [];
  partsState.reviews = [];
  partsState.history = [];
  partsState.selected = {};
}

function applyPartsData(data) {
  partsState.master = Array.isArray(data.master) ? data.master : [];
  partsState.aliases = Array.isArray(data.aliases) ? data.aliases : [];
  partsState.usage = Array.isArray(data.usage) ? data.usage : [];
  partsState.reviews = Array.isArray(data.reviews) ? data.reviews : [];
  partsState.history = Array.isArray(data.history) ? data.history : [];
  partsState.selected = {};
}

function loadLocalPartsDatabase() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PARTS_STORAGE_KEY) || "{}");
    return {
      meta: parsed.meta || {},
      master: Array.isArray(parsed.master) ? parsed.master : [],
      aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [],
      usage: Array.isArray(parsed.usage) ? parsed.usage : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch (error) {
    return { meta: {}, master: [], aliases: [], usage: [], reviews: [], history: [] };
  }
}

function isSharedPartsCache(data) {
  return data?.meta?.storageMode === "shared" || (Array.isArray(data?.aliases) && data.aliases.length > 0);
}

function shouldKeepCachedPartsData(cached, remote) {
  if (!isSharedPartsCache(cached)) return false;
  if (cached?.meta?.pendingSync) return true;
  const cachedScore = getPartsDataCompletenessScore(cached);
  const remoteScore = getPartsDataCompletenessScore(remote);
  return cachedScore > remoteScore;
}

function getPartsDataCompletenessScore(data) {
  return getArrayLength(data?.master) + getArrayLength(data?.aliases) + getArrayLength(data?.usage) + getArrayLength(data?.history);
}

function getArrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

async function clearLocalPartsCopy() {
  const pendingCount = getPartsRetryQueueSize();
  const confirmed = await showPartsMessage(
    "Clear Local Copy",
    `Clear the Parts Library data saved in this browser? This does not delete the shared library.${pendingCount ? ` This will also discard ${pendingCount} pending shared change${pendingCount === 1 ? "" : "s"}.` : ""}`,
    {
      confirmText: "Clear Local Copy",
      cancelText: "Cancel",
      variant: "danger"
    }
  );
  if (!confirmed) return;

  localStorage.removeItem(PARTS_STORAGE_KEY);
  localStorage.removeItem(PARTS_RETRY_QUEUE_KEY);
  localStorage.removeItem(PARTS_HEALTH_EXCEPTIONS_KEY);
  partsState.master = [];
  partsState.aliases = [];
  partsState.usage = [];
  partsState.reviews = [];
  partsState.history = [];
  partsState.selected = {};

  if (hasSupabaseParts()) {
    await loadPartsDatabase();
  } else if (shouldUseLocalPartsCopy()) {
    setPartsStatus("Local browser copy cleared. Log in to load the shared Parts Library.");
  } else {
    setPartsStatus("Local browser copy cleared.");
  }

  updatePartsLocalButton();
  renderPartsDatabase();
}

function normalizePartsFileNameLabels() {
  const importedFileNames = partsState.history
    .map(row => row.file_name)
    .filter(Boolean);
  const excelFileNames = partsState.history
    .filter(row => /excel|xlsx|xls|csv|part/i.test(`${row.import_type || ""} ${row.file_name || ""}`))
    .map(row => row.file_name)
    .filter(Boolean);
  const fallbackFileName = excelFileNames[0] || importedFileNames[0] || "";

  const cleanFileName = value => {
    const text = String(value || "").trim();
    if (/^excel:\s*sheet/i.test(text)) return fallbackFileName || text.replace(/^Excel:\s*/i, "");
    return text;
  };

  partsState.master.forEach(row => {
    if (row.status === "active_number_exception") {
      row.status = "active";
      row.record_type = "Part Number Exception";
    }
    row.source = mergeFileNameLabels(cleanFileName(row.source), "");
    row.description = mergePartDescriptions(row.description, "");
  });
  partsState.aliases.forEach(row => {
    row.source = mergeFileNameLabels(cleanFileName(row.source), "");
    row.description = mergePartDescriptions(row.description, "");
  });
  partsState.usage.forEach(row => {
    row.pdf_file_name = mergeFileNameLabels(cleanFileName(row.pdf_file_name), "");
    row.description = mergePartDescriptions(row.description, "");
    row.drawing_number = cleanUsageDrawingLabel(row.drawing_number);
    row.drawing_name = cleanUsageDrawingLabel(row.drawing_name);
  });
  partsState.reviews.forEach(row => {
    row.source_file = mergeFileNameLabels(cleanFileName(row.source_file), "");
    row.extracted_description = mergePartDescriptions(row.extracted_description, "");
    row.suggested_description = mergePartDescriptions(row.suggested_description, "");
  });
}

function cleanUsageDrawingLabel(value) {
  const text = normalizeImportText(value);
  if (!text) return "";
  if (/^\d+\s+REFER\s+TO\b/i.test(text)) return "";
  if (isBOMHeaderLine(text)) return "";
  return text;
}

function initializePartsSaveIndicator() {
  const queue = loadPartsRetryQueue();
  const cached = loadLocalPartsDatabase();
  if (getPartsRetryQueueSize(queue)) {
    setPartsSaveState("failed");
  } else if (cached?.meta?.pendingSync) {
    setPartsSaveState("local");
  } else if (cached) {
    setPartsSaveState(cached.meta?.storageMode === "shared" ? "shared" : "local");
  } else {
    setPartsSaveState("local");
  }
}

function setPartsSaveState(state) {
  const indicator = document.getElementById("partsSaveIndicator");
  const text = document.getElementById("partsSaveIndicatorText");
  const retryButton = document.getElementById("partsRetrySaveButton");
  if (!indicator || !text) return;
  const config = {
    saving: ["saving", "Saving…"],
    shared: ["saved-shared", "Saved to shared library"],
    local: ["saved-local", "Saved locally"],
    failed: ["save-failed", "Shared save failed"],
    unsaved: ["unsaved", "Unsaved changes"]
  }[state] || ["saved-local", "Saved locally"];
  indicator.classList.remove("saving", "saved-shared", "saved-local", "save-failed", "unsaved");
  indicator.classList.add(config[0]);
  text.textContent = config[1];
  retryButton?.classList.toggle("hidden", state !== "failed");
}

function markPartsUnsaved() {
  setPartsSaveState("unsaved");
}

function getEmptyPartsRetryQueue() {
  return {
    upserts: { master: [], aliases: [], usage: [], reviews: [], history: [] },
    deletes: [],
    updated_at: ""
  };
}

function loadPartsRetryQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PARTS_RETRY_QUEUE_KEY) || "null");
    if (!parsed?.upserts) return getEmptyPartsRetryQueue();
    const empty = getEmptyPartsRetryQueue();
    Object.keys(empty.upserts).forEach(tab => {
      empty.upserts[tab] = Array.isArray(parsed.upserts[tab]) ? parsed.upserts[tab] : [];
    });
    empty.deletes = Array.isArray(parsed.deletes) ? parsed.deletes : [];
    empty.updated_at = parsed.updated_at || "";
    return empty;
  } catch {
    return getEmptyPartsRetryQueue();
  }
}

function savePartsRetryQueue(queue) {
  queue.updated_at = nowISO();
  if (!getPartsRetryQueueSize(queue)) {
    localStorage.removeItem(PARTS_RETRY_QUEUE_KEY);
    return;
  }
  localStorage.setItem(PARTS_RETRY_QUEUE_KEY, JSON.stringify(queue));
}

function getPartsRetryQueueSize(queue = loadPartsRetryQueue()) {
  const upserts = Object.values(queue.upserts || {}).reduce((sum, rows) => sum + getArrayLength(rows), 0);
  return upserts + getArrayLength(queue.deletes);
}

function applyPendingPartsChangesToState() {
  const queue = loadPartsRetryQueue();
  if (!getPartsRetryQueueSize(queue)) return;
  Object.keys(queue.upserts).forEach(tab => {
    queue.upserts[tab].forEach(pending => {
      const key = pending.id || getRetryRowKey(tab, pending);
      const index = partsState[tab].findIndex(row => (row.id || getRetryRowKey(tab, row)) === key);
      if (index >= 0) partsState[tab][index] = { ...partsState[tab][index], ...pending };
      else partsState[tab].unshift({ ...pending });
    });
  });
  queue.deletes.forEach(operation => {
    const tab = getPartsTabForTable(operation.table);
    if (tab) partsState[tab] = partsState[tab].filter(row => row.id !== operation.id);
  });
  saveLocalPartsDatabase("shared", { pendingSync: true, preserveSaveState: true });
  setPartsSaveState(hasSupabaseParts() ? "failed" : "local");
}

function queueFailedPartsChanges(changed) {
  const queue = loadPartsRetryQueue();
  Object.keys(queue.upserts).forEach(tab => {
    const incoming = getArrayLength(changed?.[tab]) ? changed[tab] : [];
    if (!incoming.length) return;
    const merged = new Map(queue.upserts[tab].map(row => [row.id || getRetryRowKey(tab, row), row]));
    incoming.forEach(row => merged.set(row.id || getRetryRowKey(tab, row), { ...row }));
    queue.upserts[tab] = [...merged.values()];
  });
  savePartsRetryQueue(queue);
  setPartsSaveState("failed");
}

function removeQueuedPartsChanges(changed) {
  const queue = loadPartsRetryQueue();
  Object.keys(queue.upserts).forEach(tab => {
    const savedKeys = new Set((changed?.[tab] || []).map(row => row.id || getRetryRowKey(tab, row)));
    if (savedKeys.size) queue.upserts[tab] = queue.upserts[tab].filter(row => !savedKeys.has(row.id || getRetryRowKey(tab, row)));
  });
  savePartsRetryQueue(queue);
}

function getRetryRowKey(tab, row) {
  if (tab === "master") return getPartNumberKey(row.current_part_number);
  if (tab === "aliases") return getPartNumberKey(row.old_part_number);
  if (tab === "usage") return getUsageLocationKey(row);
  if (tab === "reviews") return getReviewDuplicateKey(row);
  return row.id || JSON.stringify(row);
}

function queueFailedPartsDelete(table, id) {
  if (!id) return;
  const queue = loadPartsRetryQueue();
  const key = `${table}:${id}`;
  if (!queue.deletes.some(item => `${item.table}:${item.id}` === key)) queue.deletes.push({ table, id });
  savePartsRetryQueue(queue);
  setPartsSaveState("failed");
}

function removeQueuedPartsDelete(table, id) {
  const queue = loadPartsRetryQueue();
  queue.deletes = queue.deletes.filter(item => item.table !== table || item.id !== id);
  savePartsRetryQueue(queue);
}

async function retryPendingPartsChanges(options = {}) {
  if (partsRetryInProgress) return false;
  const queue = loadPartsRetryQueue();
  const total = getPartsRetryQueueSize(queue);
  if (!total) return true;
  if (!hasSupabaseParts()) {
    setPartsSaveState("local");
    return false;
  }

  partsRetryInProgress = true;
  setPartsSaveState("saving");
  if (!options.silent) setPartsStatus(`Retrying ${total} pending shared change${total === 1 ? "" : "s"}...`);
  const remaining = getEmptyPartsRetryQueue();
  try {
    for (const tab of Object.keys(queue.upserts)) {
      if (!queue.upserts[tab].length) continue;
      const saved = await upsertSupabaseRows(PARTS_TABLES[tab], queue.upserts[tab], { manageSaveState: false });
      if (!saved) remaining.upserts[tab] = queue.upserts[tab];
    }
    for (const operation of queue.deletes) {
      const deleted = await deleteSupabaseRow(operation.table, operation.id, { queueOnFailure: false });
      if (!deleted) remaining.deletes.push(operation);
    }
    savePartsRetryQueue(remaining);
    if (getPartsRetryQueueSize(remaining)) {
      setPartsSaveState("failed");
      if (!options.silent) setPartsStatus("Some shared changes still could not be saved. They remain queued for another retry.");
      return false;
    }
    saveLocalPartsDatabase("shared", { pendingSync: false, preserveSaveState: true });
    setPartsSaveState("shared");
    if (!options.silent) setPartsStatus("All pending changes were saved to the shared Parts Library.");
    return true;
  } finally {
    partsRetryInProgress = false;
  }
}

function openPartsHealthReport() {
  const report = buildPartsHealthReport();
  const issueCount = report.reduce((sum, section) => sum + (section.informational ? 0 : section.items.length), 0);
  setText("partsHealthSummary", issueCount
    ? `${issueCount} issue${issueCount === 1 ? "" : "s"} found across ${report.filter(section => !section.informational && section.items.length).length} categories.`
    : "No library health issues were found.");
  const container = document.getElementById("partsHealthReport");
  if (container) {
    container.innerHTML = report.map(section => `
      <section class="parts-health-section ${section.items.length ? "" : "good"}">
        <h3><span>${escapeHTML(section.title)}</span><span>${section.items.length}</span></h3>
        <p>${escapeHTML(section.description)}</p>
        ${section.items.length ? `<ul>${section.items.slice(0, 50).map(item => renderPartsHealthItem(item)).join("")}</ul>` : ""}
        ${section.items.length > 50 ? `<p>Showing the first 50 of ${section.items.length} issues.</p>` : ""}
      </section>
    `).join("");
  }
  container?.querySelectorAll("[data-health-exception]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.healthException;
      if (action === "approve-health" || action === "revoke-health") {
        updateGeneralHealthException(action, button.dataset.id, button.dataset.exceptionText);
      } else {
        updatePartNumberException(action, button.dataset.id);
      }
    });
  });
  document.getElementById("partsHealthModal")?.classList.remove("hidden");
}

function renderPartsHealthItem(item) {
  if (typeof item === "string") return `<li>${escapeHTML(item)}</li>`;
  return `
    <li class="parts-health-item-action">
      <span>${escapeHTML(item.text)}</span>
      <button class="secondary" type="button" data-health-exception="${escapeAttr(item.action)}" data-id="${escapeAttr(item.id)}" data-exception-text="${escapeAttr(item.exceptionText || item.text)}">${escapeHTML(item.label)}</button>
    </li>
  `;
}

function loadGeneralHealthExceptions() {
  try {
    return JSON.parse(localStorage.getItem(PARTS_HEALTH_EXCEPTIONS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveGeneralHealthExceptions(exceptions) {
  if (Object.keys(exceptions).length) localStorage.setItem(PARTS_HEALTH_EXCEPTIONS_KEY, JSON.stringify(exceptions));
  else localStorage.removeItem(PARTS_HEALTH_EXCEPTIONS_KEY);
}

async function updateGeneralHealthException(action, key, text) {
  const exceptions = loadGeneralHealthExceptions();
  if (action === "approve-health") {
    const confirmed = await showPartsMessage(
      "Allow Health Exception",
      `Allow this Library Health exception?\n\n${text}\n\nIt will remain approved in this browser until revoked.`,
      { confirmText: "Allow Exception", cancelText: "Cancel" }
    );
    if (!confirmed) return;
    exceptions[key] = { text, approved_at: nowISO() };
    setPartsStatus("Library Health exception approved.");
  } else {
    delete exceptions[key];
    setPartsStatus("Library Health exception revoked.");
  }
  saveGeneralHealthExceptions(exceptions);
  openPartsHealthReport();
}

function getGeneralHealthExceptionKey(sectionTitle, text) {
  const source = `${sectionTitle}|${text}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `health-${(hash >>> 0).toString(16)}`;
}

async function updatePartNumberException(action, id) {
  const part = partsState.master.find(row => row.id === id);
  if (!part) return;
  const approving = action === "approve";
  if (approving) {
    const confirmed = await showPartsMessage(
      "Approve Part Number Exception",
      `Allow ${part.current_part_number} as a Current Part even though it contains more than eight digits? This exception will be saved with the shared record.`,
      { confirmText: "Approve Exception", cancelText: "Cancel" }
    );
    if (!confirmed) return;
  }
  part.status = "active";
  part.record_type = approving ? "Part Number Exception" : "Part";
  part.updated_at = nowISO();
  saveLocalPartsDatabase();
  const saved = await upsertSupabaseRows(PARTS_TABLES.master, [part]);
  if (saved) setPartsStatus(approving ? `Approved ${part.current_part_number} as a number-length exception.` : `Removed the exception for ${part.current_part_number}.`);
  openPartsHealthReport();
}

function closePartsHealthReport() {
  document.getElementById("partsHealthModal")?.classList.add("hidden");
}

function buildPartsHealthReport() {
  const invalidNumbers = [];
  const oldNumbersInCurrent = [];
  const missingDescriptions = [];
  const brokenMappings = [];
  const usageWithoutParts = [];
  const coveredReviews = [];
  const approvedExceptions = [];

  partsState.master.forEach(row => {
    const number = row.current_part_number || "(blank)";
    if (isOldPartNumberCandidate(number)) oldNumbersInCurrent.push(`${number} is stored in Current Parts.`);
    else if (isApprovedPartNumberException(row)) {
      approvedExceptions.push({ text: `${number} is approved as a long Current Part number.`, action: "revoke", id: row.id, label: "Revoke" });
    } else if (!isCurrentPartNumberCandidate(number)) {
      invalidNumbers.push(isLongPartNumberExceptionCandidate(number)
        ? { text: `Current Part ${number} contains more than eight digits.`, action: "approve", id: row.id, label: "Allow Exception" }
        : `Current Part ${number} is not an eight-digit number.`);
    }
    if (!String(row.description || "").trim()) missingDescriptions.push(`Current Part ${number} has no description.`);
  });
  partsState.aliases.forEach(row => {
    const oldNumber = row.old_part_number || "(blank)";
    if (!isOldPartNumberCandidate(oldNumber)) invalidNumbers.push(`Old Part ${oldNumber} is not a seven-digit number.`);
    if (row.current_part_number && !isCurrentPartNumberCandidate(row.current_part_number) && !findApprovedLongCurrentPart(row.current_part_number)) {
      invalidNumbers.push(`Old Part ${oldNumber} links to invalid Current Part ${row.current_part_number}.`);
    }
    if (!String(row.description || "").trim()) missingDescriptions.push(`Old Part ${oldNumber} has no description.`);
    if (row.current_part_number && !findMasterPartByNumber(row.current_part_number)) {
      brokenMappings.push(`${oldNumber} points to missing Current Part ${row.current_part_number}.`);
    }
  });
  partsState.usage.forEach(row => {
    const shown = row.current_part_number || row.extracted_part_number || "(blank)";
    const usageDigits = getNumericPartDigits(shown);
    if (usageDigits && usageDigits.length !== 7 && usageDigits.length !== 8 && !findApprovedLongCurrentPart(shown)) {
      invalidNumbers.push(`Drawing Usage ${shown} does not contain seven or eight digits.`);
    }
    if (!String(row.description || "").trim()) missingDescriptions.push(`Drawing Usage ${shown} has no description.`);
    const current = row.current_part_number && findMasterPartByNumber(row.current_part_number);
    const alias = partsState.aliases.find(item => getPartNumberKey(item.old_part_number) === getPartNumberKey(row.extracted_part_number));
    if (!current && !alias) usageWithoutParts.push(`${shown} in ${row.pdf_file_name || row.drawing_number || "an unknown drawing"} is not linked to a saved part.`);
  });
  partsState.reviews.forEach(row => {
    if (["accepted", "ignored"].includes(row.status)) return;
    const found = row.extracted_part_number;
    const foundDigits = getNumericPartDigits(found);
    if (foundDigits && foundDigits.length !== 7 && foundDigits.length !== 8 && !findApprovedLongCurrentPart(found)) {
      invalidNumbers.push(`Item to Check ${found} does not contain seven or eight digits.`);
    }
    const savedFound = findMasterPartByNumber(found) || partsState.aliases.some(alias => getPartNumberKey(alias.old_part_number) === getPartNumberKey(found));
    const savedSuggestion = row.suggested_current_part_number && findMasterPartByNumber(row.suggested_current_part_number);
    if (savedFound || savedSuggestion) coveredReviews.push(`${found || "Unknown number"} is still open even though its saved part-number decision already exists.`);
  });

  const sections = [
    { title: "Invalid part-number lengths", description: "Current numbers must contain eight digits; old numbers must contain seven.", items: invalidNumbers },
    { title: "Old numbers stored as current parts", description: "Seven-digit numbers belong in Old Part Numbers, not Current Parts.", items: oldNumbersInCurrent },
    { title: "Missing descriptions", description: "Records without descriptions are harder to match during future imports.", items: missingDescriptions },
    { title: "Broken old-to-current mappings", description: "Old-only records are allowed; this reports only mappings that name a missing current part.", items: brokenMappings },
    { title: "Drawing usage with missing parts", description: "These drawing references are not connected to a current or old part record.", items: usageWithoutParts },
    { title: "Reviews covered by saved decisions", description: "These reviews can be resolved automatically because their part-number decision is already saved.", items: coveredReviews }
  ];

  const generalExceptions = loadGeneralHealthExceptions();
  sections.forEach(section => {
    section.items = section.items.map(item => {
      if (typeof item !== "string") return item;
      const key = getGeneralHealthExceptionKey(section.title, item);
      if (generalExceptions[key]) {
        approvedExceptions.push({ text: item, action: "revoke-health", id: key, label: "Revoke", exceptionText: item });
        return null;
      }
      return { text: item, action: "approve-health", id: key, label: "Allow Exception", exceptionText: item };
    }).filter(Boolean);
  });
  sections.push({
    title: "Approved exceptions",
    description: "Long-number exceptions are shared with the part record. Other health exceptions are retained in this browser and can be revoked here.",
    items: approvedExceptions,
    informational: true
  });
  return sections;
}

function isApprovedPartNumberException(row) {
  return (row?.record_type === "Part Number Exception" || row?.status === "active_number_exception") && isLongPartNumberExceptionCandidate(row.current_part_number);
}

function isLongPartNumberExceptionCandidate(value) {
  return getPartNumberKey(value).length > 8 && !isOldPartNumberCandidate(value);
}

function findApprovedLongCurrentPart(value) {
  const part = findMasterPartByNumber(value);
  return isApprovedPartNumberException(part) ? part : null;
}

function saveLocalPartsDatabase(storageMode = hasSupabaseParts() ? "shared" : "local", options = {}) {
  const pendingSync = options.pendingSync === undefined
    ? getPartsRetryQueueSize() > 0
    : Boolean(options.pendingSync);
  localStorage.setItem(PARTS_STORAGE_KEY, JSON.stringify({
    meta: {
      storageMode,
      pendingSync,
      recordCount: getPartsDataCompletenessScore(partsState),
      saved_at: nowISO()
    },
    master: partsState.master,
    aliases: partsState.aliases,
    usage: partsState.usage,
    reviews: partsState.reviews,
    history: partsState.history
  }));
  if (!options.preserveSaveState) setPartsSaveState("local");
}

function hasSupabaseParts() {
  return (
    partsRemoteStorageAvailable &&
    typeof supabaseClient !== "undefined" &&
    !!supabaseClient &&
    (!partsLoginRequired || !!partsCurrentUser)
  );
}

async function fetchSupabaseRows(table) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from(table)
      .select("*")
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function upsertSupabaseRows(table, rows, options = {}) {
  if (!rows.length) return true;
  const manageSaveState = options.manageSaveState !== false;
  const tab = getPartsTabForTable(table);
  const changed = { master: [], aliases: [], usage: [], reviews: [], history: [] };
  if (tab) changed[tab] = rows;
  if (!hasSupabaseParts()) {
    if (manageSaveState) {
      queueFailedPartsChanges(changed);
      setPartsSaveState("local");
    }
    return false;
  }
  if (manageSaveState) setPartsSaveState("saving");
  let saved = false;
  try {
    const payload = prepareSupabaseRows(table, rows);
    if (table === PARTS_TABLES.master) {
      saved = await saveSupabaseMasterRows(payload);
    } else if (table === PARTS_TABLES.aliases) {
      saved = await saveSupabaseRowsByLookup(PARTS_TABLES.aliases, payload);
    } else if (table === PARTS_TABLES.usage) {
      saved = await saveSupabaseRowsByLookup(PARTS_TABLES.usage, payload);
    } else {
      saved = await saveSupabaseRowsInBatches(table, payload, getSupabaseConflictTarget(table));
    }
  } catch (error) {
    console.warn("Shared Parts Library save failed.", error);
    setPartsStatus(`Shared save failed: ${error?.message || "network connection error"}`);
  }
  if (manageSaveState) {
    if (saved) {
      removeQueuedPartsChanges(changed);
      const pending = getPartsRetryQueueSize() > 0;
      saveLocalPartsDatabase("shared", { pendingSync: pending, preserveSaveState: true });
      setPartsSaveState(pending ? "failed" : "shared");
    } else {
      queueFailedPartsChanges(changed);
    }
  }
  return saved;
}

function getPartsTabForTable(table) {
  return Object.keys(PARTS_TABLES).find(tab => PARTS_TABLES[tab] === table) || "";
}

async function saveSupabaseRowsByLookup(table, rows) {
  const label = getSupabaseSaveLabel(table);
  setPartsStatus(`Checking shared ${label} before saving ${rows.length} record${rows.length === 1 ? "" : "s"}...`);
  const existingRows = await fetchSupabaseRows(table);
  const existingByKey = buildSupabaseRowLookup(table, existingRows);
  const payload = rows.map(row => {
    const existing = existingByKey.get(getSupabaseRowNaturalKey(table, row)) || existingByKey.get(row.id || "");
    const merged = cleanSupabaseRowForTable(
      table,
      existing ? mergeSupabaseRow(existing, row, table) : row,
      existing || {}
    );
    if (existing?.id) merged.id = existing.id;
    return merged;
  });

  return saveSupabaseRowsInBatches(table, payload, "id");
}

async function saveSupabaseRowsInBatches(table, rows, onConflict = "id") {
  const label = getSupabaseSaveLabel(table);
  const chunks = chunkPartsRows(rows, 250);
  for (const [index, chunk] of chunks.entries()) {
    setPartsStatus(`Saving ${label} batch ${index + 1} of ${chunks.length} (${chunk.length} records)...`);
    addPartsImportLog(`Saving ${label} batch ${index + 1} of ${chunks.length}.`);
    const { error } = await supabaseClient
      .from(table)
      .upsert(chunk, { onConflict });
    if (error) {
      handlePartsRemoteError(error, table);
      return false;
    }
    await pauseForPartsStatusUpdate();
  }
  return true;
}

async function saveSupabaseMasterRows(rows) {
  setPartsStatus(`Checking shared current parts before saving ${rows.length} record${rows.length === 1 ? "" : "s"}...`);
  const existingRows = await fetchSupabaseRows(PARTS_TABLES.master);
  const existingByPartNumber = buildSupabaseMasterLookup(existingRows);
  const existingById = new Map(existingRows.filter(row => row.id).map(row => [row.id, row]));
  const updates = [];
  const inserts = [];

  rows.forEach(row => {
    const key = row.normalized_part_number || normalizePartNumber(row.current_part_number);
    const existingByPrimaryKey = row.id ? existingById.get(row.id) : null;
    const existing = existingByPrimaryKey || existingByPartNumber.get(key) || existingByPartNumber.get(formatCurrentPartNumber(row.current_part_number));
    const merged = cleanSupabaseRowForTable(
      PARTS_TABLES.master,
      existing ? mergeSupabaseRow(existing, row, PARTS_TABLES.master) : row,
      existing || {}
    );
    if (existing?.id) merged.id = existing.id;
    if (existingByPrimaryKey) updates.push(merged);
    else inserts.push(merged);
  });

  for (const [index, row] of updates.entries()) {
    setPartsStatus(`Updating shared current part ${index + 1} of ${updates.length}...`);
    const { id, ...changes } = row;
    const { error } = await supabaseClient
      .from(PARTS_TABLES.master)
      .update(changes)
      .eq("id", id);
    if (error) {
      handlePartsRemoteError(error, PARTS_TABLES.master);
      return false;
    }
  }

  if (inserts.length) {
    return saveSupabaseRowsInBatches(PARTS_TABLES.master, inserts, "normalized_part_number");
  }
  return true;
}

function buildSupabaseMasterLookup(rows) {
  const lookup = new Map();
  rows.forEach(row => {
    const normalized = row.normalized_part_number || normalizePartNumber(row.current_part_number);
    const formatted = formatCurrentPartNumber(row.current_part_number);
    if (normalized) lookup.set(normalized, row);
    if (formatted) lookup.set(formatted, row);
  });
  return lookup;
}

function buildSupabaseRowLookup(table, rows) {
  const lookup = new Map();
  rows.forEach(row => {
    const naturalKey = getSupabaseRowNaturalKey(table, row);
    if (naturalKey) lookup.set(naturalKey, row);
    if (row.id) lookup.set(row.id, row);
  });
  return lookup;
}

function getSupabaseRowNaturalKey(table, row) {
  if (table === PARTS_TABLES.aliases) {
    return `${normalizePartNumber(row.old_part_number)}=>${normalizePartNumber(row.current_part_number)}`;
  }
  if (table === PARTS_TABLES.usage) {
    return [
      normalizePartNumber(row.current_part_number),
      normalizePartNumber(row.extracted_part_number),
      normalizeSearch(row.drawing_number),
      normalizeSearch(row.item_number),
      normalizeSearch(row.pdf_file_name),
      String(row.pdf_page_number || "")
    ].join("|");
  }
  return row.id || "";
}

function getSupabaseSaveLabel(table) {
  return {
    [PARTS_TABLES.master]: "current parts",
    [PARTS_TABLES.aliases]: "old part numbers",
    [PARTS_TABLES.usage]: "drawing usage records",
    [PARTS_TABLES.reviews]: "review records",
    [PARTS_TABLES.history]: "import history"
  }[table] || table;
}

function chunkPartsRows(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function updateSupabaseMasterAfterInsertConflict(row) {
  const normalizedPartNumber = row.normalized_part_number || normalizePartNumber(row.current_part_number);
  const existing = await findSupabaseMasterPart(row.current_part_number, normalizedPartNumber);
  if (!existing) return false;
  const merged = cleanSupabaseRowForTable(PARTS_TABLES.master, mergeSupabaseRow(existing, row, PARTS_TABLES.master), existing);
  const { error } = await supabaseClient
    .from(PARTS_TABLES.master)
    .update({ ...merged, id: existing.id })
    .eq("id", existing.id);
  return !error;
}

async function findSupabaseMasterPart(currentPartNumber, normalizedPartNumber) {
  const normalized = normalizedPartNumber || normalizePartNumber(currentPartNumber);
  if (normalized) {
    const { data, error } = await supabaseClient
      .from(PARTS_TABLES.master)
      .select("*")
      .eq("normalized_part_number", normalized)
      .maybeSingle();
    if (!error && data) return data;
  }

  const current = formatCurrentPartNumber(currentPartNumber);
  if (!current) return null;
  const { data, error } = await supabaseClient
    .from(PARTS_TABLES.master)
    .select("*")
    .eq("current_part_number", current)
    .maybeSingle();
  return error ? null : data;
}

async function findSupabaseAliasRow(row) {
  const oldPart = normalizePartNumber(row.old_part_number);
  const currentPart = normalizePartNumber(row.current_part_number);
  if (!oldPart || !currentPart) return null;
  const { data, error } = await supabaseClient
    .from(PARTS_TABLES.aliases)
    .select("*")
    .eq("old_part_number", row.old_part_number)
    .eq("current_part_number", row.current_part_number)
    .limit(1);
  return error ? null : data?.[0] || null;
}

async function findSupabaseUsageRow(row) {
  let query = supabaseClient
    .from(PARTS_TABLES.usage)
    .select("*")
    .eq("current_part_number", row.current_part_number || "")
    .eq("extracted_part_number", row.extracted_part_number || "")
    .eq("drawing_number", row.drawing_number || "")
    .eq("item_number", row.item_number || "")
    .eq("pdf_file_name", row.pdf_file_name || "")
    .limit(1);

  if (row.pdf_page_number === null || row.pdf_page_number === undefined || row.pdf_page_number === "") {
    query = query.is("pdf_page_number", null);
  } else {
    query = query.eq("pdf_page_number", row.pdf_page_number);
  }

  const { data, error } = await query;
  return error ? null : data?.[0] || null;
}

function prepareSupabaseRows(table, rows) {
  if (table === PARTS_TABLES.master) {
    return mergeRowsForSupabaseConflict(table, rows, row => row.normalized_part_number || normalizePartNumber(row.current_part_number));
  }
  if (table === PARTS_TABLES.aliases) {
    return mergeRowsForSupabaseConflict(
      table,
      rows.map(row => ({ ...row, part_id: null })),
      row => `${normalizePartNumber(row.old_part_number)}=>${normalizePartNumber(row.current_part_number)}`
    );
  }
  if (table === PARTS_TABLES.usage) {
    return mergeRowsForSupabaseConflict(
      table,
      rows.map(row => ({
        ...row,
        part_id: null,
        source_import_id: getValidPartsImportHistoryId(row.source_import_id)
      })),
      row => [
        normalizePartNumber(row.current_part_number),
        normalizePartNumber(row.extracted_part_number),
        normalizeSearch(row.drawing_number),
        normalizeSearch(row.item_number),
        normalizeSearch(row.pdf_file_name),
        String(row.pdf_page_number || "")
      ].join("|")
    );
  }
  return rows.map(row => cleanSupabaseRowForTable(table, row));
}

function getValidPartsImportHistoryId(importId) {
  const id = String(importId || "").trim();
  if (!id) return null;
  return partsState.history.some(row => row.id === id) ? id : null;
}

function mergeRowsForSupabaseConflict(table, rows, getKey) {
  const merged = new Map();
  rows.forEach(row => {
    const key = getKey(row);
    if (!key) return;
    const existing = merged.get(key);
    merged.set(key, existing ? cleanSupabaseRowForTable(table, mergeSupabaseRow(existing, row, table), existing) : cleanSupabaseRowForTable(table, { ...row }));
  });
  return [...merged.values()];
}

function mergeSupabaseRow(existing, incoming, table = "") {
  const next = { ...existing, ...incoming };
  if ("description" in existing || "description" in incoming) {
    next.description = mergePartDescriptions(existing.description, incoming.description);
    if (table === PARTS_TABLES.master || table === PARTS_TABLES.reviews) {
      next.normalized_description = normalizeDescription(next.description);
    }
  }
  if ("source" in existing || "source" in incoming) {
    next.source = mergeFileNameLabels(existing.source, incoming.source);
  }
  if ("pdf_file_name" in existing || "pdf_file_name" in incoming) {
    next.pdf_file_name = mergeFileNameLabels(existing.pdf_file_name, incoming.pdf_file_name);
  }
  next.created_at = existing.created_at || incoming.created_at;
  next.updated_at = incoming.updated_at || existing.updated_at;
  return next;
}

function cleanSupabaseRowForTable(table, row, fallback = {}) {
  if (table === PARTS_TABLES.master && row?.status === "active_number_exception") {
    row = { ...row, status: "active", record_type: "Part Number Exception" };
  }
  if (table === PARTS_TABLES.master && fallback?.status === "active_number_exception") {
    fallback = { ...fallback, status: "active", record_type: "Part Number Exception" };
  }
  const allowedColumns = {
    [PARTS_TABLES.master]: [
      "id", "current_part_number", "normalized_part_number", "compact_part_number", "description",
      "normalized_description", "category", "manufacturer", "manufacturer_part_number",
      "unit_of_measure", "source", "status", "needs_review", "record_type",
      "referenced_drawing_number", "created_at", "updated_at"
    ],
    [PARTS_TABLES.aliases]: [
      "id", "part_id", "old_part_number", "current_part_number", "description",
      "match_type", "source", "notes", "created_at", "updated_at"
    ],
    [PARTS_TABLES.usage]: [
      "id", "part_id", "current_part_number", "extracted_part_number", "description",
      "drawing_number", "drawing_name", "item_number", "quantity", "pdf_file_name",
      "pdf_page_number", "source_import_id", "referenced_drawing_number", "record_type",
      "created_at", "updated_at"
    ],
    [PARTS_TABLES.reviews]: [
      "id", "extracted_part_number", "extracted_description", "suggested_current_part_number",
      "suggested_description", "match_type", "confidence", "source_file", "page",
      "reason", "status", "created_at", "updated_at"
    ],
    [PARTS_TABLES.history]: [
      "id", "file_name", "import_type", "row_count", "unique_parts_count",
      "exact_match_count", "old_number_match_count", "suggested_match_count",
      "review_count", "status", "created_at", "updated_at"
    ]
  }[table];
  if (!allowedColumns) return row;
  return allowedColumns.reduce((cleaned, column) => {
    if (Object.prototype.hasOwnProperty.call(row, column)) {
      cleaned[column] = row[column];
    } else if (Object.prototype.hasOwnProperty.call(fallback, column)) {
      cleaned[column] = fallback[column];
    }
    return cleaned;
  }, {});
}

function getSupabaseConflictTarget(table) {
  if (table === PARTS_TABLES.master) return "normalized_part_number";
  if (table === PARTS_TABLES.aliases) return "old_part_number,current_part_number";
  if (table === PARTS_TABLES.usage) return "current_part_number,extracted_part_number,drawing_number,item_number,pdf_file_name,pdf_page_number";
  return "id";
}

async function deleteSupabaseRow(table, id, options = {}) {
  const queueOnFailure = options.queueOnFailure !== false;
  if (!hasSupabaseParts()) {
    if (queueOnFailure) queueFailedPartsDelete(table, id);
    return false;
  }
  if (queueOnFailure) setPartsSaveState("saving");
  let error = null;
  try {
    ({ error } = await supabaseClient.from(table).delete().eq("id", id));
  } catch (caught) {
    error = caught;
  }
  if (error) {
    handlePartsRemoteError(error, table);
    if (queueOnFailure) queueFailedPartsDelete(table, id);
    return false;
  }
  removeQueuedPartsDelete(table, id);
  const pending = getPartsRetryQueueSize() > 0;
  saveLocalPartsDatabase("shared", { pendingSync: pending, preserveSaveState: true });
  if (queueOnFailure) setPartsSaveState(pending ? "failed" : "shared");
  return true;
}

function handlePartsRemoteError(error, table = "") {
  const message = formatPartsRemoteError(error, table);
  if (isMissingPartsRemoteTableError(error)) {
    partsRemoteStorageAvailable = false;
    setPartsStatus(message);
    addPartsImportLog(message);
    return;
  }

  console.warn("Parts Library shared storage skipped:", error);
  setPartsStatus(message);
  addPartsImportLog(message);
}

function formatPartsRemoteError(error, table = "") {
  const tableText = table ? `${table}: ` : "";
  const message = error?.message || "Shared storage could not be reached.";
  const details = error?.details ? ` Details: ${error.details}` : "";
  const hint = error?.hint ? ` Hint: ${error.hint}` : "";
  return `Shared save failed. ${tableText}${message}${details}${hint}`;
}

function isMissingPartsRemoteTableError(error) {
  return error?.code === "PGRST205" || /could not find the table|schema cache/i.test(error?.message || "");
}

function renderPartsDatabase() {
  deduplicatePartsDatabase();
  renderPartsTabs();
  renderPartsFilters();
  renderPartsSortOptions();
  renderPartsSummary();
  renderActivePartsTable();
  renderActivePartsListHeading();
  updatePartsBulkActions();
  updatePartsUndoRedoControls();
}

function renderPartsTabs() {
  document.querySelectorAll("[data-parts-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.partsTab === partsState.activeTab);
  });
}

function setPartsActiveTab(tab) {
  if (!partsState[tab]) return;
  partsState.activeTab = tab;
  resetPartsPage();
  partsState.sort = getDefaultPartsSort(tab);
  renderPartsDatabase();
}

function renderPartsFilters() {
  syncSelectOptions("partsSourceFilter", uniqueValues([
    ...partsState.master.flatMap(row => getFileNameLabels(row.source)),
    ...partsState.aliases.flatMap(row => getFileNameLabels(row.source)),
    ...partsState.usage.flatMap(row => getFileNameLabels(row.pdf_file_name)),
    ...partsState.reviews.flatMap(row => getFileNameLabels(row.source_file))
  ]), "All file names");
}

function syncSelectOptions(id, values, allLabel) {
  const select = document.getElementById(id);
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHTML(allLabel)}</option>` +
    values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("");
  select.value = values.includes(current) ? current : "";
}

function renderPartsSortOptions() {
  const select = document.getElementById("partsSortSelect");
  if (!select) return;
  const config = getPartsTableConfig(partsState.activeTab);
  const columnOptions = config.columns
    .filter(col => !col.badge && !col.check)
    .flatMap(col => [
      { value: `${col.key}:asc`, label: `${col.label} A-Z` },
      { value: `${col.key}:desc`, label: `${col.label} Z-A` }
    ]);
  const options = partsState.activeTab === "reviews"
    ? [{ value: "review_confidence:desc", label: "Highest Match Confidence First" }, ...columnOptions]
    : columnOptions;
  const current = `${partsState.sort.key}:${partsState.sort.direction}`;

  select.innerHTML = options
    .map(option => `<option value="${escapeAttr(option.value)}">${escapeHTML(option.label)}</option>`)
    .join("");
  select.value = options.some(option => option.value === current)
    ? current
    : `${getDefaultPartsSort(partsState.activeTab).key}:${getDefaultPartsSort(partsState.activeTab).direction}`;
}

function renderPartsSummary() {
  setText("partsTotalCount", getUniqueCurrentPartsCount());
  setText("partsAliasCount", getUniqueOldPartNumbersCount());
  setText("partsUsageCount", getUniqueDrawingUsageCount());
  setText("partsReviewCount", getUniqueOpenReviewCount());
  setText("partsHistoryCount", getUniqueImportHistoryCount());
  renderPartsHeaderSummary();
}

function renderPartsHeaderSummary() {
  const totalRecords = partsState.master.length + partsState.aliases.length + partsState.usage.length + partsState.reviews.length + partsState.history.length;
  const storageLabel = hasSupabaseParts() ? "shared" : "local";

  setText("partsHeaderRecordCount", `${totalRecords} ${storageLabel} part record${totalRecords === 1 ? "" : "s"} saved`);
  setText("partsHeaderUsageText", `Current parts: ${getUniqueCurrentPartsCount()} - Old part numbers: ${getUniqueOldPartNumbersCount()} - Drawing usage: ${getUniqueDrawingUsageCount()}`);
  updatePartsSharedStorageUsage();
}

function getUniqueCurrentPartsCount() {
  return new Set(partsState.master.map(row => getPartNumberKey(row.current_part_number)).filter(Boolean)).size;
}

function getUniqueOldPartNumbersCount() {
  return new Set(partsState.aliases.map(row => getPartNumberKey(row.old_part_number)).filter(Boolean)).size;
}

function getUniqueDrawingUsageCount() {
  return new Set(partsState.usage.map(getUsageLocationKey).filter(Boolean)).size;
}

function getUniqueOpenReviewCount() {
  return new Set(
    partsState.reviews
      .filter(row => !["accepted", "ignored"].includes(row.status))
      .map(getReviewDuplicateKey)
      .filter(Boolean)
  ).size;
}

function getUniqueImportHistoryCount() {
  return new Set(partsState.history.map(row => row.id).filter(Boolean)).size;
}

function getReviewDuplicateKey(row) {
  const found = getPartNumberKey(row.extracted_part_number);
  if (!found) return row.id || "";
  return [
    found,
    getPartNumberKey(row.suggested_current_part_number),
    normalizeSearch(row.source_file),
    String(row.page || "")
  ].join("|");
}

function deduplicatePartsDatabase() {
  const removedIds = { master: [], aliases: [], usage: [], reviews: [], history: [] };
  const changedRows = { master: [], aliases: [], usage: [], reviews: [], history: [] };
  const definitions = {
    master: row => getPartNumberKey(row.current_part_number),
    aliases: row => getPartNumberKey(row.old_part_number),
    usage: row => getUsageLocationKey(row),
    reviews: row => getReviewDuplicateKey(row),
    history: row => row.id || ""
  };

  Object.entries(definitions).forEach(([tab, getKey]) => {
    const merged = new Map();
    const unkeyed = [];
    partsState[tab].forEach(row => {
      const key = getKey(row);
      if (!key) {
        unkeyed.push(row);
        return;
      }
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, row);
        return;
      }
      const combined = mergeDuplicatePartRows(existing, row, tab);
      Object.assign(existing, combined);
      if (row.id && row.id !== existing.id) removedIds[tab].push(row.id);
      if (!changedRows[tab].includes(existing)) changedRows[tab].push(existing);
    });
    partsState[tab] = [...merged.values(), ...unkeyed];
  });

  return {
    removedIds,
    changedRows,
    removedCount: Object.values(removedIds).reduce((sum, ids) => sum + ids.length, 0),
    changedCount: Object.values(changedRows).reduce((sum, rows) => sum + rows.length, 0)
  };
}

function mergeDuplicatePartRows(existing, incoming, tab) {
  const table = PARTS_TABLES[tab];
  const merged = mergeSupabaseRow(existing, incoming, table);
  merged.id = existing.id;
  if (tab === "aliases") {
    merged.current_part_number = incoming.current_part_number || existing.current_part_number || "";
    merged.part_id = incoming.part_id || existing.part_id || null;
  }
  if (tab === "reviews") {
    merged.extracted_description = mergePartDescriptions(existing.extracted_description, incoming.extracted_description);
    merged.suggested_description = mergePartDescriptions(existing.suggested_description, incoming.suggested_description);
    merged.source_file = mergeFileNameLabels(existing.source_file, incoming.source_file);
    const statusPriority = { accepted: 3, ignored: 2, needs_review: 1 };
    merged.status = (statusPriority[incoming.status] || 0) > (statusPriority[existing.status] || 0)
      ? incoming.status
      : existing.status;
  }
  return merged;
}

async function persistPartsDuplicateCleanup(cleanup) {
  if (!hasSupabaseParts() || !cleanup) return false;
  let synced = true;
  for (const tab of Object.keys(cleanup.removedIds)) {
    for (const id of cleanup.removedIds[tab]) {
      if (!await deleteSupabaseRow(PARTS_TABLES[tab], id)) synced = false;
    }
    if (cleanup.changedRows[tab].length) {
      if (!await upsertSupabaseRows(PARTS_TABLES[tab], cleanup.changedRows[tab])) synced = false;
    }
  }
  return synced;
}

async function updatePartsSharedStorageUsage() {
  const usageCard = document.getElementById("partsStorageSummary");
  if (!usageCard) return;

  const label = document.getElementById("partsHeaderRecordCount");
  const detail = document.getElementById("partsHeaderUsageText");
  const bar = document.getElementById("partsHeaderUsageBar");
  const recordCount = partsState.master.length + partsState.aliases.length + partsState.usage.length + partsState.reviews.length + partsState.history.length;
  const now = Date.now();

  usageCard.classList.remove("warning", "danger");

  if (!partsCurrentUser || typeof supabaseClient === "undefined" || !supabaseClient) {
    if (label) label.textContent = "Log in to view shared storage.";
    if (bar) bar.style.width = "0%";
    if (detail) detail.textContent = `${recordCount} part record${recordCount === 1 ? "" : "s"} saved locally/shared when available`;
    return;
  }

  if (partsStorageUsageChecking || now - partsStorageUsageCheckedAt < 60000) return;
  partsStorageUsageChecking = true;

  if (label) label.textContent = "Checking shared storage...";

  try {
    const usedBytes = await getPartsStorageFolderUsageBytes("");
    const percentUsed = PARTS_STORAGE_LIMIT_BYTES > 0
      ? Math.min(100, (usedBytes / PARTS_STORAGE_LIMIT_BYTES) * 100)
      : 0;
    const remainingBytes = Math.max(0, PARTS_STORAGE_LIMIT_BYTES - usedBytes);

    if (label) label.textContent = `${formatPartsStorageBytes(remainingBytes)} left of ${formatPartsStorageBytes(PARTS_STORAGE_LIMIT_BYTES)}`;
    if (bar) bar.style.width = `${percentUsed.toFixed(1)}%`;
    if (detail) detail.textContent = `${formatPartsStorageBytes(usedBytes)} used - ${recordCount} part record${recordCount === 1 ? "" : "s"} saved`;

    usageCard.classList.toggle("warning", percentUsed >= 75 && percentUsed < 90);
    usageCard.classList.toggle("danger", percentUsed >= 90);
    partsStorageUsageCheckedAt = Date.now();
  } catch (error) {
    console.warn("Could not calculate shared storage usage:", error);
    if (label) label.textContent = "Shared storage unavailable.";
    if (bar) bar.style.width = "0%";
    if (detail) detail.textContent = `${recordCount} part record${recordCount === 1 ? "" : "s"} saved`;
    partsStorageUsageCheckedAt = Date.now();
  } finally {
    partsStorageUsageChecking = false;
  }
}

async function getPartsStorageFolderUsageBytes(path) {
  let totalBytes = 0;
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabaseClient.storage
      .from(PARTS_DOCUMENTS_BUCKET)
      .list(path, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" }
      });

    if (error) throw error;

    const entries = data || [];

    for (const entry of entries) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      const size = entry.metadata?.size;
      totalBytes += typeof size === "number" ? size : await getPartsStorageFolderUsageBytes(entryPath);
    }

    if (entries.length < limit) break;
    offset += limit;
  }

  return totalBytes;
}

function formatPartsStorageBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function renderActivePartsListHeading() {
  const config = getPartsTableConfig(partsState.activeTab);
  const rows = getFilteredRows(partsState.activeTab);
  const count = getVisiblePartsCount(partsState.activeTab, rows);
  setText("partsActiveListTitle", config.title);
  setText("partsActiveListSummary", `${count} ${config.emptyLabel} shown. Use the filters above to narrow this list.`);
  document.getElementById("partsReviewExplanation")?.classList.toggle("hidden", partsState.activeTab !== "reviews");
}

function getVisiblePartsCount(tab, rows) {
  if (tab === "master") {
    return new Set(rows.map(row => getPartNumberKey(row.current_part_number)).filter(Boolean)).size;
  }
  if (tab === "aliases") {
    return new Set(rows.map(row => getPartNumberKey(row.old_part_number)).filter(Boolean)).size;
  }
  return rows.length;
}

function renderActivePartsTable() {
  const wrap = document.getElementById("partsTableWrap");
  if (!wrap) return;
  const rows = getFilteredRows(partsState.activeTab);
  const sorted = sortRows(rows, partsState.sort);
  const config = getPartsTableConfig(partsState.activeTab);
  const selected = getSelectedPartsSet(partsState.activeTab);
  const visibleIds = new Set(sorted.map(row => row.id));
  [...selected].forEach(id => {
    if (!visibleIds.has(id)) selected.delete(id);
  });

  if (!sorted.length) {
    wrap.innerHTML = `<div class="parts-empty-state">No ${config.emptyLabel} found.</div>`;
    updatePartsBulkActions();
    return;
  }

  const pageCount = Math.max(1, Math.ceil(sorted.length / partsState.pageSize));
  if (partsState.page > pageCount) partsState.page = pageCount;
  if (partsState.page < 1) partsState.page = 1;
  const pageRows = getPaginatedPartsRows(sorted);

  wrap.innerHTML = `
    <table class="parts-data-table ${partsState.activeTab === "reviews" ? "parts-review-table" : ""}">
      ${partsState.activeTab === "reviews" ? `
        <colgroup>
          <col class="review-col-found-number" />
          <col class="review-col-found-description" />
          <col class="review-col-source-file" />
          <col class="review-col-source-page" />
          <col class="review-col-suggested-number" />
          <col class="review-col-category" />
          <col class="review-col-subcategory" />
          <col class="review-col-suggested-description" />
          <col class="review-col-confidence" />
          <col class="review-col-type" />
          <col class="parts-review-actions-col" />
        </colgroup>
      ` : ""}
      <thead>
        ${partsState.activeTab === "reviews" ? `
          <tr class="parts-review-group-headings">
            <th colspan="4">Found in Source</th>
            <th colspan="5">Suggested Library Match</th>
            <th colspan="2">Review Decision</th>
          </tr>
        ` : ""}
        <tr>
          ${partsState.activeTab === "reviews" ? "" : `<th class="parts-select-column">Select</th>`}
          ${config.columns.map(col => `<th>${escapeHTML(col.label)}</th>`).join("")}
          <th class="parts-actions-column">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${pageRows.map(row => renderPartsTableRow(row, config, selected.has(row.id))).join("")}
      </tbody>
    </table>
    ${renderPartsPagination(sorted.length, pageCount)}
  `;

  wrap.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => handlePartsAction(button.dataset.action, button.dataset.id));
  });
  wrap.querySelectorAll("[data-select-row]").forEach(input => {
    input.addEventListener("change", () => togglePartsRowSelection(input.dataset.selectRow, input.checked));
  });
  wrap.querySelectorAll("[data-parts-page]").forEach(button => {
    button.addEventListener("click", () => setPartsPage(Number(button.dataset.partsPage)));
  });
  updatePartsBulkActions();
}

function getPaginatedPartsRows(rows) {
  const start = (partsState.page - 1) * partsState.pageSize;
  return rows.slice(start, start + partsState.pageSize);
}

function renderPartsPagination(totalRows, pageCount) {
  if (pageCount <= 1) {
    return `<div class="parts-pagination"><span>Showing ${totalRows} record${totalRows === 1 ? "" : "s"}.</span></div>`;
  }

  const startRow = (partsState.page - 1) * partsState.pageSize + 1;
  const endRow = Math.min(totalRows, partsState.page * partsState.pageSize);
  const pageButtons = getPartsPageNumbers(pageCount).map(page => `
    <button
      class="secondary parts-page-button ${page === partsState.page ? "active" : ""}"
      type="button"
      data-parts-page="${page}"
      ${page === partsState.page ? "aria-current=\"page\"" : ""}
    >${page}</button>
  `).join("");

  return `
    <div class="parts-pagination">
      <span>Showing ${startRow}-${endRow} of ${totalRows}</span>
      <div class="button-row parts-page-actions">
        <button class="secondary" type="button" data-parts-page="${partsState.page - 1}" ${partsState.page === 1 ? "disabled" : ""}>Previous</button>
        ${pageButtons}
        <button class="secondary" type="button" data-parts-page="${partsState.page + 1}" ${partsState.page === pageCount ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function getPartsPageNumbers(pageCount) {
  const visibleCount = Math.min(4, pageCount);
  let start = Math.max(1, partsState.page - 1);
  let end = Math.min(pageCount, start + visibleCount - 1);
  start = Math.max(1, end - visibleCount + 1);
  const pages = [];
  for (let page = start; page <= end; page += 1) pages.push(page);
  return pages;
}

function setPartsPage(page) {
  const rows = sortRows(getFilteredRows(partsState.activeTab), partsState.sort);
  const pageCount = Math.max(1, Math.ceil(rows.length / partsState.pageSize));
  partsState.page = Math.min(Math.max(1, page || 1), pageCount);
  renderActivePartsTable();
}

function resetPartsPage() {
  partsState.page = 1;
}

function renderPartsTableRow(row, config, isSelected) {
  const showSelection = partsState.activeTab !== "reviews";
  return `
    <tr class="${isSelected ? "selected" : ""}">
      ${showSelection ? `<td class="parts-select-column">
        <span class="parts-select-control">
          <input type="checkbox" data-select-row="${escapeAttr(row.id)}" ${isSelected ? "checked" : ""} aria-label="Select row" />
        </span>
      </td>` : ""}
      ${config.columns.map(col => `<td>${formatPartsCell(row, col)}</td>`).join("")}
      <td class="parts-actions-column"><div class="parts-row-actions">${config.actions(row).join("")}</div></td>
    </tr>
  `;
}

function formatPartsCell(row, col) {
  const value = getPartsDisplayValue(row, col.key);
  const hasValue = value !== null && value !== undefined && String(value).trim() !== "";
  const displayValue = hasValue
    ? (col.valueLabels?.[value] || formatValue(value))
    : (col.emptyLabel || "");
  if (col.badge) return `<span class="parts-badge ${getBadgeClass(value)}">${escapeHTML(displayValue)}</span>`;
  if (col.check) return value ? `<span class="parts-badge needs-review">Needs Review</span>` : "";
  return `<span class="parts-cell-lines${hasValue ? "" : " parts-cell-empty"}">${escapeHTML(displayValue)}</span>`;
}

function getPartsCategoryNumber(row) {
  return [row?.suggested_current_part_number, row?.current_part_number, row?.extracted_part_number]
    .find(isCurrentPartNumberCandidate) || "";
}

function getPartsDisplayValue(row, key) {
  if (key === "category_group") return getPartNumberCategoryInfo(getPartsCategoryNumber(row)).group;
  if (key === "subcategory") return getPartNumberCategoryInfo(getPartsCategoryNumber(row)).subcategory;
  return row?.[key];
}

function getSelectedPartsSet(tab = partsState.activeTab) {
  if (!partsState.selected[tab]) partsState.selected[tab] = new Set();
  return partsState.selected[tab];
}

function getVisiblePartsRows() {
  return getPaginatedPartsRows(sortRows(getFilteredRows(partsState.activeTab), partsState.sort));
}

function togglePartsRowSelection(id, checked) {
  const selected = getSelectedPartsSet();
  if (checked) selected.add(id);
  else selected.delete(id);
  renderActivePartsTable();
}

function toggleVisiblePartsSelection() {
  if (!ensurePartsUnlocked()) return;
  const rows = getVisiblePartsRows();
  const selected = getSelectedPartsSet();
  const allVisibleSelected = rows.length > 0 && rows.every(row => selected.has(row.id));

  rows.forEach(row => {
    if (allVisibleSelected) selected.delete(row.id);
    else selected.add(row.id);
  });

  renderActivePartsTable();
}

function updatePartsBulkActions() {
  const rows = getVisiblePartsRows();
  const selected = getSelectedPartsSet();
  const selectedVisibleCount = rows.filter(row => selected.has(row.id)).length;
  const selectButton = document.getElementById("partsSelectVisibleButton");
  const deleteButton = document.getElementById("partsDeleteSelectedButton");
  const bulkActions = selectButton?.closest(".parts-list-bulk-actions");

  if (bulkActions) bulkActions.classList.toggle("hidden", partsState.activeTab === "reviews");

  if (selectButton) {
    selectButton.disabled = rows.length === 0;
    selectButton.textContent = rows.length > 0 && selectedVisibleCount === rows.length ? "Deselect All" : "Select All";
  }

  if (deleteButton) {
    deleteButton.disabled = selected.size === 0;
    deleteButton.textContent = selected.size ? `Delete Selected (${selected.size})` : "Delete Selected";
  }
}

function getPartsTableConfig(tab) {
  const actionButtons = (row, extra = "") => [
    `<button class="secondary parts-action-button" data-action="edit:${tab}" data-id="${row.id}">Edit</button>`,
    extra,
    `<button class="delete-btn parts-action-button" data-action="delete:${tab}" data-id="${row.id}">Delete</button>`
  ].filter(Boolean);

  const configs = {
    master: {
      title: "Current Parts",
      emptyLabel: "current parts",
      columns: [
        { key: "current_part_number", label: "Current Part Number" },
        { key: "category_group", label: "Category" },
        { key: "subcategory", label: "Subcategory" },
        { key: "description", label: "Description" },
        { key: "source", label: "File Name(s)" },
        { key: "updated_at", label: "Last Updated" }
      ],
      actions: row => actionButtons(row)
    },
    aliases: {
      title: "Old Part Number Map",
      emptyLabel: "old part numbers",
      columns: [
        { key: "old_part_number", label: "Old Part Number" },
        { key: "current_part_number", label: "Current Part Number" },
        { key: "category_group", label: "Current Category" },
        { key: "subcategory", label: "Current Subcategory" },
        { key: "description", label: "Description" },
        { key: "match_type", label: "Match Type", badge: true },
        { key: "source", label: "File Name(s)" },
        { key: "notes", label: "Notes" },
        { key: "updated_at", label: "Last Updated" }
      ],
      actions: row => actionButtons(row)
    },
    usage: {
      title: "Drawing Usage",
      emptyLabel: "drawing usage records",
      columns: [
        { key: "current_part_number", label: "Current Part Number" },
        { key: "category_group", label: "Category" },
        { key: "subcategory", label: "Subcategory" },
        { key: "description", label: "Description" },
        { key: "drawing_number", label: "Drawing / Sheet" },
        { key: "item_number", label: "Item" },
        { key: "quantity", label: "Qty" },
        { key: "pdf_file_name", label: "File Name(s)" },
        { key: "pdf_page_number", label: "Page" }
      ],
      actions: row => actionButtons(row)
    },
    reviews: {
      title: "Items to Check",
      emptyLabel: "items to check",
      columns: [
        { key: "extracted_part_number", label: "Found Part Number" },
        { key: "extracted_description", label: "Found Description" },
        { key: "source_file", label: "Source File" },
        { key: "page", label: "Source Page", emptyLabel: "Not provided by source" },
        { key: "suggested_current_part_number", label: "Suggested Current Number", emptyLabel: "No suggested match" },
        { key: "category_group", label: "Suggested Category" },
        { key: "subcategory", label: "Suggested Subcategory" },
        { key: "suggested_description", label: "Suggested Current Description", emptyLabel: "No suggested description" },
        { key: "confidence", label: "Match Confidence" },
        {
          key: "match_type",
          label: "Review Type",
          badge: true,
          valueLabels: {
            new_part: "Proposed New Part",
            suggested: "Suggested Match",
            conflict: "Conflicting Match",
            exact: "Exact Match"
          }
        }
      ],
      actions: row => {
        const isResolved = ["accepted", "ignored"].includes(row.status);
        if (isResolved) return actionButtons(row);

        const id = escapeAttr(row.id);
        const extractedNumber = escapeHTML(row.extracted_part_number || "extracted number");
        const suggestedNumber = escapeHTML(row.suggested_current_part_number || "suggested part");
        const isSevenDigitOldNumber = isOldPartNumberCandidate(row.extracted_part_number);
        const addNewAction = isSevenDigitOldNumber
          ? `<button class="secondary parts-action-button review-list-action" data-action="old-review" data-id="${id}"><strong>Add Old Number</strong><span>Save ${extractedNumber} to Old Part Numbers</span></button>`
          : `<button class="secondary parts-action-button review-list-action" data-action="new-review" data-id="${id}"><strong>Create New Part</strong><span>Add ${extractedNumber} to Current Parts</span></button>`;
        const aliasAction = row.suggested_current_part_number
          ? `<button class="secondary parts-action-button review-list-action" data-action="alias-review" data-id="${id}"><strong>Save Suggested Number</strong><span>Use ${suggestedNumber}; keep ${extractedNumber} as its old number</span></button>`
          : `<button class="secondary parts-action-button review-list-action review-action-disabled" type="button" disabled><strong>Save Suggested Number</strong><span>Add a suggestion in Edit first</span></button>`;

        return [`
          <div class="review-action-group">
            <div class="review-action-menu">
              ${addNewAction}
              ${aliasAction}
              <button class="secondary parts-action-button review-list-action" data-action="edit:reviews" data-id="${id}"><strong>Edit</strong><span>Correct found or suggested details</span></button>
              <button class="delete-btn parts-action-button review-list-action review-dismiss-action" data-action="ignore-review" data-id="${id}"><strong>Dismiss</strong><span>Do not add or map this item</span></button>
            </div>
          </div>
        `];
      }
    },
    history: {
      title: "Import History",
      emptyLabel: "imports",
      columns: [
        { key: "file_name", label: "File Name(s)" },
        { key: "import_type", label: "Import Type", badge: true },
        { key: "row_count", label: "Rows" },
        { key: "unique_parts_count", label: "Unique Parts" },
        { key: "exact_match_count", label: "Exact" },
        { key: "review_count", label: "Review" },
        { key: "status", label: "Status", badge: true },
        { key: "created_at", label: "Imported" }
      ],
      actions: row => [`<button class="delete-btn parts-action-button" data-action="delete:history" data-id="${row.id}">Delete</button>`]
    }
  };

  return configs[tab] || configs.master;
}

function getFilteredRows(tab) {
  const query = normalizeSearch(document.getElementById("partsSearchInput")?.value || "");
  const source = document.getElementById("partsSourceFilter")?.value || "";

  return (partsState[tab] || []).filter(row => {
    if (tab === "reviews" && ["accepted", "ignored"].includes(row.status)) return false;
    const haystack = normalizeSearch(Object.values(row).join(" "));
    if (query && !haystack.includes(query)) return false;
    if (source && !rowMatchesFileName(row, source)) return false;
    return true;
  });
}

function setPartsSort(key) {
  const current = partsState.sort;
  partsState.sort = {
    key,
    direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
  };
  resetPartsPage();
  renderActivePartsTable();
}

function setPartsSortFromValue(value) {
  const [key, direction] = String(value || "").split(":");
  if (!key) return;
  partsState.sort = {
    key,
    direction: direction === "desc" ? "desc" : "asc"
  };
  resetPartsPage();
  renderActivePartsTable();
}

function getDefaultPartsSort(tab) {
  const keys = {
    master: "current_part_number",
    aliases: "old_part_number",
    usage: "pdf_file_name",
    reviews: "review_confidence",
    history: "created_at"
  };
  return { key: keys[tab] || "current_part_number", direction: tab === "history" ? "desc" : "asc" };
}

function sortRows(rows, sort) {
  return [...rows].sort((a, b) => {
    if (sort.key === "review_confidence") {
      const confidenceResult = getReviewConfidenceScore(b) - getReviewConfidenceScore(a);
      if (confidenceResult !== 0) return confidenceResult;
      const priorityResult = getReviewSortPriority(a) - getReviewSortPriority(b);
      if (priorityResult !== 0) return priorityResult;
      const numberResult = String(a.extracted_part_number || "").localeCompare(
        String(b.extracted_part_number || ""),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
      if (numberResult !== 0) return numberResult;
      return String(a.source_file || "").localeCompare(String(b.source_file || ""), undefined, {
        numeric: true,
        sensitivity: "base"
      });
    }
    const av = getPartsDisplayValue(a, sort.key) ?? "";
    const bv = getPartsDisplayValue(b, sort.key) ?? "";
    const result = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
    return sort.direction === "asc" ? result : -result;
  });
}

function getReviewSortPriority(row) {
  if (row?.suggested_current_part_number || row?.match_type === "suggested") return 0;
  if (row?.match_type === "conflict") return 1;
  return 2;
}

function getReviewConfidenceScore(row) {
  const value = row?.confidence;
  if (typeof value === "number") return value <= 1 ? value * 100 : value;
  const parsed = Number.parseFloat(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : -1;
}

function getSortMarker(key) {
  if (partsState.sort.key !== key) return "";
  return partsState.sort.direction === "asc" ? " ▲" : " ▼";
}

async function startDrawingPDFImport(files) {
  if (typeof pdfjsLib === "undefined") {
    showPartsError("PDF import library is not loaded.");
    return;
  }

  const importFiles = normalizePartsFileList(files, file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!importFiles.length) return;

  partsState.previewType = "drawing_pdf";
  partsState.previewFileName = getPartsImportFileLabel(importFiles);
  partsState.previewRows = [];
  partsState.cancelImport = false;
  partsState.isProcessing = true;
  openPartsPreview(importFiles.length === 1 ? "Review Drawing Import" : "Review Drawing Imports");
  updatePartsProgress("Reading drawing PDF(s)...", 2);
  addPartsImportLog(`Started reading ${importFiles.length} drawing PDF${importFiles.length === 1 ? "" : "s"}.`);

  try {
    const rows = [];

    for (let fileIndex = 0; fileIndex < importFiles.length; fileIndex++) {
      if (partsState.cancelImport) break;
      const file = importFiles[fileIndex];
      addPartsImportLog(`Reading ${file.name}.`);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        if (partsState.cancelImport) break;
        const fileProgress = fileIndex / importFiles.length;
        const pageProgress = pageNumber / pdf.numPages / importFiles.length;
        updatePartsProgress(`Scanning ${file.name}, page ${pageNumber} of ${pdf.numPages}...`, (fileProgress + pageProgress) * 80);
        if (pageNumber === 1 || pageNumber % 10 === 0 || pageNumber === pdf.numPages) {
          addPartsImportLog(`Scanning ${file.name}, page ${pageNumber} of ${pdf.numPages}.`);
        }
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageLines = getPDFTextLines(textContent.items);
        const pageText = pageLines.join("\n");
        const drawingInfo = extractDrawingInfo(pageLines, pageText);
        const pageRows = extractBOMRowsFromPage(pageLines, {
          fileName: file.name,
          pageNumber,
          drawingNumber: drawingInfo.drawingNumber,
          drawingName: drawingInfo.drawingName
        });
        if (pageRows.length) {
          addPartsImportLog(`Found ${pageRows.length} BOM row(s) in ${file.name} on page ${pageNumber}${drawingInfo.drawingNumber ? `, drawing ${drawingInfo.drawingNumber}` : ""}.`);
        }
        rows.push(...pageRows);
        await waitForBrowser();
      }
    }

    partsState.previewRows = rows.map(row => buildPreviewRow(row, row.pdf_file_name || partsState.previewFileName));
    partsState.isProcessing = false;
    updatePartsCancelButton();
    updatePartsProgress(partsState.cancelImport ? "Import canceled. Review rows scanned so far." : "PDF scan complete.", 100);
    addPartsImportLog(`Ready to review ${partsState.previewRows.length} extracted row(s).`);
    renderImportPreview();
  } catch (error) {
    partsState.isProcessing = false;
    updatePartsCancelButton();
    console.error("Drawing PDF import failed:", error);
    updatePartsProgress("Could not read this PDF.", 100);
    showPartsError(error.message || "Could not import drawing PDF.");
  }
}

function getPDFTextLines(items) {
  const byY = new Map();
  items.forEach(item => {
    const text = normalizeImportText(item.str);
    if (!text) return;
    const y = Math.round(item.transform?.[5] || 0);
    const x = item.transform?.[4] || 0;
    const key = [...byY.keys()].find(existing => Math.abs(existing - y) <= 3) ?? y;
    if (!byY.has(key)) byY.set(key, []);
    byY.get(key).push({ x, text });
  });

  return [...byY.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map(part => part.text).join(" "))
    .map(line => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

function extractDrawingInfo(lines, pageText) {
  const drawingNumber =
    cleanDrawingTitleBlockValue(findTitleBlockValue(lines, "PART NUMBER")) ||
    (pageText.match(/\b([A-Z]{1,4}\d+(?:\.\d+)?-DWG-[A-Z0-9.-]+)\b/i)?.[1] || "");
  const drawingName =
    cleanDrawingTitleBlockValue(findTitleBlockValue(lines, "PART NAME")) ||
    cleanDrawingTitleBlockValue(findTitleBlockValue(lines, "TITLE")) ||
    "";
  return { drawingNumber, drawingName };
}

function cleanDrawingTitleBlockValue(value) {
  const text = normalizeImportText(value);
  if (!text) return "";
  if (/^\d+\s+REFER\s+TO\b/i.test(text)) return "";
  if (isBOMHeaderLine(text)) return "";
  if (parseBOMRow(text, { drawingNumber: "", drawingName: "", fileName: "", pageNumber: "" })) return "";
  return text;
}

function findTitleBlockValue(lines, label) {
  const normalizedLabel = normalizeSearch(label);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const normalized = normalizeSearch(line);
    if (!normalized.includes(normalizedLabel)) continue;
    const inline = line.split(/[:|]/).slice(1).join(" ").trim();
    if (inline && !normalizeSearch(inline).includes(normalizedLabel)) return inline;
    const next = lines[index + 1] || "";
    if (next && !isBOMHeaderLine(next)) return next.trim();
  }
  return "";
}

function extractBOMRowsFromPage(lines, context) {
  const rows = [];
  let inBOM = false;
  let blankCount = 0;

  lines.forEach(line => {
    if (isBOMHeaderLine(line)) {
      inBOM = true;
      blankCount = 0;
      return;
    }
    if (!inBOM) return;
    if (!line.trim()) {
      blankCount++;
      if (blankCount > 2) inBOM = false;
      return;
    }

    const row = parseBOMRow(line, context);
    if (row) {
      rows.push(row);
      blankCount = 0;
      return;
    }

    if (isLikelyNonBOMLine(line)) inBOM = false;
  });

  return rows;
}

function isBOMHeaderLine(line) {
  const normalized = normalizeSearch(line);
  return (
    normalized.includes("item no") &&
    normalized.includes("part number") &&
    normalized.includes("description") &&
    (normalized.includes("qty") || normalized.includes("quantity"))
  );
}

function parseBOMRow(line, context) {
  const clean = normalizeImportText(line);
  const match = clean.match(/^([A-Z]?\d+(?:\.\d+)?|[a-z])\s+(.+?)\s+(\d+(?:\.\d+)?|AR|REF)$/i);
  if (!match) return null;

  const itemNumber = match[1];
  const body = match[2].trim();
  const quantity = match[3];
  const partMatch = body.match(/^([A-Z0-9][A-Z0-9_.\-\/]+)(?:\s+(.+))?$/i);
  if (!partMatch) return null;

  const extractedPartNumber = partMatch[1].trim();
  if (!isImportableNumericPartNumber(extractedPartNumber)) return null;

  const description = (partMatch[2] || "").trim();
  if (!description) return null;

  return {
    item_number: itemNumber,
    extracted_part_number: extractedPartNumber,
    description,
    quantity,
    drawing_number: context.drawingNumber,
    drawing_name: context.drawingName,
    pdf_file_name: context.fileName,
    pdf_page_number: context.pageNumber,
    referenced_drawing_number: "",
    record_type: "Part",
    source: context.fileName
  };
}

function isLikelyNonBOMLine(line) {
  const normalized = normalizeSearch(line);
  return normalized.includes("revision") || normalized.includes("tolerance") || normalized.includes("unless otherwise specified");
}

function extractReferencedDrawing(value) {
  return String(value || "").match(/REFER TO\s+(.+)$/i)?.[1]?.trim() || "";
}

async function startExcelImport(files) {
  if (typeof XLSX === "undefined") {
    showPartsError("Excel import library is not loaded.");
    return;
  }

  const importFiles = normalizePartsFileList(files, file => /\.(xlsx|xls|csv)$/i.test(file.name));
  if (!importFiles.length) return;

  partsState.previewType = "excel";
  partsState.previewFileName = getPartsImportFileLabel(importFiles);
  partsState.previewRows = [];
  partsState.cancelImport = false;
  partsState.isProcessing = true;
  openPartsPreview(importFiles.length === 1 ? "Review Excel Import" : "Review Excel Imports");
  updatePartsProgress("Reading workbook(s)...", 10);
  addPartsImportLog(`Started reading ${importFiles.length} Excel file${importFiles.length === 1 ? "" : "s"}.`);

  try {
    let lastColumnMapping = null;

    for (let fileIndex = 0; fileIndex < importFiles.length; fileIndex++) {
      if (partsState.cancelImport) break;
      const file = importFiles[fileIndex];
      updatePartsProgress(`Reading ${file.name}...`, 10 + (fileIndex / importFiles.length) * 80);
      addPartsImportLog(`Started reading ${file.name}.`);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

      if (isExportedPartsWorkbook(workbook)) {
        const rows = getExportedPartsWorkbookPreviewRows(workbook, file.name);
        partsState.previewRows.push(...rows);
        addPartsImportLog(`Detected exported library workbook ${file.name} with ${rows.length} part and old-number row(s).`);
        continue;
      }

      const sheetName = chooseLikelySheet(workbook);
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
      const headers = rows.length ? Object.keys(rows[0]) : [];
      const mapping = detectExcelColumnMapping(headers);
      addPartsImportLog(`Using ${file.name}, sheet "${sheetName}" with ${rows.length} row(s).`);

      partsState.previewRows.push(
        ...rows
          .map((row, index) => buildExcelPreviewRow(row, mapping, file.name, sheetName, index + 2))
          .filter(Boolean)
      );

      lastColumnMapping = { headers, mapping, rows, fileName: file.name, sheetName };
      await waitForBrowser();
    }

    if (importFiles.length === 1 && lastColumnMapping) {
      renderColumnMapping(lastColumnMapping.headers, lastColumnMapping.mapping, lastColumnMapping.rows, lastColumnMapping.fileName, lastColumnMapping.sheetName);
    } else {
      document.getElementById("partsColumnMapping")?.classList.add("hidden");
    }

    partsState.isProcessing = false;
    updatePartsCancelButton();
    updatePartsProgress("Workbook preview ready.", 100);
    addPartsImportLog(`Ready to review ${partsState.previewRows.length} importable row(s).`);
    renderImportPreview();
  } catch (error) {
    partsState.isProcessing = false;
    updatePartsCancelButton();
    console.error("Excel import failed:", error);
    updatePartsProgress("Could not read this workbook.", 100);
    showPartsError(error.message || "Could not import Excel file.");
  }
}

function buildExcelPreviewRow(row, mapping, fileName, sheetName, rowNumber) {
  let oldPart = valueFromMappedColumn(row, mapping, "old_part_number");
  let currentPart = valueFromMappedColumn(row, mapping, "current_part_number");
  const description = valueFromMappedColumn(row, mapping, "description");

  if (!oldPart && isOldPartNumberCandidate(currentPart)) {
    oldPart = currentPart;
    currentPart = "";
  }

  if (!currentPart && isCurrentPartNumberCandidate(oldPart)) {
    currentPart = oldPart;
    oldPart = "";
  }

  currentPart = formatCurrentPartNumber(currentPart);

  if (!oldPart && !currentPart && !description) return null;

  return buildPreviewRow({
    extracted_part_number: currentPart || oldPart,
    current_part_number: currentPart,
    old_part_number: oldPart,
    description,
    source: fileName,
    source_sheet: sheetName,
    pdf_file_name: fileName,
    pdf_page_number: "",
    item_number: rowNumber,
    record_type: "Part"
  }, fileName);
}

function buildPreviewRow(source, fileName) {
  source = applyPartNumberRoleRules(source);
  const partNumber = source.current_part_number || source.extracted_part_number || "";
  const match = findPartMatch(partNumber, source.description);
  const status = getPreviewStatus(match, source);
  const currentPartNumber = match.currentPartNumber ||
    source.current_part_number ||
    (source.old_part_number && isOldPartNumberCandidate(partNumber) ? "" : formatCurrentPartNumber(partNumber));

  return {
    id: makeId("preview"),
    include: true,
    source,
    page: source.pdf_page_number || "",
    drawing_number: source.drawing_number || "",
    item_number: source.item_number || "",
    extracted_part_number: source.extracted_part_number || partNumber,
    current_part_number: currentPartNumber,
    description: source.description || "",
    quantity: source.quantity || "",
    suggested_current_part_number: match.currentPartNumber || "",
    suggested_description: match.description || "",
    match_type: match.type,
    confidence: match.confidence,
    status,
    reason: match.reason,
    file_name: fileName
  };
}

function findPartMatch(partNumber, description) {
  const compactPart = getPartNumberKey(partNumber);
  const normalizedDescription = normalizeDescription(description);

  const exactPart = partsState.master.find(part => getPartNumberKey(part.current_part_number) === compactPart && compactPart);
  if (exactPart) {
    const incomingDescription = normalizedDescription;
    const existingDescriptions = getDescriptionKeys(exactPart.description);
    if (incomingDescription && existingDescriptions.length && !existingDescriptions.includes(incomingDescription)) {
      return buildMatch(
        "same_number_different_description",
        exactPart,
        0.95,
        "Same part number found with another description. This will update the existing part, add this file name, and keep both descriptions searchable."
      );
    }
    return buildMatch("exact", exactPart, 1, `Same current part number already exists: ${exactPart.current_part_number}.`);
  }

  const oldMatch = partsState.aliases.find(alias => getPartNumberKey(alias.old_part_number) === compactPart && compactPart);
  if (oldMatch) {
    const part = findMasterPartByNumber(oldMatch.current_part_number);
    if (part) return buildMatch("old_number", part, 1, `Old number matches current part ${oldMatch.current_part_number}.`);
    return {
      type: "old_number_unlinked",
      confidence: 1,
      reason: `Known old part number ${oldMatch.old_part_number}; a current replacement has not been assigned yet.`,
      currentPartNumber: "",
      description: oldMatch.description || ""
    };
  }

  const normalizedMatch = partsState.master.find(part => getPartNumberKey(part.current_part_number) === compactPart && compactPart);
  if (normalizedMatch) return buildMatch("normalized_number", normalizedMatch, 0.98, `Same part number after removing spaces/dashes: ${normalizedMatch.current_part_number}.`);

  const descriptionMatch = partsState.master.find(part => getDescriptionKeys(part.description).includes(normalizedDescription) && normalizedDescription);
  if (descriptionMatch) return buildMatch("description_match", descriptionMatch, 1, `Description already exists under current part ${descriptionMatch.current_part_number}.`);

  const oldDescriptionMatch = partsState.aliases.find(alias =>
    getDescriptionKeys(alias.description).includes(normalizedDescription) && normalizedDescription
  );
  if (oldDescriptionMatch) {
    const linkedPart = findMasterPartByNumber(oldDescriptionMatch.current_part_number);
    if (linkedPart) return buildMatch("old_description_match", linkedPart, 1, `Description matches old part number ${oldDescriptionMatch.old_part_number}, linked to current part ${linkedPart.current_part_number}.`);
    return {
      type: "old_description_unlinked",
      confidence: 1,
      reason: `Description matches known old part number ${oldDescriptionMatch.old_part_number}; its current replacement is not assigned.`,
      currentPartNumber: "",
      description: oldDescriptionMatch.description || ""
    };
  }

  const fuzzy = findFuzzyDescriptionMatch(normalizedDescription);
  const fuzzyOld = findFuzzyOldDescriptionMatch(normalizedDescription);
  if (fuzzyOld && (!fuzzy || fuzzyOld.score > fuzzy.score)) {
    const linkedPart = findMasterPartByNumber(fuzzyOld.alias.current_part_number);
    if (linkedPart) return buildMatch("suggested", linkedPart, fuzzyOld.score, `Description looks similar to old part ${fuzzyOld.alias.old_part_number}, linked to current part ${linkedPart.current_part_number}.`);
    return {
      type: "old_description_unlinked",
      confidence: fuzzyOld.score,
      reason: `Description looks similar to known old part ${fuzzyOld.alias.old_part_number}; its current replacement is not assigned.`,
      currentPartNumber: "",
      description: fuzzyOld.alias.description || ""
    };
  }
  if (fuzzy) return buildMatch("suggested", fuzzy.part, fuzzy.score, `Description looks similar to current part ${fuzzy.part.current_part_number}: "${fuzzy.part.description || "blank"}".`);

  return { type: "new_part", confidence: 0, reason: "No existing match found", currentPartNumber: "", description: "" };
}

function buildMatch(type, part, confidence, reason) {
  return {
    type,
    confidence,
    reason,
    currentPartNumber: part?.current_part_number || "",
    description: part?.description || ""
  };
}

function findFuzzyDescriptionMatch(normalizedDescription) {
  if (!normalizedDescription) return null;
  let best = null;
  partsState.master.forEach(part => {
    getDescriptionKeys(part.description).forEach(candidate => {
      const score = diceCoefficient(normalizedDescription, candidate);
      if (score >= DESCRIPTION_MATCH_THRESHOLD && (!best || score > best.score)) best = { part, score };
    });
  });
  return best;
}

function findFuzzyOldDescriptionMatch(normalizedDescription) {
  if (!normalizedDescription) return null;
  let best = null;
  partsState.aliases.forEach(alias => {
    getDescriptionKeys(alias.description).forEach(candidate => {
      const score = diceCoefficient(normalizedDescription, candidate);
      if (score >= DESCRIPTION_MATCH_THRESHOLD && (!best || score > best.score)) best = { alias, score };
    });
  });
  return best;
}

function getPreviewStatus(match, source) {
  if (match.type === "conflict") return "conflict";
  if (match.type === "same_number_different_description") return "active";
  if (match.type === "suggested") return "needs_review";
  if (["old_number_unlinked", "old_description_unlinked"].includes(match.type)) return "needs_review";
  if (match.type === "new_part" && source.old_part_number && !source.current_part_number) return "needs_review";
  return match.type === "new_part" ? "new" : "active";
}

function renderImportPreview() {
  const rows = partsState.previewRows;
  const uniqueParts = new Set(rows.map(getPreviewCurrentPartKey).filter(Boolean));
  const exactCount = rows.filter(row => ["exact", "same_number_different_description"].includes(row.match_type)).length;
  const oldCount = rows.filter(row => row.match_type === "old_number").length;
  const mergeCount = rows.filter(row => row.match_type === "same_number_different_description").length;
  const reviewCount = rows.filter(row => row.status === "needs_review" || row.status === "conflict").length;

  setText(
    "partsPreviewSummary",
    `${partsState.previewFileName}: ${rows.length} rows found, ${uniqueParts.size} unique parts. ${exactCount} existing match(es), ${oldCount} old-number match(es), ${mergeCount} description update(s), ${reviewCount} row(s) need review.`
  );

  const table = document.getElementById("partsPreviewTable");
  if (!table) return;

  table.innerHTML = rows.length
    ? `
      <div class="parts-preview-list">
        ${rows.map(row => renderPreviewRowCard(row)).join("")}
      </div>
    `
    : `<div class="parts-empty-state">No importable rows found. The PDF may need OCR or the workbook may need different column mapping.</div>`;

  table.querySelectorAll("[data-preview-include]").forEach(input => {
    input.addEventListener("change", () => {
      const row = partsState.previewRows.find(item => item.id === input.dataset.previewInclude);
      if (row) row.include = input.checked;
      input.closest(".parts-preview-row")?.classList.toggle("excluded", !input.checked);
      updatePreviewSelectionButton();
    });
  });
  table.querySelectorAll("[data-preview-field]").forEach(input => {
    input.addEventListener("input", () => {
      const row = partsState.previewRows.find(item => item.id === input.dataset.id);
      if (!row) return;
      row[input.dataset.previewField] = input.value;
      row.source[input.dataset.previewField] = input.value;
    });
  });

  updatePreviewSelectionButton();
}

function renderPreviewRowCard(row) {
  const context = [
    row.file_name || partsState.previewFileName,
    row.page ? `Page ${row.page}` : "",
    row.drawing_number ? `Drawing ${row.drawing_number}` : "",
    row.item_number ? `Item ${row.item_number}` : ""
  ].filter(Boolean).join(" | ") || "Excel row";
  const confidence = Math.round((Number(row.confidence) || 0) * 100);
  const suggestion = row.suggested_current_part_number
    ? `<span>Suggested: <strong>${escapeHTML(row.suggested_current_part_number)}</strong></span>`
    : "";
  const existingDetail = getPreviewExistingDetail(row);

  return `
    <article class="parts-preview-row ${row.include ? "" : "excluded"}">
      <label class="parts-preview-include">
        <input type="checkbox" data-preview-include="${row.id}" ${row.include ? "checked" : ""} />
        <span>Import</span>
      </label>

      <div class="parts-preview-main">
        <div class="parts-preview-row-header">
          <strong>${escapeHTML(context)}</strong>
          <div class="parts-preview-badges">
            <span class="parts-badge ${getBadgeClass(row.match_type)}">${escapeHTML(labelize(row.match_type))}</span>
          </div>
        </div>

        <div class="parts-preview-fields">
          <label>
            <span>Part Number</span>
            <input data-preview-field="extracted_part_number" data-id="${row.id}" value="${escapeAttr(row.extracted_part_number)}" />
          </label>
          <label>
            <span>Description</span>
            <input data-preview-field="description" data-id="${row.id}" value="${escapeAttr(row.description)}" />
          </label>
          <label>
            <span>Qty</span>
            <input data-preview-field="quantity" data-id="${row.id}" value="${escapeAttr(row.quantity)}" />
          </label>
        </div>

        <div class="parts-preview-note">
          ${suggestion}
          <span>${escapeHTML(row.reason || "Ready to import")}</span>
          ${existingDetail}
          <span>${confidence}% confidence</span>
        </div>
      </div>
    </article>
  `;
}

function getPreviewExistingDetail(row) {
  if (!row.suggested_current_part_number && !row.suggested_description) return "";
  const details = [
    row.suggested_current_part_number ? `Part ${row.suggested_current_part_number}` : "",
    row.suggested_description ? row.suggested_description : ""
  ].filter(Boolean).join(" - ");
  return details ? `<span>Existing: <strong>${escapeHTML(details)}</strong></span>` : "";
}

function openPartsPreview(title) {
  setText("partsPreviewTitle", title);
  const fileInput = document.getElementById("partsPreviewFileName");
  if (fileInput) fileInput.value = partsState.previewFileName || "";
  updatePartsCancelButton();
  const log = document.getElementById("partsImportLog");
  if (log) log.innerHTML = "";
  document.getElementById("partsPreviewModal")?.classList.remove("hidden");
  document.getElementById("partsColumnMapping")?.classList.add("hidden");
  renderImportPreview();
}

function closePartsPreview() {
  document.getElementById("partsPreviewModal")?.classList.add("hidden");
  partsState.isProcessing = false;
  updatePartsCancelButton();
}

function cancelPartsPreviewProcessing() {
  if (partsState.isProcessing) {
    partsState.cancelImport = true;
    updatePartsProgress("Canceling after current page...", null);
    return;
  }

  closePartsPreview();
}

function updatePartsCancelButton() {
  const button = document.getElementById("partsCancelImportButton");
  if (button) button.textContent = partsState.isProcessing ? "Cancel Processing" : "Close";
}

function updatePartsProgress(label, percent) {
  setText("partsProgressLabel", label);
  const bar = document.getElementById("partsProgressBar");
  if (bar && percent != null) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function addPartsImportLog(message) {
  const log = document.getElementById("partsImportLog");
  if (!log || !message) return;
  const item = document.createElement("div");
  item.textContent = message;
  log.appendChild(item);
  log.scrollTop = log.scrollHeight;
}

function setPreviewIncluded(include) {
  partsState.previewRows.forEach(row => { row.include = include; });
  renderImportPreview();
}

function togglePreviewSelection() {
  const shouldSelectAll = partsState.previewRows.some(row => !row.include);
  setPreviewIncluded(shouldSelectAll);
}

function updatePreviewSelectionButton() {
  const button = document.getElementById("partsSelectAllButton");
  if (!button) return;

  const hasRows = partsState.previewRows.length > 0;
  const allSelected = hasRows && partsState.previewRows.every(row => row.include);
  button.textContent = allSelected ? "Deselect All" : "Select All";
  button.disabled = !hasRows;
}

async function savePartsImportPreview() {
  if (!ensurePartsUnlocked()) return;
  const rows = partsState.previewRows.filter(row => row.include);
  if (!rows.length) {
    showPartsError("Select at least one row to import.", "Nothing Selected");
    return;
  }

  const importRecord = buildImportHistoryRecord(rows);
  const changed = {
    master: [],
    aliases: [],
    usage: [],
    reviews: [],
    history: [importRecord]
  };

  rows.forEach(row => applyPreviewRow(row, importRecord.id, changed));
  partsState.history.unshift(importRecord);
  saveLocalPartsDatabase("shared", { pendingSync: true });
  addPartsImportLog(`Saved ${rows.length} row(s) to this browser.`);
  const synced = await persistPartsChanges(changed);
  saveLocalPartsDatabase("shared", { pendingSync: !synced });
  if (!synced) {
    renderPartsDatabase();
    await showPartsError(
      "The import was saved in this browser, but it did not save to Supabase. Other users will not see it yet. Check the import log above for the Supabase table error.",
      "Shared Save Failed"
    );
    return;
  }
  closePartsPreview();
  renderPartsDatabase();
  setPartsStatus(`Imported ${rows.length} row(s) from ${partsState.previewFileName} and saved to Supabase.`);
}

function buildImportHistoryRecord(rows) {
  const now = nowISO();
  return {
    id: makeId("import"),
    file_name: getImportHistoryFileNames(rows),
    import_type: partsState.previewType,
    row_count: rows.length,
    unique_parts_count: new Set(rows.map(getPreviewCurrentPartKey).filter(Boolean)).size,
    exact_match_count: rows.filter(row => ["exact", "same_number_different_description"].includes(row.match_type)).length,
    old_number_match_count: rows.filter(row => row.match_type === "old_number").length,
    suggested_match_count: rows.filter(row => ["suggested", "description_match"].includes(row.match_type)).length,
    review_count: rows.filter(row => row.status === "needs_review" || row.status === "conflict").length,
    status: "imported",
    created_at: now,
    updated_at: now
  };
}

function getImportHistoryFileNames(rows) {
  const fileNames = uniqueByNormalizedText(
    rows.map(row => row.file_name || partsState.previewFileName),
    value => normalizeSearch(value)
  );
  return fileNames.join("\n") || partsState.previewFileName;
}

function getPreviewCurrentPartKey(row) {
  if (row.current_part_number) return getPartNumberKey(row.current_part_number);
  if (!row.source?.old_part_number && isCurrentPartNumberCandidate(row.extracted_part_number)) {
    return getPartNumberKey(row.extracted_part_number);
  }
  return "";
}

function applyPreviewRow(row, importId, changed) {
  const source = row.source;
  const now = nowISO();
  const currentPartNumber = row.current_part_number || (source.old_part_number ? "" : row.extracted_part_number);
  const existing = findMasterPartByNumber(currentPartNumber);

  if (row.status === "conflict" || row.status === "needs_review" || row.match_type === "suggested") {
    const review = {
      id: makeId("review"),
      extracted_part_number: row.extracted_part_number,
      extracted_description: row.description,
      suggested_current_part_number: row.suggested_current_part_number,
      suggested_description: row.suggested_description,
      match_type: row.match_type,
      confidence: row.confidence,
      source_file: row.file_name,
      page: row.page,
      reason: row.reason,
      status: "needs_review",
      created_at: now,
      updated_at: now
    };
    partsState.reviews.unshift(review);
    changed.reviews.push(review);
  }

  let part = existing;
  if (part && row.status !== "conflict" && row.status !== "needs_review" && row.match_type !== "suggested") {
    mergeExistingPartFromImport(part, row, source, now, changed);
  }

  if (!part && currentPartNumber && row.status !== "conflict" && row.status !== "needs_review" && row.match_type !== "suggested") {
    part = {
      id: makeId("part"),
      current_part_number: currentPartNumber,
      normalized_part_number: normalizePartNumber(currentPartNumber),
      compact_part_number: compactPartNumber(currentPartNumber),
      description: row.description,
      normalized_description: normalizeDescription(row.description),
      category: getPartNumberCategoryInfo(currentPartNumber).group,
      manufacturer: source.manufacturer || "",
      manufacturer_part_number: source.manufacturer_part_number || "",
      unit_of_measure: source.unit_of_measure || "",
      source: source.source || partsState.previewType,
      status: row.status === "new" ? "new" : "active",
      needs_review: row.status === "needs_review",
      record_type: source.record_type || "Part",
      referenced_drawing_number: source.referenced_drawing_number || "",
      created_at: now,
      updated_at: now
    };
    partsState.master.unshift(part);
    changed.master.push(part);
  }

  if (source.old_part_number && part) {
    const existingAlias = partsState.aliases.find(alias =>
      getPartNumberKey(alias.old_part_number) === getPartNumberKey(source.old_part_number) &&
      getPartNumberKey(alias.current_part_number) === getPartNumberKey(part.current_part_number)
    );
    if (existingAlias) {
      let aliasChanged = false;
      const nextAliasSource = mergeFileNameLabels(existingAlias.source, row.file_name || source.source || partsState.previewFileName || partsState.previewType);
      if (nextAliasSource !== (existingAlias.source || "")) {
        existingAlias.source = nextAliasSource;
        aliasChanged = true;
      }
      const nextAliasDescription = mergePartDescriptions(existingAlias.description, row.description);
      if (nextAliasDescription !== (existingAlias.description || "")) {
        existingAlias.description = nextAliasDescription;
        aliasChanged = true;
      }
      if (aliasChanged) {
        existingAlias.updated_at = now;
        if (!changed.aliases.some(row => row.id === existingAlias.id)) {
          changed.aliases.push(existingAlias);
        }
      }
    } else {
      const alias = {
        id: makeId("alias"),
        part_id: part.id,
        old_part_number: source.old_part_number,
        current_part_number: part.current_part_number,
        description: row.description,
        match_type: row.match_type === "old_number" ? "old_number" : "imported",
        source: source.source || partsState.previewType,
        notes: "",
        created_at: now,
        updated_at: now
      };
      partsState.aliases.unshift(alias);
      changed.aliases.push(alias);
    }
  }

  if (source.old_part_number && !part) {
    const oldKey = getPartNumberKey(source.old_part_number);
    let alias = partsState.aliases.find(item => getPartNumberKey(item.old_part_number) === oldKey);
    if (alias) {
      const nextSource = mergeFileNameLabels(alias.source, row.file_name || source.source || partsState.previewFileName || partsState.previewType);
      const nextDescription = mergePartDescriptions(alias.description, row.description);
      if (nextSource !== alias.source || nextDescription !== alias.description) {
        alias.source = nextSource;
        alias.description = nextDescription;
        alias.updated_at = now;
        changed.aliases.push(alias);
      }
    } else {
      alias = {
        id: makeId("alias"),
        part_id: null,
        old_part_number: source.old_part_number,
        current_part_number: "",
        description: row.description,
        match_type: "unlinked_old_number",
        source: row.file_name || source.source || partsState.previewFileName || partsState.previewType,
        notes: "Current replacement not assigned yet.",
        created_at: now,
        updated_at: now
      };
      partsState.aliases.unshift(alias);
      changed.aliases.push(alias);
    }
  }

  if (partsState.previewType === "drawing_pdf") {
    const usageKey = getUsageLocationKey({
      current_part_number: part?.current_part_number || row.suggested_current_part_number || "",
      extracted_part_number: row.extracted_part_number,
      drawing_number: source.drawing_number || "",
      item_number: row.item_number,
      pdf_file_name: row.file_name,
      pdf_page_number: row.page
    });
    const usageExists = partsState.usage.some(existing => getUsageLocationKey(existing) === usageKey);
    if (usageExists) return;

    const usage = {
      id: makeId("usage"),
      part_id: part?.id || null,
      current_part_number: part?.current_part_number || row.suggested_current_part_number || "",
      extracted_part_number: row.extracted_part_number,
      description: row.description,
      drawing_number: source.drawing_number || "",
      drawing_name: source.drawing_name || "",
      item_number: row.item_number,
      quantity: row.quantity,
      pdf_file_name: row.file_name,
      pdf_page_number: row.page,
      source_import_id: importId,
      referenced_drawing_number: source.referenced_drawing_number || "",
      record_type: source.record_type || "Part",
      created_at: now,
      updated_at: now
    };
    partsState.usage.unshift(usage);
    changed.usage.push(usage);
  }
}

function mergeExistingPartFromImport(part, row, source, now, changed) {
  let didChange = false;
  const nextSource = mergeFileNameLabels(part.source, row.file_name || source.source || partsState.previewFileName || partsState.previewType);
  if (nextSource !== (part.source || "")) {
    part.source = nextSource;
    didChange = true;
  }

  const nextDescription = mergePartDescriptions(part.description, row.description);
  if (nextDescription !== (part.description || "")) {
    part.description = nextDescription;
    part.normalized_description = normalizeDescription(nextDescription);
    didChange = true;
  }

  if (!didChange) return;
  part.updated_at = now;
  if (!changed.master.some(row => row.id === part.id)) {
    changed.master.push(part);
  }
}

function mergePartDescriptions(existingDescription, incomingDescription) {
  const descriptions = uniqueByNormalizedText([
    ...getMultilineValues(existingDescription),
    ...getMultilineValues(incomingDescription)
  ], normalizeDescription);
  return descriptions.join("\n");
}

function mergeFileNameLabels(existingValue, incomingValue) {
  const labels = uniqueByNormalizedText([
    ...getMultilineValues(existingValue),
    ...getMultilineValues(incomingValue)
  ], value => normalizeSearch(value));
  return labels.join("\n");
}

function getFileNameLabels(value) {
  return getMultilineValues(value);
}

function getDescriptionKeys(value) {
  return getMultilineValues(value)
    .map(normalizeDescription)
    .filter(Boolean);
}

function getMultilineValues(value) {
  return String(value || "")
    .split(/\s*(?:\r?\n|\|)\s*/)
    .map(label => label.trim())
    .filter(Boolean);
}

function uniqueByNormalizedText(values, normalize) {
  const seen = new Set();
  return values
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .filter(value => {
      const key = normalize(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function rowMatchesFileName(row, fileName) {
  return Object.values(row).some(value => getFileNameLabels(value).includes(fileName));
}

function getUsageLocationKey(row) {
  return [
    normalizePartNumber(row.current_part_number || row.extracted_part_number),
    normalizePartNumber(row.extracted_part_number),
    normalizeSearch(row.drawing_number),
    normalizeSearch(row.item_number),
    normalizeSearch(row.pdf_file_name),
    String(row.pdf_page_number || "")
  ].join("|");
}

async function persistPartsChanges(changed) {
  if (!hasSupabaseParts()) {
    addPartsImportLog("Shared save skipped because the Parts Library is not connected to a logged-in Supabase session.");
    queueFailedPartsChanges(changed);
    setPartsSaveState("local");
    return false;
  }

  const steps = [
    { table: PARTS_TABLES.master, rows: changed.master, label: "current parts" },
    { table: PARTS_TABLES.aliases, rows: changed.aliases, label: "old part numbers" },
    { table: PARTS_TABLES.history, rows: changed.history, label: "import history" },
    { table: PARTS_TABLES.usage, rows: changed.usage, label: "drawing usage records" },
    { table: PARTS_TABLES.reviews, rows: changed.reviews, label: "review records" }
  ];
  const totalRows = steps.reduce((sum, step) => sum + getArrayLength(step.rows), 0);
  let synced = true;
  let savedRows = 0;

  setPartsSaveState("saving");
  setPartsStatus(`Saving ${totalRows} record${totalRows === 1 ? "" : "s"} to the shared Parts Library...`);
  addPartsImportLog(`Saving ${totalRows} record${totalRows === 1 ? "" : "s"} to Supabase.`);

  for (const [index, step] of steps.entries()) {
    const rowCount = getArrayLength(step.rows);
    if (!rowCount) {
      addPartsImportLog(`Skipped ${step.label}: no changes to save.`);
      continue;
    }

    setPartsStatus(`Saving ${step.label} (${rowCount} record${rowCount === 1 ? "" : "s"})... Step ${index + 1} of ${steps.length}.`);
    addPartsImportLog(`Saving ${step.label}: ${rowCount} record${rowCount === 1 ? "" : "s"}.`);
    const result = await upsertSupabaseRows(step.table, step.rows);
    if (result === false) {
      synced = false;
      addPartsImportLog(`Stopped while saving ${step.label}.`);
      break;
    }

    savedRows += rowCount;
    setPartsStatus(`Saved ${savedRows} of ${totalRows} shared record${totalRows === 1 ? "" : "s"}...`);
    addPartsImportLog(`Saved ${step.label}.`);
    await pauseForPartsStatusUpdate();
  }

  if (synced && hasSupabaseParts()) {
    removeQueuedPartsChanges(changed);
    const pending = getPartsRetryQueueSize() > 0;
    saveLocalPartsDatabase("shared", { pendingSync: pending, preserveSaveState: true });
    setPartsSaveState(pending ? "failed" : "shared");
    setPartsStatus(`Saved ${savedRows} record${savedRows === 1 ? "" : "s"} to the shared Parts Library.`);
    addPartsImportLog("Saved to shared Parts Library.");
  } else {
    queueFailedPartsChanges(changed);
  }
  return synced;
}

function pauseForPartsStatusUpdate() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function handlePartsAction(action, id) {
  if (!ensurePartsUnlocked()) return;
  if (action.startsWith("edit:")) return openPartsEditModal(action.split(":")[1], id);
  if (action.startsWith("delete:")) return deletePartsRecord(action.split(":")[1], id);
  if (action === "usage") {
    const part = partsState.master.find(row => row.id === id);
    partsState.activeTab = "usage";
    document.getElementById("partsSearchInput").value = part?.current_part_number || "";
    renderPartsDatabase();
    return;
  }
  if (action === "aliases") {
    const part = partsState.master.find(row => row.id === id);
    partsState.activeTab = "aliases";
    document.getElementById("partsSearchInput").value = part?.current_part_number || "";
    renderPartsDatabase();
    return;
  }
  if (action.endsWith("-review")) return handleReviewAction(action, id);
}

async function deletePartsRecord(tab, id) {
  const deletePlan = buildPartsDeletePlan(tab, [id]);
  const confirmed = await showPartsMessage(
    "Delete Record",
    getDeletePlanMessage(deletePlan, "Delete this record from the Parts Library?"),
    {
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger"
    }
  );
  if (!confirmed) return;
  const historyEntry = capturePartsDeleteHistory(deletePlan, "Delete record");
  await applyPartsDeletePlan(deletePlan);
  recordPartsDeleteHistory(historyEntry);
  setPartsStatus(getDeletePlanStatus(deletePlan));
  renderPartsDatabase();
}

async function deleteSelectedPartsRecords() {
  if (!ensurePartsUnlocked()) return;
  const tab = partsState.activeTab;
  const selected = getSelectedPartsSet(tab);
  const ids = [...selected];
  if (!ids.length) return;
  const deletePlan = buildPartsDeletePlan(tab, ids);

  const confirmed = await showPartsMessage(
    "Delete Selected Records",
    getDeletePlanMessage(deletePlan, `Delete ${ids.length} selected record${ids.length === 1 ? "" : "s"} from the Parts Library?`),
    {
      confirmText: "Delete Selected",
      cancelText: "Cancel",
      variant: "danger"
    }
  );
  if (!confirmed) return;

  const historyEntry = capturePartsDeleteHistory(deletePlan, `Delete ${ids.length} selected records`);
  await applyPartsDeletePlan(deletePlan);
  recordPartsDeleteHistory(historyEntry);
  setPartsStatus(getDeletePlanStatus(deletePlan));
  renderPartsDatabase();
}

function buildPartsDeletePlan(tab, ids) {
  const plan = {
    deleteIds: {
      master: new Set(),
      aliases: new Set(),
      usage: new Set(),
      reviews: new Set(),
      history: new Set()
    },
    updateRows: {
      master: new Map(),
      aliases: new Map()
    },
    removedFileNames: new Set()
  };

  ids.forEach(id => addRecordToDeletePlan(plan, tab, id));
  return plan;
}

function clonePartsHistoryRow(row) {
  return row ? JSON.parse(JSON.stringify(row)) : row;
}

function capturePartsDeleteHistory(plan, label) {
  const deletedRows = {};
  const previousRows = {};

  Object.entries(plan.deleteIds).forEach(([tab, ids]) => {
    deletedRows[tab] = [...ids]
      .map(id => partsState[tab]?.find(row => row.id === id))
      .filter(Boolean)
      .map(clonePartsHistoryRow);
  });

  Object.entries(plan.updateRows).forEach(([tab, rows]) => {
    previousRows[tab] = [...rows.keys()]
      .map(id => partsState[tab]?.find(row => row.id === id))
      .filter(Boolean)
      .map(clonePartsHistoryRow);
  });

  return { label, plan, deletedRows, previousRows };
}

function recordPartsDeleteHistory(entry) {
  partsUndoStack.push(entry);
  if (partsUndoStack.length > PARTS_HISTORY_LIMIT) partsUndoStack.shift();
  partsRedoStack.length = 0;
  updatePartsUndoRedoControls();
}

function updatePartsUndoRedoControls() {
  const undoButton = document.getElementById("partsUndoButton");
  const redoButton = document.getElementById("partsRedoButton");
  if (undoButton) {
    undoButton.disabled = partsUndoStack.length === 0;
    undoButton.textContent = partsUndoStack.length ? `Undo ${partsUndoStack.at(-1).label}` : "Undo";
  }
  if (redoButton) {
    redoButton.disabled = partsRedoStack.length === 0;
    redoButton.textContent = partsRedoStack.length ? `Redo ${partsRedoStack.at(-1).label}` : "Redo";
  }
}

async function undoPartsAction() {
  if (!ensurePartsUnlocked() || !partsUndoStack.length) return;
  const entry = partsUndoStack.pop();
  const restored = { master: [], aliases: [], usage: [], reviews: [], history: [] };

  Object.entries(entry.deletedRows).forEach(([tab, rows]) => {
    rows.forEach(savedRow => {
      const row = clonePartsHistoryRow(savedRow);
      const index = partsState[tab].findIndex(item => item.id === row.id);
      if (index >= 0) partsState[tab][index] = row;
      else partsState[tab].push(row);
      restored[tab].push(row);
    });
  });

  Object.entries(entry.previousRows).forEach(([tab, rows]) => {
    rows.forEach(savedRow => {
      const row = clonePartsHistoryRow(savedRow);
      const index = partsState[tab].findIndex(item => item.id === row.id);
      if (index >= 0) partsState[tab][index] = row;
      else partsState[tab].push(row);
      if (!restored[tab].some(item => item.id === row.id)) restored[tab].push(row);
    });
  });

  saveLocalPartsDatabase();
  await persistPartsChanges(restored);
  partsRedoStack.push(entry);
  setPartsStatus(`${entry.label} was undone. Related records were restored.`);
  renderPartsDatabase();
}

async function redoPartsAction() {
  if (!ensurePartsUnlocked() || !partsRedoStack.length) return;
  const entry = partsRedoStack.pop();
  await applyPartsDeletePlan(entry.plan);
  partsUndoStack.push(entry);
  setPartsStatus(`${entry.label} was redone.`);
  renderPartsDatabase();
}

function addRecordToDeletePlan(plan, tab, id) {
  const row = partsState[tab]?.find(item => item.id === id);
  if (!row || plan.deleteIds[tab]?.has(id)) return;

  plan.deleteIds[tab].add(id);

  if (tab === "master") {
    addCurrentPartRelatedDeletes(plan, row);
    return;
  }

  if (tab === "aliases") {
    addOldPartRelatedDeletes(plan, row);
    return;
  }

  if (tab === "usage") {
    return;
  }

  if (tab === "reviews") {
    return;
  }

  if (tab === "history") {
    addImportHistoryRelatedDeletes(plan, row);
  }
}

function addOldPartRelatedDeletes(plan, alias) {
  const oldKey = getPartNumberKey(alias.old_part_number);
  const currentKey = getPartNumberKey(alias.current_part_number);
  partsState.reviews.forEach(review => {
    const reviewKeys = [
      review.extracted_part_number,
      review.suggested_current_part_number
    ].map(getPartNumberKey);
    if (reviewKeys.includes(oldKey) || reviewKeys.includes(currentKey)) {
      plan.deleteIds.reviews.add(review.id);
    }
  });
}

function addCurrentPartRelatedDeletes(plan, part) {
  const partKey = getPartNumberKey(part.current_part_number);
  partsState.aliases.forEach(alias => {
    if (alias.part_id === part.id || getPartNumberKey(alias.current_part_number) === partKey) {
      plan.deleteIds.aliases.add(alias.id);
    }
  });
  partsState.usage.forEach(usage => {
    if (usage.part_id === part.id || getPartNumberKey(usage.current_part_number) === partKey) {
      plan.deleteIds.usage.add(usage.id);
    }
  });
  partsState.reviews.forEach(review => {
    const reviewKeys = [
      review.extracted_part_number,
      review.suggested_current_part_number
    ].map(getPartNumberKey);
    if (reviewKeys.includes(partKey)) {
      plan.deleteIds.reviews.add(review.id);
    }
  });
}

function addImportHistoryRelatedDeletes(plan, historyRow) {
  const fileNames = getHistoryFileNames(historyRow.file_name);
  fileNames.forEach(fileName => plan.removedFileNames.add(fileName));

  partsState.usage.forEach(usage => {
    if (usage.source_import_id === historyRow.id || fileNames.some(fileName => getFileNameLabels(usage.pdf_file_name).includes(fileName))) {
      plan.deleteIds.usage.add(usage.id);
    }
  });

  partsState.reviews.forEach(review => {
    if (fileNames.some(fileName => getFileNameLabels(review.source_file).includes(fileName))) {
      plan.deleteIds.reviews.add(review.id);
    }
  });

  cleanupFileReferencesForHistoryDelete(plan, fileNames);
}

function getHistoryFileNames(value) {
  const text = String(value || "").trim();
  const summaryMatch = text.match(/^\d+\s+files:\s*(.+)$/i);
  if (summaryMatch) {
    return summaryMatch[1]
      .split(/\s*,\s*/)
      .map(fileName => fileName.trim())
      .filter(Boolean);
  }
  return getFileNameLabels(text);
}

function cleanupFileReferencesForHistoryDelete(plan, fileNames) {
  if (!fileNames.length) return;

  partsState.master.forEach(part => {
    const remainingSources = getFileNameLabels(part.source).filter(fileName => !fileNames.includes(fileName));
    if (!remainingSources.length && fileNames.some(fileName => getFileNameLabels(part.source).includes(fileName))) {
      addRecordToDeletePlan(plan, "master", part.id);
      return;
    }
    if (remainingSources.length !== getFileNameLabels(part.source).length) {
      plan.updateRows.master.set(part.id, {
        ...part,
        source: remainingSources.join("\n"),
        updated_at: nowISO()
      });
    }
  });

  partsState.aliases.forEach(alias => {
    const remainingSources = getFileNameLabels(alias.source).filter(fileName => !fileNames.includes(fileName));
    if (!remainingSources.length && fileNames.some(fileName => getFileNameLabels(alias.source).includes(fileName))) {
      plan.deleteIds.aliases.add(alias.id);
      return;
    }
    if (remainingSources.length !== getFileNameLabels(alias.source).length) {
      plan.updateRows.aliases.set(alias.id, {
        ...alias,
        source: remainingSources.join("\n"),
        updated_at: nowISO()
      });
    }
  });
}

async function applyPartsDeletePlan(plan) {
  Object.entries(plan.updateRows).forEach(([tab, rows]) => {
    rows.forEach(row => {
      if (plan.deleteIds[tab]?.has(row.id)) return;
      const index = partsState[tab].findIndex(item => item.id === row.id);
      if (index >= 0) partsState[tab][index] = row;
    });
  });

  Object.entries(plan.deleteIds).forEach(([tab, ids]) => {
    if (!ids.size) return;
    const idSet = new Set(ids);
    partsState[tab] = (partsState[tab] || []).filter(row => !idSet.has(row.id));
  });

  Object.keys(partsState.selected).forEach(tab => {
    const selected = getSelectedPartsSet(tab);
    plan.deleteIds[tab]?.forEach(id => selected.delete(id));
  });

  saveLocalPartsDatabase();

  if (!hasSupabaseParts()) return;

  const deletes = Object.entries(plan.deleteIds).flatMap(([tab, ids]) =>
    [...ids].map(id => deleteSupabaseRow(PARTS_TABLES[tab], id))
  );
  const updates = Object.entries(plan.updateRows).flatMap(([tab, rows]) => {
    const keptRows = [...rows.values()].filter(row => !plan.deleteIds[tab]?.has(row.id));
    return keptRows.length ? [upsertSupabaseRows(PARTS_TABLES[tab], keptRows)] : [];
  });

  const results = await Promise.all([...deletes, ...updates]);
  const synced = results.every(result => result !== false);
  saveLocalPartsDatabase("shared", { pendingSync: !synced });
  if (!synced) {
    await showPartsError(
      "The delete was saved in this browser, but it did not save to Supabase. Other users may still see the old records until shared saving is fixed.",
      "Shared Delete Failed"
    );
  }
}

function getDeletePlanMessage(plan, fallback) {
  const parts = getDeletePlanParts(plan);
  if (!parts.length) return fallback;
  return `${fallback}\n\nThis will also remove/update related records:\n${parts.map(part => `- ${part}`).join("\n")}`;
}

function getDeletePlanStatus(plan) {
  const totalDeleted = Object.values(plan.deleteIds).reduce((sum, ids) => sum + ids.size, 0);
  const totalUpdated = Object.values(plan.updateRows).reduce((sum, rows) => sum + rows.size, 0);
  const updateText = totalUpdated ? ` and updated ${totalUpdated} related record${totalUpdated === 1 ? "" : "s"}` : "";
  return `Deleted ${totalDeleted} record${totalDeleted === 1 ? "" : "s"}${updateText}.`;
}

function getDeletePlanParts(plan) {
  const labels = {
    master: "current part",
    aliases: "old part number",
    usage: "drawing usage",
    reviews: "item to check",
    history: "import history"
  };
  const parts = Object.entries(plan.deleteIds)
    .filter(([, ids]) => ids.size)
    .map(([tab, ids]) => `${ids.size} ${labels[tab]} record${ids.size === 1 ? "" : "s"}`);
  const updated = Object.values(plan.updateRows).reduce((sum, rows) => sum + rows.size, 0);
  if (updated) parts.push(`${updated} file-name reference${updated === 1 ? "" : "s"} updated`);
  return parts;
}

async function handleReviewAction(action, id) {
  const review = partsState.reviews.find(row => row.id === id);
  if (!review) return;
  let approvedReviewLongNumber = false;
  if (action === "new-review" && isLongPartNumberExceptionCandidate(review.extracted_part_number)) {
    approvedReviewLongNumber = await showPartsMessage(
      "Approve Part Number Exception",
      `Create ${review.extracted_part_number} as a Current Part even though it contains more than eight digits?`,
      { confirmText: "Create as Exception", cancelText: "Cancel" }
    );
    if (!approvedReviewLongNumber) return;
  }
  const countsBefore = getPartsReviewActionCounts();
  const relatedReviews = getRelatedReviewRows(review, action);
  let changedUsage = [];
  let savePromise = null;
  let reusedExistingPart = false;
  let reusedExistingOldNumber = false;
  if (action === "ignore-review") {
    review.status = "ignored";
    review.updated_at = nowISO();
    savePromise = persistPartsChanges({ master: [], aliases: [], usage: [], reviews: [review], history: [] });
  } else if (action === "old-review") {
    const oldKey = getPartNumberKey(review.extracted_part_number);
    let alias = partsState.aliases.find(row => getPartNumberKey(row.old_part_number) === oldKey);
    if (alias) {
      reusedExistingOldNumber = true;
      alias.description = alias.description || review.extracted_description;
      alias.source = mergeFileNameLabels(alias.source, relatedReviews.map(row => row.source_file).join("\n"));
      alias.updated_at = nowISO();
    } else {
      alias = {
        id: makeId("alias"),
        part_id: null,
        old_part_number: review.extracted_part_number,
        current_part_number: "",
        description: review.extracted_description,
        match_type: "old_number_only",
        source: relatedReviews.map(row => row.source_file).filter(Boolean).join("\n"),
        notes: review.reason,
        created_at: nowISO(),
        updated_at: nowISO()
      };
      partsState.aliases.unshift(alias);
    }
    markReviewGroupResolved(relatedReviews, "accepted");
    savePromise = persistPartsChanges({ master: [], aliases: [alias], usage: [], reviews: relatedReviews, history: [] });
  } else if (action === "accept-review" || action === "new-review") {
    const partNumber = action === "accept-review" ? review.suggested_current_part_number : review.extracted_part_number;
    let approvedPart = findMasterPartByNumber(partNumber);
    reusedExistingPart = !!approvedPart;
    const changedMaster = [];
    if (!approvedPart) {
      const part = createPartFromReview(review, partNumber);
      if (approvedReviewLongNumber) {
        part.status = "active";
        part.record_type = "Part Number Exception";
      }
      partsState.master.unshift(part);
      approvedPart = part;
      changedMaster.push(part);
    }
    changedUsage = linkReviewGroupUsageToPart(relatedReviews, approvedPart);
    markReviewGroupResolved(relatedReviews, "accepted");
    savePromise = persistPartsChanges({ master: changedMaster, aliases: [], usage: changedUsage, reviews: relatedReviews, history: [] });
  } else if (action === "alias-review") {
    const part = findMasterPartByNumber(review.suggested_current_part_number);
    if (!part) {
      setPartsStatus("Choose or create the suggested part before adding an old part number.");
      return;
    }
    const oldKey = getPartNumberKey(review.extracted_part_number);
    const currentKey = getPartNumberKey(part.current_part_number);
    let alias = partsState.aliases.find(row =>
      getPartNumberKey(row.old_part_number) === oldKey &&
      getPartNumberKey(row.current_part_number) === currentKey
    );
    if (alias) {
      alias.source = mergeFileNameLabels(alias.source, relatedReviews.map(row => row.source_file).join("\n"));
      alias.updated_at = nowISO();
    } else {
      alias = {
        id: makeId("alias"),
        part_id: part.id,
        old_part_number: review.extracted_part_number,
        current_part_number: part.current_part_number,
        description: review.extracted_description,
        match_type: "approved_alias",
        source: relatedReviews.map(row => row.source_file).filter(Boolean).join("\n"),
        notes: review.reason,
        created_at: nowISO(),
        updated_at: nowISO()
      };
      partsState.aliases.unshift(alias);
    }
    const incorrectCurrentPartIndex = partsState.master.findIndex(row =>
      isOldPartNumberCandidate(row.current_part_number) &&
      getPartNumberKey(row.current_part_number) === oldKey
    );
    const incorrectCurrentPart = incorrectCurrentPartIndex >= 0
      ? partsState.master.splice(incorrectCurrentPartIndex, 1)[0]
      : null;
    changedUsage = linkReviewGroupUsageToPart(relatedReviews, part);
    markReviewGroupResolved(relatedReviews, "accepted");
    savePromise = (async () => {
      const saved = await persistPartsChanges({ master: [], aliases: [alias], usage: changedUsage, reviews: relatedReviews, history: [] });
      if (incorrectCurrentPart && hasSupabaseParts()) {
        await deleteSupabaseRow(PARTS_TABLES.master, incorrectCurrentPart.id);
      }
      return saved;
    })();
  }

  // Refresh the local counters and lists before waiting for the shared save.
  saveLocalPartsDatabase();
  renderPartsSummary();
  renderPartsDatabase();

  if (savePromise) {
    try {
      await savePromise;
    } finally {
      // Re-read the live arrays after shared saving and force every summary display to refresh.
      renderPartsSummary();
      renderPartsDatabase();
    }
  }
  const additionallyResolved = autoResolveReviewsFromSavedNumbers();
  if (additionallyResolved.reviews.length || additionallyResolved.usage.length) {
    saveLocalPartsDatabase();
    await persistPartsChanges({
      master: [],
      aliases: [],
      usage: additionallyResolved.usage,
      reviews: additionallyResolved.reviews,
      history: []
    });
    renderPartsDatabase();
  }
  const countsAfter = getPartsReviewActionCounts();
  const countSummary = formatPartsReviewCountChange(countsBefore, countsAfter);
  if (relatedReviews.length > 1 && action !== "ignore-review") {
    setPartsStatus(`Resolved ${relatedReviews.length} matching review rows together. ${countSummary}`);
  } else if (action === "old-review") {
    const result = reusedExistingOldNumber
      ? "That old part number already existed, so it was reused without creating a duplicate."
      : "A new Old Part Number was added without requiring a linked Current Part.";
    setPartsStatus(`${result} ${countSummary}`);
  } else if (action === "new-review") {
    const result = reusedExistingPart
      ? "That part number already existed, so it was reused without creating a duplicate."
      : "A new Current Part was created.";
    setPartsStatus(`${result} ${countSummary}`);
  } else if (action === "alias-review") {
    setPartsStatus(`The suggested Current Part was reused and the found number was saved as its old number. ${countSummary}`);
  }
}

function getPartsReviewActionCounts() {
  return {
    current: getUniqueCurrentPartsCount(),
    old: getUniqueOldPartNumbersCount(),
    reviews: getUniqueOpenReviewCount()
  };
}

function formatPartsReviewCountChange(before, after) {
  return `Current Parts ${before.current} to ${after.current}; Old Part Numbers ${before.old} to ${after.old}; Items to Check ${before.reviews} to ${after.reviews}.`;
}

function getRelatedReviewRows(review, action) {
  if (!review || action === "ignore-review") return review ? [review] : [];
  const extractedKey = getPartNumberKey(review.extracted_part_number);
  const suggestedKey = getPartNumberKey(review.suggested_current_part_number);

  return partsState.reviews.filter(row => {
    if (["accepted", "ignored"].includes(row.status)) return false;
    if (getPartNumberKey(row.extracted_part_number) !== extractedKey) return false;
    if (action === "new-review" || action === "old-review") return true;
    return getPartNumberKey(row.suggested_current_part_number) === suggestedKey;
  });
}

function markReviewGroupResolved(reviews, status) {
  const updatedAt = nowISO();
  reviews.forEach(row => {
    row.status = status;
    row.updated_at = updatedAt;
  });
}

function linkReviewGroupUsageToPart(reviews, part) {
  const changedById = new Map();
  reviews.forEach(review => {
    linkReviewUsageToPart(review, part).forEach(row => changedById.set(row.id, row));
  });
  return [...changedById.values()];
}

function linkReviewUsageToPart(review, part) {
  if (!review || !part) return [];
  const extractedKey = getPartNumberKey(review.extracted_part_number);
  const sourceKey = normalizeSearch(review.source_file);
  const reviewPage = String(review.page ?? "").trim();

  return partsState.usage.filter(row => {
    const sameExtractedNumber = getPartNumberKey(row.extracted_part_number) === extractedKey;
    const sameSource = normalizeSearch(row.pdf_file_name) === sourceKey;
    const samePage = String(row.pdf_page_number ?? "").trim() === reviewPage;
    if (!sameExtractedNumber || !sameSource || !samePage) return false;

    row.part_id = part.id;
    row.current_part_number = part.current_part_number;
    row.description = part.description || row.description;
    row.updated_at = nowISO();
    return true;
  });
}

function createPartFromReview(review, partNumber) {
  const now = nowISO();
  return {
    id: makeId("part"),
    current_part_number: partNumber,
    normalized_part_number: normalizePartNumber(partNumber),
    compact_part_number: compactPartNumber(partNumber),
    description: review.extracted_description || review.suggested_description,
    normalized_description: normalizeDescription(review.extracted_description || review.suggested_description),
    category: getPartNumberCategoryInfo(partNumber).group,
    manufacturer: "",
    manufacturer_part_number: "",
    unit_of_measure: "",
    source: review.source_file,
    status: "active",
    needs_review: false,
    record_type: "Part",
    created_at: now,
    updated_at: now
  };
}

function openPartsEditModal(tab, id = "") {
  const row = id ? (partsState[tab] || []).find(item => item.id === id) : null;
  partsState.editTarget = { tab, id, originalRow: row ? clonePartsHistoryRow(row) : null };
  setText("partsEditTitle", row ? "Edit Record" : "Add Part");
  const destination = document.getElementById("partsEditDestination");
  if (destination) destination.value = tab;
  renderPartsEditFields(tab, row || {});
  document.getElementById("partsEditModal")?.classList.remove("hidden");
}

function renderPartsEditFields(tab, values = {}) {
  const fields = getEditableFields(tab);
  const container = document.getElementById("partsEditFields");
  if (!container) return;
  container.innerHTML = fields.map(field => `
    <label>
      <span>${escapeHTML(field.label)}</span>
      ${isMultilineEditField(field.key)
        ? `<textarea data-edit-field="${field.key}" rows="3">${escapeHTML(values?.[field.key] ?? field.defaultValue ?? "")}</textarea>`
        : `<input data-edit-field="${field.key}" value="${escapeAttr(values?.[field.key] ?? field.defaultValue ?? "")}" />`}
    </label>
  `).join("");
}

function getCurrentPartsEditValues() {
  return Object.fromEntries(Array.from(document.querySelectorAll("[data-edit-field]")).map(input => [
    input.dataset.editField,
    input.value
  ]));
}

function changePartsEditDestination(nextTab) {
  const target = partsState.editTarget;
  if (!target) return;
  const currentValues = getCurrentPartsEditValues();
  renderPartsEditFields(nextTab, mapPartsEditValues(target.tab, nextTab, { ...(target.originalRow || {}), ...currentValues }));
}

function mapPartsEditValues(sourceTab, targetTab, row) {
  if (sourceTab === targetTab) return row;
  const description = row.description || row.extracted_description || row.suggested_description || "";
  const source = row.source || row.source_file || row.pdf_file_name || "Manual";
  const foundNumber = row.current_part_number || row.old_part_number || row.extracted_part_number || "";
  if (targetTab === "master") return { current_part_number: foundNumber, description, source, record_type: "Part" };
  if (targetTab === "aliases") return {
    old_part_number: row.old_part_number || row.extracted_part_number || foundNumber,
    current_part_number: row.suggested_current_part_number || (sourceTab === "aliases" ? row.current_part_number : ""),
    description,
    match_type: "manual",
    source,
    notes: row.notes || row.reason || ""
  };
  if (targetTab === "usage") return {
    current_part_number: row.suggested_current_part_number || row.current_part_number || "",
    description,
    drawing_number: row.drawing_number || "",
    item_number: row.item_number || "",
    quantity: row.quantity || "",
    pdf_file_name: source,
    pdf_page_number: row.pdf_page_number || row.page || ""
  };
  return {
    extracted_part_number: row.extracted_part_number || row.old_part_number || foundNumber,
    extracted_description: description,
    suggested_current_part_number: row.suggested_current_part_number || (sourceTab === "aliases" ? row.current_part_number : ""),
    suggested_description: row.suggested_description || "",
    match_type: row.match_type || "manual_review",
    source_file: source,
    page: row.page || row.pdf_page_number || "",
    status: "needs_review"
  };
}

function isMultilineEditField(key) {
  return ["description", "source", "pdf_file_name", "source_file", "notes", "extracted_description", "suggested_description"].includes(key);
}

function closePartsEditModal() {
  document.getElementById("partsEditModal")?.classList.add("hidden");
  partsState.editTarget = null;
  initializePartsSaveIndicator();
}

async function savePartsEditModal() {
  const target = partsState.editTarget;
  if (!target) return;
  const fields = Array.from(document.querySelectorAll("[data-edit-field]"));
  const values = Object.fromEntries(fields.map(input => [
    input.dataset.editField,
    normalizeEditedPartsValue(input.dataset.editField, input.value)
  ]));
  const now = nowISO();
  const sourceTab = target.tab;
  const tab = document.getElementById("partsEditDestination")?.value || sourceTab;
  const isMove = !!target.id && tab !== sourceTab;
  let row = !isMove && target.id ? partsState[tab].find(item => item.id === target.id) : null;
  let approvedLongNumber = false;

  if (tab === "master" && !isCurrentPartNumberCandidate(values.current_part_number)) {
    const alreadyApproved = row && isApprovedPartNumberException(row) && getPartNumberKey(row.current_part_number) === getPartNumberKey(values.current_part_number);
    if (isLongPartNumberExceptionCandidate(values.current_part_number)) {
      approvedLongNumber = alreadyApproved || await showPartsMessage(
        "Approve Part Number Exception",
        `Allow ${values.current_part_number} as a Current Part even though it contains more than eight digits? The exception will be shown in Library Health and can be revoked later.`,
        { confirmText: "Approve Exception", cancelText: "Cancel" }
      );
      if (!approvedLongNumber) return;
    } else {
      await showPartsError(
        "Current Parts normally requires an eight-digit numeric part number. Numbers longer than eight digits may be approved as exceptions.",
        "Current Part Number Required"
      );
      return;
    }
  }
  if (tab === "aliases" && !isOldPartNumberCandidate(values.old_part_number)) {
    await showPartsError(
      "Old Part Numbers requires a seven-digit old number. The current part number may be left blank until the replacement is known.",
      "Seven-Digit Old Number Required"
    );
    return;
  }
  if (tab === "aliases" && values.current_part_number && !isCurrentPartNumberCandidate(values.current_part_number) && !findApprovedLongCurrentPart(values.current_part_number)) {
    await showPartsError("When provided, the linked current part number must contain eight digits.", "Current Part Number Format");
    return;
  }
  if (tab === "usage" && values.current_part_number && !isCurrentPartNumberCandidate(values.current_part_number) && !findApprovedLongCurrentPart(values.current_part_number)) {
    await showPartsError("Drawing Usage current part numbers must contain eight digits.", "Current Part Number Required");
    return;
  }

  if (isMove && tab === "master") row = findMasterPartByNumber(values.current_part_number);
  if (isMove && tab === "aliases") {
    row = partsState.aliases.find(item =>
      getPartNumberKey(item.old_part_number) === getPartNumberKey(values.old_part_number) &&
      getPartNumberKey(item.current_part_number) === getPartNumberKey(values.current_part_number)
    );
  }

  if (!row) {
    row = { id: makeId(tab), created_at: now };
    partsState[tab].unshift(row);
  }
  Object.assign(row, values, { updated_at: now });
  if (tab === "master") {
    row.normalized_part_number = normalizePartNumber(row.current_part_number);
    row.compact_part_number = compactPartNumber(row.current_part_number);
    row.normalized_description = normalizeDescription(row.description);
    row.category = getPartNumberCategoryInfo(row.current_part_number).group;
    row.status = "active";
    row.record_type = approvedLongNumber ? "Part Number Exception" : (row.record_type === "Part Number Exception" ? "Part" : (row.record_type || "Part"));
    row.needs_review = row.needs_review === true || row.needs_review === "true";
  }

  if (tab === "aliases") {
    const currentPart = row.current_part_number ? findMasterPartByNumber(row.current_part_number) : null;
    if (row.current_part_number && !currentPart) {
      await showPartsError("The linked eight-digit current part must exist in Current Parts first.", "Current Part Not Found");
      partsState[tab] = partsState[tab].filter(item => item.id !== row.id);
      return;
    }
    row.part_id = currentPart?.id || null;
  }

  saveLocalPartsDatabase();
  const synced = await upsertSupabaseRows(PARTS_TABLES[tab], [row]);
  let deleteSynced = true;
  if (isMove) {
    let movedUsage = [];
    if (sourceTab === "master") {
      const destinationPart = tab === "aliases"
        ? findMasterPartByNumber(values.current_part_number)
        : (tab === "master" ? row : null);
      movedUsage = partsState.usage.filter(item => item.part_id === target.id).map(item => {
        item.part_id = destinationPart?.id || null;
        item.current_part_number = destinationPart?.current_part_number || "";
        item.updated_at = nowISO();
        return item;
      });
      if (movedUsage.length) await upsertSupabaseRows(PARTS_TABLES.usage, movedUsage);
    }
    partsState[sourceTab] = partsState[sourceTab].filter(item => item.id !== target.id);
    deleteSynced = await deleteSupabaseRow(PARTS_TABLES[sourceTab], target.id);
    saveLocalPartsDatabase();
  }
  saveLocalPartsDatabase("shared", { pendingSync: !synced || !deleteSynced });
  if (!synced || !deleteSynced) {
    await showPartsError(
      "The edit was saved in this browser, but it did not save to Supabase. Other users will not see it yet.",
      "Shared Save Failed"
    );
    return;
  }
  closePartsEditModal();
  partsState.activeTab = tab;
  partsState.sort = getDefaultPartsSort(tab);
  renderPartsDatabase();
}

function normalizeEditedPartsValue(key, value) {
  if (["source", "pdf_file_name", "source_file"].includes(key)) {
    return mergeFileNameLabels(value, "");
  }
  if (["description", "extracted_description", "suggested_description", "notes"].includes(key)) {
    return mergePartDescriptions(value, "");
  }
  return String(value || "").trim();
}

function getEditableFields(tab) {
  if (tab === "aliases") return [
    { key: "old_part_number", label: "Old Part Number" },
    { key: "current_part_number", label: "Current Part Number (Optional)" },
    { key: "description", label: "Description" },
    { key: "match_type", label: "Match Type", defaultValue: "manual" },
    { key: "source", label: "File Name(s)", defaultValue: "Manual" },
    { key: "notes", label: "Notes" }
  ];
  if (tab === "usage") return [
    { key: "current_part_number", label: "Current Part Number" },
    { key: "description", label: "Description" },
    { key: "drawing_number", label: "Drawing / Sheet" },
    { key: "item_number", label: "Item" },
    { key: "quantity", label: "Quantity" },
    { key: "pdf_file_name", label: "File Name(s)" },
    { key: "pdf_page_number", label: "Page" }
  ];
  if (tab === "reviews") return [
    { key: "extracted_part_number", label: "Extracted Part Number" },
    { key: "extracted_description", label: "Extracted Description" },
    { key: "suggested_current_part_number", label: "Suggested Current Part Number" },
    { key: "suggested_description", label: "Suggested Description" },
    { key: "match_type", label: "Match Type" },
    { key: "source_file", label: "File Name(s)" },
    { key: "page", label: "Page" },
    { key: "status", label: "Status", defaultValue: "needs_review" }
  ];
  return [
    { key: "current_part_number", label: "Current Part Number" },
    { key: "description", label: "Description" },
    { key: "source", label: "File Name(s)", defaultValue: "Manual" }
  ];
}

async function exportPartsDatabase() {
  if (typeof XLSX === "undefined") {
    showPartsError("Excel export library is not loaded.");
    return;
  }
  const workbook = XLSX.utils.book_new();
  const sheets = [
    ["Master Parts", getSortedExportRows("master")],
    ["Old Part Number Map", getSortedExportRows("aliases")],
    ["Drawing Usage", getSortedExportRows("usage")],
    ["Items to Check", getSortedExportRows("reviews")],
    ["Import History", getSortedExportRows("history")]
  ];

  sheets.forEach(([name, rows]) => {
    const worksheet = XLSX.utils.json_to_sheet(rows.map(row => stringifyPartNumbers(addCategoryFieldsForExport(row))));
    worksheet["!autofilter"] = { ref: worksheet["!ref"] || "A1" };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    worksheet["!cols"] = getWorksheetColumns(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });

  XLSX.writeFile(workbook, `NS Parts Library ${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function filterForExport(tab) {
  if (tab === "reviews") {
    const unresolved = (partsState.reviews || []).filter(row => !["accepted", "ignored"].includes(row.status));
    if (tab !== partsState.activeTab) return unresolved;
  }
  return tab === partsState.activeTab ? getFilteredRows(tab) : partsState[tab];
}

function addCategoryFieldsForExport(row) {
  const category = getPartNumberCategoryInfo(getPartsCategoryNumber(row));
  return {
    ...row,
    category_group: category.group,
    subcategory: category.subcategory
  };
}

const PARTS_EXPORT_SORT_KEYS = {
  master: ["current_part_number", "description"],
  aliases: ["old_part_number", "current_part_number", "description"],
  usage: ["current_part_number", "drawing_number", "item_number", "pdf_page_number"],
  reviews: ["extracted_part_number", "suggested_current_part_number", "source_file", "page"],
  history: ["file_name", "created_at"]
};

function getSortedExportRows(tab) {
  const rows = filterForExport(tab) || [];
  const keys = PARTS_EXPORT_SORT_KEYS[tab] || [];

  return [...rows].sort((a, b) => {
    if (tab === "reviews") {
      const confidenceResult = getReviewConfidenceScore(b) - getReviewConfidenceScore(a);
      if (confidenceResult !== 0) return confidenceResult;
      const priorityResult = getReviewSortPriority(a) - getReviewSortPriority(b);
      if (priorityResult !== 0) return priorityResult;
    }
    for (const key of keys) {
      const av = String(a?.[key] ?? "").trim();
      const bv = String(b?.[key] ?? "").trim();

      if (!av && bv) return 1;
      if (av && !bv) return -1;

      const result = av.localeCompare(bv, undefined, {
        numeric: true,
        sensitivity: "base",
        ignorePunctuation: false
      });
      if (result !== 0) return result;
    }
    return 0;
  });
}

function stringifyPartNumbers(row) {
  const copy = { ...row };
  Object.keys(copy).forEach(key => {
    if (key.includes("part_number") || key.includes("number")) copy[key] = String(copy[key] ?? "");
  });
  return copy;
}

function getWorksheetColumns(rows) {
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  return keys.map(key => ({
    wch: Math.max(12, Math.min(42, key.length + 6))
  }));
}

function isExportedPartsWorkbook(workbook) {
  return ["Master Parts", "Old Part Number Map", "Drawing Usage", "Items to Check", "Import History"]
    .some(name => workbook.SheetNames.includes(name));
}

async function previewDatabaseWorkbook(workbook, fileName) {
  partsState.previewRows = getExportedPartsWorkbookPreviewRows(workbook, fileName);
  addPartsImportLog(`Detected exported library workbook with ${partsState.previewRows.length} current part row(s).`);
  partsState.isProcessing = false;
  updatePartsCancelButton();
  updatePartsProgress("Library workbook preview ready.", 100);
  renderImportPreview();
}

function getExportedPartsWorkbookPreviewRows(workbook, fileName) {
  const masterRows = sheetRows(workbook, "Master Parts");
  const masterPreviewRows = masterRows.map((row, index) => buildExcelPreviewRow(row, {
    current_part_number: findHeaderKey(row, ["current part number", "current_part_number"]),
    description: findHeaderKey(row, ["description"])
  }, fileName, "Master Parts", index + 2)).filter(Boolean);
  const aliasRows = sheetRows(workbook, "Old Part Number Map");
  const aliasPreviewRows = aliasRows.map((row, index) => buildExcelPreviewRow(row, {
    old_part_number: findHeaderKey(row, ["old part number", "old_part_number"]),
    current_part_number: findHeaderKey(row, ["current part number", "current_part_number"]),
    description: findHeaderKey(row, ["description"])
  }, fileName, "Old Part Number Map", index + 2)).filter(Boolean);
  return [...masterPreviewRows, ...aliasPreviewRows];
}

function sheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) : [];
}

function chooseLikelySheet(workbook) {
  return workbook.SheetNames.find(name => /part|master|merge|pn/i.test(name)) || workbook.SheetNames[0];
}

function detectExcelColumnMapping(headers) {
  const sample = Object.fromEntries(headers.map(header => [header, header]));
  return {
    old_part_number: findHeaderKey(sample, ["old part #", "old part number", "old/obsolete part number", "obsolete part"]),
    current_part_number: findHeaderKey(sample, ["new part #", "new part number", "item code", "part number", "current part number"]),
    description: findHeaderKey(sample, ["description", "item description", "product description"])
  };
}

function renderColumnMapping(headers, mapping, rows, fileName, sheetName) {
  const box = document.getElementById("partsColumnMapping");
  if (!box) return;
  const options = [
    ["", "Ignore Column"],
    ["old_part_number", "Old Part Number"],
    ["current_part_number", "Current Part Number"],
    ["description", "Description"]
  ];
  const summary = getColumnMappingSummary(mapping);
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="parts-mapping-summary">
      <div>
        <strong>Detected Columns</strong>
        <p>${escapeHTML(summary || "No matching columns detected yet.")}</p>
      </div>
      <button class="secondary" id="partsToggleMappingButton" type="button">Change Mapping</button>
    </div>
    <div id="partsMappingEditor" class="parts-mapping-editor hidden">
      <div class="parts-mapping-grid">
        ${headers.map(header => {
          const selectedRole = Object.keys(mapping).find(role => mapping[role] === header) || "";
          return `
            <label>
              <span>${escapeHTML(header)}</span>
              <select data-map-header="${escapeAttr(header)}">
                ${options.map(([value, label]) => `<option value="${value}" ${value === selectedRole ? "selected" : ""}>${label}</option>`).join("")}
              </select>
            </label>
          `;
        }).join("")}
      </div>
      <button class="secondary" id="partsApplyMappingButton" type="button">Apply Mapping</button>
    </div>
  `;
  document.getElementById("partsToggleMappingButton")?.addEventListener("click", () => {
    document.getElementById("partsMappingEditor")?.classList.toggle("hidden");
  });
  document.getElementById("partsApplyMappingButton")?.addEventListener("click", () => {
    const nextMapping = {};
    box.querySelectorAll("[data-map-header]").forEach(select => {
      if (select.value) nextMapping[select.value] = select.dataset.mapHeader;
    });
    partsState.previewRows = rows
      .map((row, index) => buildExcelPreviewRow(row, nextMapping, fileName, sheetName, index + 2))
      .filter(Boolean);
    renderColumnMapping(headers, nextMapping, rows, fileName, sheetName);
    addPartsImportLog("Column mapping updated.");
    renderImportPreview();
  });
}

function getColumnMappingSummary(mapping) {
  const labels = {
    current_part_number: "Current Part Number",
    old_part_number: "Old Part Number",
    description: "Description"
  };

  return Object.entries(labels)
    .filter(([key]) => mapping[key])
    .map(([key, label]) => `${label}: ${mapping[key]}`)
    .join(" | ");
}

function valueFromMappedColumn(row, mapping, key) {
  const header = mapping[key];
  return header ? String(row[header] || "").trim() : "";
}

function findHeaderKey(row, aliases) {
  const aliasSet = aliases.map(normalizeExcelHeader);
  return Object.keys(row).find(key => aliasSet.includes(normalizeExcelHeader(key))) || "";
}

function clearPartsFilters() {
  ["partsSearchInput", "partsSourceFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  partsState.sort = getDefaultPartsSort(partsState.activeTab);
  resetPartsPage();
  renderPartsDatabase();
}

function findMasterPartByNumber(partNumber) {
  const key = getPartNumberKey(partNumber);
  return partsState.master.find(part => getPartNumberKey(part.current_part_number) === key && key);
}

function normalizePartNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ");
}

function getPartNumberKey(value) {
  return compactPartNumber(value);
}

function getNumericPartDigits(value) {
  const text = String(value || "").trim();
  if (!text || /[A-Z]/i.test(text)) return "";
  const digits = text.replace(/\D/g, "");
  return /^[\d\s_.-]+$/.test(text) ? digits : "";
}

function isImportableNumericPartNumber(value) {
  const digits = getNumericPartDigits(value);
  return digits.length === 7 || digits.length === 8;
}

function isCurrentPartNumberCandidate(value) {
  return getNumericPartDigits(value).length === 8;
}

function isOldPartNumberCandidate(value) {
  return getNumericPartDigits(value).length === 7;
}

function formatCurrentPartNumber(value) {
  const digits = getNumericPartDigits(value);
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return String(value || "").trim();
}

function applyPartNumberRoleRules(source) {
  const next = { ...source };
  const extracted = next.extracted_part_number || "";

  if (!next.old_part_number && isOldPartNumberCandidate(next.current_part_number)) {
    next.old_part_number = next.current_part_number;
    next.current_part_number = "";
  }

  if (!next.current_part_number && isCurrentPartNumberCandidate(next.old_part_number)) {
    next.current_part_number = next.old_part_number;
    next.old_part_number = "";
  }

  if (!next.current_part_number && isCurrentPartNumberCandidate(extracted)) {
    next.current_part_number = formatCurrentPartNumber(extracted);
    next.extracted_part_number = next.current_part_number;
  } else if (!next.old_part_number && isOldPartNumberCandidate(extracted)) {
    next.old_part_number = extracted;
  }

  next.current_part_number = formatCurrentPartNumber(next.current_part_number);
  return next;
}

function compactPartNumber(value) {
  return normalizePartNumber(value).replace(/[\s_-]+/g, "");
}

function normalizeDescription(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/Ø/g, " DIAMETER ")
    .replace(/\bDIA\b/g, "DIAMETER")
    .replace(/\bSS\b/g, "STAINLESS STEEL")
    .replace(/\bS\.S\.\b/g, "STAINLESS STEEL")
    .replace(/\bLG\b/g, "LONG")
    .replace(/\bIN\b/g, "INCH")
    .replace(/[^\w\s"'/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExcelHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeImportText(value) {
  return String(value || "")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) || 0) + 1);
  }
  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2);
    const count = bigrams.get(gram) || 0;
    if (count > 0) {
      bigrams.set(gram, count - 1);
      matches++;
    }
  }
  return (2 * matches) / (a.length + b.length - 2);
}

function uniqueValues(values) {
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function setPartsStatus(message) {
  setText("partsStatusMessage", message);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? "");
}

function formatValue(value) {
  if (value == null) return "";
  if (typeof value === "number" && value <= 1 && value >= 0) return `${Math.round(value * 100)}%`;
  return String(value);
}

function labelize(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function getBadgeClass(value) {
  const normalized = normalizeSearch(value).replace(/\s+/g, "-");
  if (normalized.includes("conflict")) return "conflict";
  if (normalized.includes("review") || normalized.includes("suggested")) return "needs-review";
  if (normalized.includes("exact") || normalized.includes("active") || normalized.includes("old") || normalized.includes("same-number")) return "exact";
  if (normalized.includes("new")) return "new-part";
  return "";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHTML(value).replace(/`/g, "&#96;");
}

function makeId(prefix) {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${uuid}`;
}

function nowISO() {
  return new Date().toISOString();
}

function waitForBrowser() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
