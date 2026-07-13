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

let partsState = {
  master: [],
  aliases: [],
  usage: [],
  reviews: [],
  history: [],
  activeTab: "master",
  sort: { key: "current_part_number", direction: "asc" },
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
  await checkPartsLogin();
  await loadPartsDatabase();
  renderPartsDatabase();
}

function bindPartsDatabaseEvents() {
  document.getElementById("partsSearchInput")?.addEventListener("input", renderPartsDatabase);
  document.getElementById("partsSourceFilter")?.addEventListener("change", renderPartsDatabase);
  document.getElementById("partsSortSelect")?.addEventListener("change", event => setPartsSortFromValue(event.target.value));
  document.querySelectorAll("[data-parts-tab]").forEach(button => {
    button.addEventListener("click", () => setPartsActiveTab(button.dataset.partsTab));
  });
  document.getElementById("partsClearFiltersButton")?.addEventListener("click", clearPartsFilters);
  document.getElementById("partsExportButton")?.addEventListener("click", () => {
    if (ensurePartsUnlocked()) exportPartsDatabase();
  });
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
  document.getElementById("partsSelectVisibleButton")?.addEventListener("click", toggleVisiblePartsSelection);
  document.getElementById("partsDeleteSelectedButton")?.addEventListener("click", deleteSelectedPartsRecords);
  document.getElementById("partsMessageCancelButton")?.addEventListener("click", () => closePartsMessage(false));
  document.getElementById("partsMessageConfirmButton")?.addEventListener("click", () => closePartsMessage(true));
  document.getElementById("partsClearLocalButton")?.addEventListener("click", clearLocalPartsCopy);
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
  const button = document.getElementById("partsClearLocalButton");
  if (!button) return;
  button.classList.toggle("hidden", hasSupabaseParts() || !hasLocalPartsCache());
}

function hasLocalPartsCache() {
  return !!localStorage.getItem(PARTS_STORAGE_KEY);
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
    const master = await fetchSupabaseRows(PARTS_TABLES.master);
    const [aliases, usage, reviews, history] = await Promise.all([
      fetchSupabaseRows(PARTS_TABLES.aliases),
      fetchSupabaseRows(PARTS_TABLES.usage),
      fetchSupabaseRows(PARTS_TABLES.reviews),
      fetchSupabaseRows(PARTS_TABLES.history)
    ]);

    partsState.master = master;
    partsState.aliases = aliases;
    partsState.usage = usage;
    partsState.reviews = reviews;
    partsState.history = history;
    normalizePartsFileNameLabels();
    saveLocalPartsDatabase("shared");
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

async function clearLocalPartsCopy() {
  const confirmed = await showPartsMessage(
    "Clear Local Copy",
    "Clear the Parts Library data saved in this browser? This does not delete the shared library.",
    {
      confirmText: "Clear Local Copy",
      cancelText: "Cancel",
      variant: "danger"
    }
  );
  if (!confirmed) return;

  localStorage.removeItem(PARTS_STORAGE_KEY);
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

function saveLocalPartsDatabase(storageMode = hasSupabaseParts() ? "shared" : "local") {
  localStorage.setItem(PARTS_STORAGE_KEY, JSON.stringify({
    meta: {
      storageMode,
      saved_at: nowISO()
    },
    master: partsState.master,
    aliases: partsState.aliases,
    usage: partsState.usage,
    reviews: partsState.reviews,
    history: partsState.history
  }));
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
  const { data, error } = await supabaseClient.from(table).select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function upsertSupabaseRows(table, rows) {
  if (!hasSupabaseParts() || !rows.length) return;
  const { error } = await supabaseClient.from(table).upsert(rows, { onConflict: "id" });
  if (error) {
    handlePartsRemoteError(error);
    return;
  }
}

async function deleteSupabaseRow(table, id) {
  if (!hasSupabaseParts()) return;
  const { error } = await supabaseClient.from(table).delete().eq("id", id);
  if (error) handlePartsRemoteError(error);
}

function handlePartsRemoteError(error) {
  if (isMissingPartsRemoteTableError(error)) {
    partsRemoteStorageAvailable = false;
    setPartsStatus("Saved locally. Shared Parts Library tables are not in Supabase yet.");
    addPartsImportLog("Saved locally because the shared Supabase tables have not been created yet.");
    return;
  }

  console.warn("Parts Library shared storage skipped:", error);
  setPartsStatus("Saved locally. Shared storage could not be reached.");
  addPartsImportLog("Saved locally because shared storage could not be reached.");
}

function isMissingPartsRemoteTableError(error) {
  return error?.code === "PGRST205" || /could not find the table|schema cache/i.test(error?.message || "");
}

function renderPartsDatabase() {
  renderPartsTabs();
  renderPartsFilters();
  renderPartsSortOptions();
  renderPartsSummary();
  renderActivePartsTable();
  renderActivePartsListHeading();
  updatePartsBulkActions();
}

function renderPartsTabs() {
  document.querySelectorAll("[data-parts-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.partsTab === partsState.activeTab);
  });
}

function setPartsActiveTab(tab) {
  if (!partsState[tab]) return;
  partsState.activeTab = tab;
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
  const options = config.columns
    .filter(col => !col.badge && !col.check)
    .flatMap(col => [
      { value: `${col.key}:asc`, label: `${col.label} A-Z` },
      { value: `${col.key}:desc`, label: `${col.label} Z-A` }
    ]);
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
  setText("partsUsageCount", partsState.usage.length);
  setText("partsHistoryCount", partsState.history.length);
  renderPartsHeaderSummary();
}

function renderPartsHeaderSummary() {
  const totalRecords = partsState.master.length + partsState.aliases.length + partsState.usage.length + partsState.reviews.length + partsState.history.length;
  const storageLabel = hasSupabaseParts() ? "shared" : "local";

  setText("partsHeaderRecordCount", `${totalRecords} ${storageLabel} part record${totalRecords === 1 ? "" : "s"} saved`);
  setText("partsHeaderUsageText", `Current parts: ${getUniqueCurrentPartsCount()} - Old part numbers: ${getUniqueOldPartNumbersCount()} - Drawing usage: ${partsState.usage.length}`);
  updatePartsSharedStorageUsage();
}

function getUniqueCurrentPartsCount() {
  return new Set(partsState.master.map(row => getPartNumberKey(row.current_part_number)).filter(Boolean)).size;
}

function getUniqueOldPartNumbersCount() {
  return new Set(partsState.aliases.map(row => getPartNumberKey(row.old_part_number)).filter(Boolean)).size;
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

  wrap.innerHTML = `
    <table class="parts-data-table">
      <thead>
        <tr>
          <th class="parts-select-column">Select</th>
          ${config.columns.map(col => `<th>${escapeHTML(col.label)}</th>`).join("")}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(row => renderPartsTableRow(row, config, selected.has(row.id))).join("")}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => handlePartsAction(button.dataset.action, button.dataset.id));
  });
  wrap.querySelectorAll("[data-select-row]").forEach(input => {
    input.addEventListener("change", () => togglePartsRowSelection(input.dataset.selectRow, input.checked));
  });
  updatePartsBulkActions();
}

function renderPartsTableRow(row, config, isSelected) {
  return `
    <tr class="${isSelected ? "selected" : ""}">
      <td class="parts-select-column">
        <input type="checkbox" data-select-row="${escapeAttr(row.id)}" ${isSelected ? "checked" : ""} aria-label="Select row" />
      </td>
      ${config.columns.map(col => `<td>${formatPartsCell(row, col)}</td>`).join("")}
      <td><div class="parts-row-actions">${config.actions(row).join("")}</div></td>
    </tr>
  `;
}

function formatPartsCell(row, col) {
  const value = row[col.key];
  if (col.badge) return `<span class="parts-badge ${getBadgeClass(value)}">${escapeHTML(formatValue(value))}</span>`;
  if (col.check) return value ? `<span class="parts-badge needs-review">Needs Review</span>` : "";
  return `<span class="parts-cell-lines">${escapeHTML(formatValue(value))}</span>`;
}

function getSelectedPartsSet(tab = partsState.activeTab) {
  if (!partsState.selected[tab]) partsState.selected[tab] = new Set();
  return partsState.selected[tab];
}

function getVisiblePartsRows() {
  return sortRows(getFilteredRows(partsState.activeTab), partsState.sort);
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
        { key: "extracted_part_number", label: "Extracted Part Number" },
        { key: "extracted_description", label: "Extracted Description" },
        { key: "suggested_current_part_number", label: "Suggested Current Part Number" },
        { key: "suggested_description", label: "Suggested Description" },
        { key: "match_type", label: "Match Type", badge: true },
        { key: "confidence", label: "Confidence" },
        { key: "source_file", label: "File Name(s)" },
        { key: "page", label: "Page" },
        { key: "status", label: "Status", badge: true }
      ],
      actions: row => actionButtons(row)
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
  renderActivePartsTable();
}

function setPartsSortFromValue(value) {
  const [key, direction] = String(value || "").split(":");
  if (!key) return;
  partsState.sort = {
    key,
    direction: direction === "desc" ? "desc" : "asc"
  };
  renderActivePartsTable();
}

function getDefaultPartsSort(tab) {
  const keys = {
    master: "current_part_number",
    aliases: "old_part_number",
    usage: "pdf_file_name",
    reviews: "status",
    history: "created_at"
  };
  return { key: keys[tab] || "current_part_number", direction: tab === "history" ? "desc" : "asc" };
}

function sortRows(rows, sort) {
  return [...rows].sort((a, b) => {
    const av = a[sort.key] ?? "";
    const bv = b[sort.key] ?? "";
    const result = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
    return sort.direction === "asc" ? result : -result;
  });
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
    return buildMatch("old_number", part || oldMatch, 1, `Old number matches current part ${oldMatch.current_part_number}.`);
  }

  const normalizedMatch = partsState.master.find(part => getPartNumberKey(part.current_part_number) === compactPart && compactPart);
  if (normalizedMatch) return buildMatch("normalized_number", normalizedMatch, 0.98, `Same part number after removing spaces/dashes: ${normalizedMatch.current_part_number}.`);

  const descriptionMatch = partsState.master.find(part => getDescriptionKeys(part.description).includes(normalizedDescription) && normalizedDescription);
  if (descriptionMatch) return buildMatch("description_match", descriptionMatch, 1, `Description already exists under current part ${descriptionMatch.current_part_number}.`);

  const fuzzy = findFuzzyDescriptionMatch(normalizedDescription);
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

function getPreviewStatus(match, source) {
  if (match.type === "conflict") return "conflict";
  if (match.type === "same_number_different_description") return "active";
  if (match.type === "suggested") return "needs_review";
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
  saveLocalPartsDatabase();
  addPartsImportLog(`Saved ${rows.length} row(s) to this browser.`);
  await persistPartsChanges(changed);
  closePartsPreview();
  renderPartsDatabase();
  setPartsStatus(`Imported ${rows.length} row(s) from ${partsState.previewFileName}. Items that need attention were kept separate.`);
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
      category: source.category || "",
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
  if (!hasSupabaseParts()) return;

  await Promise.all([
    upsertSupabaseRows(PARTS_TABLES.master, changed.master),
    upsertSupabaseRows(PARTS_TABLES.aliases, changed.aliases),
    upsertSupabaseRows(PARTS_TABLES.usage, changed.usage),
    upsertSupabaseRows(PARTS_TABLES.reviews, changed.reviews),
    upsertSupabaseRows(PARTS_TABLES.history, changed.history)
  ]);

  if (hasSupabaseParts()) {
    addPartsImportLog("Saved to shared Parts Library.");
  }
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
  await applyPartsDeletePlan(deletePlan);
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

  await applyPartsDeletePlan(deletePlan);
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

  await Promise.all([...deletes, ...updates]);
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
  if (action === "ignore-review") {
    review.status = "ignored";
    review.updated_at = nowISO();
    await persistPartsChanges({ master: [], aliases: [], usage: [], reviews: [review], history: [] });
  } else if (action === "accept-review" || action === "new-review") {
    const partNumber = action === "accept-review" ? review.suggested_current_part_number : review.extracted_part_number;
    if (!findMasterPartByNumber(partNumber)) {
      const part = createPartFromReview(review, partNumber);
      partsState.master.unshift(part);
      await persistPartsChanges({ master: [part], aliases: [], usage: [], reviews: [], history: [] });
    }
    review.status = "accepted";
    review.updated_at = nowISO();
    await persistPartsChanges({ master: [], aliases: [], usage: [], reviews: [review], history: [] });
  } else if (action === "alias-review") {
    const part = findMasterPartByNumber(review.suggested_current_part_number);
    if (!part) {
      setPartsStatus("Choose or create the suggested part before adding an old part number.");
      return;
    }
    const alias = {
      id: makeId("alias"),
      part_id: part.id,
      old_part_number: review.extracted_part_number,
      current_part_number: part.current_part_number,
      description: review.extracted_description,
      match_type: "approved_alias",
      source: review.source_file,
      notes: review.reason,
      created_at: nowISO(),
      updated_at: nowISO()
    };
    partsState.aliases.unshift(alias);
    review.status = "accepted";
    review.updated_at = nowISO();
    await persistPartsChanges({ master: [], aliases: [alias], usage: [], reviews: [review], history: [] });
  }
  saveLocalPartsDatabase();
  renderPartsDatabase();
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
    category: "",
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
  partsState.editTarget = { tab, id };
  setText("partsEditTitle", row ? "Edit Record" : "Add Part");
  const fields = getEditableFields(tab);
  const container = document.getElementById("partsEditFields");
  if (!container) return;
  container.innerHTML = fields.map(field => `
    <label>
      <span>${escapeHTML(field.label)}</span>
      ${isMultilineEditField(field.key)
        ? `<textarea data-edit-field="${field.key}" rows="3">${escapeHTML(row?.[field.key] ?? field.defaultValue ?? "")}</textarea>`
        : `<input data-edit-field="${field.key}" value="${escapeAttr(row?.[field.key] ?? field.defaultValue ?? "")}" />`}
    </label>
  `).join("");
  document.getElementById("partsEditModal")?.classList.remove("hidden");
}

function isMultilineEditField(key) {
  return ["description", "source", "pdf_file_name", "source_file", "notes", "extracted_description", "suggested_description"].includes(key);
}

function closePartsEditModal() {
  document.getElementById("partsEditModal")?.classList.add("hidden");
  partsState.editTarget = null;
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
  const tab = target.tab;
  let row = target.id ? partsState[tab].find(item => item.id === target.id) : null;

  if (!row) {
    row = { id: makeId(tab), created_at: now };
    partsState[tab].unshift(row);
  }
  Object.assign(row, values, { updated_at: now });
  if (tab === "master") {
    row.normalized_part_number = normalizePartNumber(row.current_part_number);
    row.compact_part_number = compactPartNumber(row.current_part_number);
    row.normalized_description = normalizeDescription(row.description);
    row.status = row.status || "active";
    row.record_type = row.record_type || "Part";
    row.needs_review = row.needs_review === true || row.needs_review === "true";
  }

  saveLocalPartsDatabase();
  await upsertSupabaseRows(PARTS_TABLES[tab], [row]);
  closePartsEditModal();
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
    { key: "current_part_number", label: "Current Part Number" },
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
    { key: "source", label: "File Name(s)", defaultValue: "Manual" },
    { key: "record_type", label: "Record Type", defaultValue: "Part" }
  ];
}

async function exportPartsDatabase() {
  if (typeof XLSX === "undefined") {
    showPartsError("Excel export library is not loaded.");
    return;
  }
  const workbook = XLSX.utils.book_new();
  const sheets = [
    ["Master Parts", filterForExport("master")],
    ["Old Part Number Map", filterForExport("aliases")],
    ["Drawing Usage", filterForExport("usage")],
    ["Items to Check", filterForExport("reviews")],
    ["Import History", filterForExport("history")]
  ];

  sheets.forEach(([name, rows]) => {
    const worksheet = XLSX.utils.json_to_sheet(rows.map(row => stringifyPartNumbers(row)));
    worksheet["!autofilter"] = { ref: worksheet["!ref"] || "A1" };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    worksheet["!cols"] = getWorksheetColumns(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });

  XLSX.writeFile(workbook, `NS Parts Library ${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function filterForExport(tab) {
  return tab === partsState.activeTab ? getFilteredRows(tab) : partsState[tab];
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
