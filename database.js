let libraryDB = [];
let pendingLibraryPdf = null;
let selectedLibraryPDFIds = new Set();
let currentUser = null;
let useRemoteDatabase = false;
const libraryPDFBlobCache = new Map();

function registerDatabaseGhostAutocompleteSource() {
  if (typeof window.registerGhostAutocompleteSource !== "function") return;
  window.registerGhostAutocompleteSource(() => getDatabaseGhostAutocompleteSuggestions());
}

function getDatabaseGhostAutocompleteSuggestions() {
  const values = [];
  const addValue = value => {
    const clean = String(value || "").trim();
    if (clean) values.push(clean);
  };

  libraryDB.forEach(item => {
    addValue(item.fileName);
    addValue(item.displayTitle);
    addValue(item.attachmentFileName);
    addValue(item.category);
    addValue(item.documentType);
    addValue(item.packetSection);
    (item.tocEntries || []).forEach(entry => {
      addValue(entry.title);
      addValue(entry.parentTitle);
    });
  });

  const seen = new Set();
  return values.filter(value => {
    const key = String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function openDatabaseMessageModal(title = "Action Needed", message = "", options = {}) {
  return new Promise(resolve => {
    const modal = document.getElementById("appPromptModal");
    const titleEl = document.getElementById("appPromptTitle");
    const messageEl = document.getElementById("appPromptMessage");
    const actionsEl = document.getElementById("appPromptActions");

    if (!modal || !titleEl || !messageEl || !actionsEl) {
      console.warn(message || title);
      resolve();
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    actionsEl.innerHTML = "";

    let inputEl = null;
    let inputGroup = document.getElementById("databasePromptInputGroup");
    if (inputGroup) inputGroup.remove();

    if (options.input) {
      inputGroup = document.createElement("label");
      inputGroup.id = "databasePromptInputGroup";
      inputGroup.className = "app-prompt-input-group";

      const label = document.createElement("span");
      label.textContent = options.input.label || "Value";

      inputEl = document.createElement("input");
      inputEl.type = options.input.type || "text";
      inputEl.value = options.input.value || "";
      inputEl.placeholder = options.input.placeholder || "";

      inputGroup.appendChild(label);
      inputGroup.appendChild(inputEl);
      messageEl.insertAdjacentElement("afterend", inputGroup);
    }

    const close = result => {
      modal.classList.add("hidden");
      actionsEl.innerHTML = "";
      inputGroup?.remove();
      resolve(result);
    };

    const okButton = document.createElement("button");
    okButton.type = "button";
    okButton.textContent = options.confirmLabel || "OK";
    okButton.addEventListener("click", () => close(inputEl ? inputEl.value : true));

    if (options.cancelLabel) {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "secondary";
      cancelButton.textContent = options.cancelLabel;
      cancelButton.addEventListener("click", () => close(null));
      actionsEl.appendChild(cancelButton);
    }

    actionsEl.appendChild(okButton);
    modal.classList.remove("hidden");
    (inputEl || okButton).focus();
    if (inputEl) inputEl.select();
  });
}

function openLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.remove("hidden");
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.add("hidden");
}

async function checkDatabaseLogin() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    useRemoteDatabase = false;
    return;
  }

  const { data } = await supabaseClient.auth.getUser();

  currentUser = data.user || null;
  useRemoteDatabase = !!currentUser;

  const status = document.getElementById("loginStatus");

  if (status) {
    status.textContent = useRemoteDatabase
      ? `Logged in as ${currentUser.email}`
      : "Not logged in. Saving locally only.";
  }

  const loginBtn = document.getElementById("loginButton");
  const logoutBtn = document.getElementById("logoutButton");
  const usageCard = document.getElementById("databaseStorageUsage");

  if (useRemoteDatabase) {
    if (usageCard) usageCard.classList.remove("hidden");

    if (loginBtn) {
      loginBtn.textContent = currentUser.email;
      loginBtn.classList.add("account-email-pill");
      loginBtn.onclick = null;
    }

    if (logoutBtn) {
      logoutBtn.classList.remove("hidden");
    }
  } else {
    if (loginBtn) {
      loginBtn.textContent = "Login";
      loginBtn.classList.remove("account-email-pill");
      loginBtn.onclick = openLoginModal;
    }

    if (usageCard) usageCard.classList.add("hidden");

    if (logoutBtn) {
      logoutBtn.classList.add("hidden");
    }
  }

  if (!useRemoteDatabase) {
    openLoginModal();
  }
}

async function logoutUser() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return;

  await supabaseClient.auth.signOut();

  currentUser = null;
  useRemoteDatabase = false;

  const loginBtn = document.getElementById("loginButton");
  const logoutBtn = document.getElementById("logoutButton");
  const usageCard = document.getElementById("databaseStorageUsage");

  if (loginBtn) {
    loginBtn.textContent = "Login";
    loginBtn.classList.remove("account-email-pill");
    loginBtn.onclick = openLoginModal;
  }

  if (logoutBtn) {
    logoutBtn.classList.add("hidden");
  }

  if (usageCard) {
    usageCard.classList.add("hidden");
  }

  document.getElementById("loginStatus").textContent =
    "Not logged in. Saving locally only.";

  location.reload();
}

async function sendLoginLink() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    await showLibraryMessage("Login Unavailable", "Remote login is only available on the Database page.");
    return;
  }

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    await showLibraryMessage("Login Needed", "Enter your email and password.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("LOGIN ERROR:", error);
    await showLibraryMessage("Could Not Log In", error.message || "Could not log in.");
    return;
  }

  await checkDatabaseLogin();
  closeLoginModal();
  await loadLibraryDB();
}

const DOCUMENTS_TABLE = "documents";
const DOCUMENTS_BUCKET = "document-library";
const DATABASE_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
const DATABASE_DIRECT_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;
const DATABASE_PDF_PARENT_TOC_ID = "__pdf_parent__";
const DATABASE_CATEGORIES = ["Generic", "Car Wash", "Transit Wash"];

function guessPacketSectionForLibrary(fileName = "") {
  return guessPacketSectionFromName(fileName);
}

function normalizeLibraryTOCLevel(value) {
  const level = Number(value);
  return [0, 1, 2].includes(level) ? level : 0;
}

function normalizeLibraryCategory(value = "") {
  return DATABASE_CATEGORIES.includes(value) ? value : "Generic";
}

function getLibraryMetaFromTags(tags = "") {
  const metaLine = String(tags || "")
    .split(/\r?\n/)
    .find(line => line.trim().startsWith("ns-meta:"));

  if (!metaLine) return {};

  try {
    return JSON.parse(metaLine.trim().replace(/^ns-meta:/, ""));
  } catch (error) {
    console.warn("Could not read library metadata:", error);
    return {};
  }
}

function getLibraryTagsWithMeta(tags = "", meta = {}) {
  const visibleTags = String(tags || "")
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.trim().startsWith("ns-meta:"));
  const cleanMeta = {
    tocLevel: normalizeLibraryTOCLevel(meta.tocLevel),
    hideParentTOC: !!meta.hideParentTOC,
    category: normalizeLibraryCategory(meta.category),
    tocEntries: Array.isArray(meta.tocEntries)
      ? meta.tocEntries.map(entry => ({
          id: entry.id || crypto.randomUUID(),
          title: entry.title || "",
          sourcePage: Number(entry.sourcePage || 1),
          entryType: Number(entry.tocLevel || 0) === 0 ? "section" : "subsection",
          tocLevel: normalizeLibraryTOCLevel(entry.tocLevel),
          parentId: entry.parentId || "",
          detectedTOCEntry: false
        }))
      : []
  };

  return [
    ...visibleTags,
    `ns-meta:${JSON.stringify(cleanMeta)}`
  ].join("\n");
}

function getLibraryPacketSection(item) {
  return item.packetSection || guessPacketSectionForLibrary(item.fileName || item.displayTitle || "");
}

function cleanLibraryBuilderTitle(value = "") {
  const leafName = String(value || "")
    .trim()
    .split(/[\\/]+/)
    .filter(Boolean)
    .pop() || "";

  return leafName.replace(/\.pdf$/i, "").trim();
}

function getLibraryBuilderDisplayTitle(item = {}) {
  return cleanLibraryBuilderTitle(item.fileName) ||
    cleanLibraryBuilderTitle(item.attachmentFileName) ||
    cleanLibraryBuilderTitle(item.displayTitle) ||
    "Database PDF";
}

function libraryHasLevelZeroEntry(item = {}) {
  return (item.tocEntries || []).some(entry =>
    normalizeLibraryTOCLevel(entry.tocLevel) === 0
  );
}

function getLibraryHideParentValidationMessage(item = {}) {
  if (!item.hideParentTOC || libraryHasLevelZeroEntry(item)) return "";

  return `"${getLibraryBuilderDisplayTitle(item)}" is set to hide the PDF name in the TOC, but it does not have a Level 0 entry. Open Format Levels in the database and add a Level 0 heading, or turn off Hide PDF name in TOC.`;
}

function getLibraryBuilderTOCEntries(item = {}) {
  const workingItem = {
    ...item,
    tocEntries: Array.isArray(item.tocEntries)
      ? item.tocEntries.map(entry => ({ ...entry }))
      : []
  };

  cleanInvalidLibraryLevelParents(workingItem);
  return orderLibraryLevelEntries(workingItem.tocEntries)
    .map(entry => ({ ...entry }));
}

async function loadLibraryDB() {
  if (!useRemoteDatabase || typeof supabaseClient === "undefined" || !supabaseClient) {
    renderLibraryDB();
    updateDatabaseStatus("Log in to load shared database documents.");
    await updateDatabaseStorageUsage();
    return;
  }

  updateDatabaseStatus("Loading shared database...");

  const { data, error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .select("*")
    .order("document_type", { ascending: true })
    .order("display_title", { ascending: true });

  if (error) {
    console.error("Error loading library:", error);
    await showLibraryMessage("Could Not Load Library", "Could not load the shared database library from Supabase.");
    libraryDB = [];
    renderLibraryDB();
    updateDatabaseStatus("Could not load shared database. Check the console for details.");
    await updateDatabaseStorageUsage();
    return;
  }

  libraryDB = (data || []).map(fromSupabaseDocument);
  sortLibraryDB();
  renderLibraryDB();
  updateDatabaseStatus();
  await updateDatabaseStorageUsage();
}

function saveLibraryDB() {
  // Supabase saves happen directly in add/update/remove functions now.
  // This stays here so older code does not break.
}

function updateDatabaseStatus(message = "") {
  const status = document.getElementById("databaseStatus");
  if (!status) return;
  status.textContent = message || "";
}

function updateDatabaseUploadStatus(message = "") {
  const status = document.getElementById("databaseUploadStatus");
  if (!status) return;
  status.textContent = message || "";
}

function updateLibraryCount(visibleCount = libraryDB.length) {
  const count = document.getElementById("libraryCount");
  if (!count) return;

  const attachedCount = libraryDB.filter(item => item.storagePath).length;
  const selectedCount = selectedLibraryPDFIds.size;
  count.textContent = libraryDB.length || selectedCount
    ? `${visibleCount} shown | ${libraryDB.length} documents | ${attachedCount} PDFs | ${selectedCount} selected`
    : "";
}

function fromSupabaseDocument(row) {
  const meta = getLibraryMetaFromTags(row.tags || "");
  const detectionName = row.file_name || row.display_title || "";

  return {
    id: row.id,
    uploadDate: row.created_at
      ? new Date(row.created_at).toLocaleDateString()
      : "",
    fileName: row.file_name || "",
    displayTitle: row.display_title || "",
    documentType: row.document_type || "Other",
    packetSection: row.packet_section || guessPacketSectionForLibrary(detectionName),
    tocLevel: normalizeLibraryTOCLevel(meta.tocLevel),
    hideParentTOC: !!meta.hideParentTOC,
    category: normalizeLibraryCategory(meta.category),
    tocEntries: Array.isArray(meta.tocEntries) ? meta.tocEntries : [],
    manufacturer: row.manufacturer || "",
    modelNumber: row.model_number || "",
    tags: row.tags || "",
    notes: row.notes || "",
    storagePath: row.storage_path || "",
    attachmentFileName: row.file_name || ""
  };
}

function toSupabaseDocument(item) {
  return {
    file_name: item.fileName || "",
    display_title: item.displayTitle || "",
    document_type: item.documentType || "Other",
    packet_section: getLibraryPacketSection(item),
    manufacturer: item.manufacturer || "",
    model_number: item.modelNumber || "",
    tags: getLibraryTagsWithMeta(item.tags || "", {
      tocLevel: item.tocLevel,
      hideParentTOC: item.hideParentTOC,
      category: normalizeLibraryCategory(item.category),
      tocEntries: item.tocEntries || []
    }),
    notes: item.notes || "",
    storage_path: item.storagePath || "",
    //updated_at: new Date().toISOString()
  };
}

function sortLibraryDB() {
  libraryDB.sort((a, b) => {
    const categoryCompare = DATABASE_CATEGORIES.indexOf(normalizeLibraryCategory(a.category)) -
      DATABASE_CATEGORIES.indexOf(normalizeLibraryCategory(b.category));
    if (categoryCompare !== 0) return categoryCompare;

    if ((a.documentType || "") === (b.documentType || "")) {
      return (a.displayTitle || "").localeCompare(b.displayTitle || "");
    }

    return (a.documentType || "").localeCompare(b.documentType || "");
  });
}

function renderLibraryDB() {
  const container = document.getElementById("libraryCategoryTables");
  if (!container) return;

  container.innerHTML = "";

  const list = getFilteredLibraryItems();
  updateLibraryCount(list.length);

  DATABASE_CATEGORIES.forEach(category => {
    const categoryItems = list.filter(item => normalizeLibraryCategory(item.category) === category);

    const details = document.createElement("details");
    details.className = "library-category-section";
    details.open = true;

    details.innerHTML = `
      <summary>
        <span>${category}</span>
        <strong>${categoryItems.length} document${categoryItems.length === 1 ? "" : "s"}</strong>
      </summary>
      <div class="library-table-wrap">
        ${categoryItems.length === 0
          ? `<p class="library-empty-category">0 documents</p>`
          : `<table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Date</th>
              <th>File Name</th>
              <th>File Location</th>
              <th>Document Type</th>
              <th>TOC Section</th>
              <th>Category</th>
              <th>Notes</th>
              <th>PDF Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>`}
      </div>
    `;

    const tbody = details.querySelector("tbody");
    if (!tbody) {
      container.appendChild(details);
      return;
    }

    categoryItems.forEach(item => {
      const row = document.createElement("tr");

    const docOptions = documentTypes.map(opt => `
      <option value="${opt}" ${opt === item.documentType ? "selected" : ""}>
        ${opt}
      </option>
    `).join("");
    const sectionOptions = packetSections
      .filter(section => !["Cover Page", "Table of Contents"].includes(section))
      .map(section => `
        <option value="${section}" ${section === getLibraryPacketSection(item) ? "selected" : ""}>
          ${section}
        </option>
      `)
      .join("");
    const categoryOptions = DATABASE_CATEGORIES
      .map(category => `
        <option value="${category}" ${category === normalizeLibraryCategory(item.category) ? "selected" : ""}>
          ${category}
        </option>
      `)
      .join("");
    const levelCount = (item.tocEntries || []).length;

    row.innerHTML = `
      <td>
        <input
          type="checkbox"
          ${selectedLibraryPDFIds.has(item.id) ? "checked" : ""}
          onchange="toggleLibraryPDFSelection('${item.id}', this.checked)"
        />
      </td>

      <td>${item.uploadDate || ""}</td>

      <td>
        <input
          value="${escapeHTML(item.fileName || "")}"
          onchange="updateLibraryDBItem('${item.id}', 'fileName', this.value)"
        />
      </td>

      <td>
        <input
          value="${escapeHTML(item.displayTitle || "")}"
          onchange="updateLibraryDBItem('${item.id}', 'displayTitle', this.value)"
        />
      </td>

      <td>
        <select onchange="updateLibraryDBItem('${item.id}', 'documentType', this.value)">
          ${docOptions}
        </select>
      </td>

      <td>
        <div class="library-build-level-cell">
          <select
            aria-label="TOC section"
            onchange="updateLibraryDBItem('${item.id}', 'packetSection', this.value)">
            ${sectionOptions}
          </select>
          <span class="library-level-summary">
            ${levelCount} formatted level row${levelCount === 1 ? "" : "s"}
            ${item.hideParentTOC ? " | PDF name hidden" : ""}
          </span>
        </div>
      </td>

      <td>
        <select onchange="updateLibraryDBItem('${item.id}', 'category', this.value)">
          ${categoryOptions}
        </select>
      </td>

      <td>
        <input
          value="${escapeHTML(item.notes || "")}"
          onchange="updateLibraryDBItem('${item.id}', 'notes', this.value)"
        />
      </td>

      <td>
        ${
          item.storagePath
            ? `
              <div class="pdf-attachment-card has-attachment">
                <div class="pdf-attachment-summary">
                  <span class="pdf-attachment-status">Attached PDF</span>
                  <span class="attachment-name">
                    ${escapeHTML(item.attachmentFileName || item.fileName || "")}
                  </span>
                </div>

                <div class="attachment-action-groups">
                  <div class="attachment-action-group attachment-action-primary">
                    <button onclick="previewLibraryPDF('${item.id}')">
                      Format Levels
                    </button>
                  </div>

                  <div class="attachment-action-group attachment-action-builders">
                    <button onclick="addLibraryPDFToBuilder('${item.id}', 'submittal')">
                      Submittal
                    </button>

                    <button onclick="addLibraryPDFToBuilder('${item.id}', 'om')">
                      O&amp;M
                    </button>
                  </div>

                  <div class="attachment-action-group attachment-action-files">
                    <button class="secondary" onclick="downloadLibraryPDF('${item.id}')">
                      Download
                    </button>

                    <button class="secondary" onclick="renameLibraryFile('${item.id}')">
                      Rename
                    </button>

                    <button
                      class="delete-btn"
                      onclick="removeAttachmentFromLibraryItem('${item.id}')">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            `
            : `
              <div class="pdf-attachment-card empty">
                <div class="pdf-attachment-summary">
                  <span class="pdf-attachment-status">No PDF attached</span>
                  <span class="attachment-name">Attach a PDF to manage or merge it.</span>
                </div>

                <label class="attach-pdf-btn attachment-upload-btn">
                  Attach PDF
                  <input
                  type="file"
                  accept="application/pdf"
                  style="display:none;"
                  onchange="attachPDFToLibraryItem('${item.id}', this.files[0]); this.value='';"
                />
                </label>
              </div>
            `
        }
      </td>
    `;

      tbody.appendChild(row);
    });

    container.appendChild(details);
  });
}

function getFilteredLibraryItems() {
  const searchEl = document.getElementById("librarySearch");
  const search = searchEl && searchEl.value
    ? searchEl.value.trim().toLowerCase()
    : "";
  const typeFilter = document.getElementById("libraryTypeFilter")?.value || "";

  return libraryDB.filter(item => {
    if (typeFilter && item.documentType !== typeFilter) {
      return false;
    }

    if (search) {
        const hay = [
          item.fileName,
          item.displayTitle,
          item.documentType,
          item.packetSection,
          normalizeLibraryCategory(item.category),
          item.manufacturer,
          item.modelNumber,
          item.tags,
          item.notes
        ].join(" ").toLowerCase();

        return hay.includes(search);
    }

    return true;
  });
}

function formatStorageBytes(bytes) {
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

async function updateDatabaseStorageUsage() {
  const usageCard = document.getElementById("databaseStorageUsage");
  if (!usageCard) return;

  if (!useRemoteDatabase) {
    usageCard.classList.add("hidden");
    return;
  }

  usageCard.classList.remove("hidden");

  const label = usageCard.querySelector(".storage-usage-label span");
  const bar = usageCard.querySelector(".storage-usage-bar span");
  const detail = usageCard.querySelector("p");
  const attachedCount = libraryDB.filter(item => item.storagePath).length;

  usageCard.classList.remove("warning", "danger");

  if (!useRemoteDatabase || typeof supabaseClient === "undefined" || !supabaseClient) {
    if (label) label.textContent = "Log in to view shared storage.";
    if (bar) bar.style.width = "0%";
    if (detail) detail.textContent = `PDF attachments: ${attachedCount}`;
    return;
  }

  if (label) label.textContent = "Checking...";
  if (detail) detail.textContent = `PDF attachments: ${attachedCount}`;

  try {
    const usedBytes = await getStorageFolderUsageBytes("");
    const percentUsed = DATABASE_STORAGE_LIMIT_BYTES > 0
      ? Math.min(100, (usedBytes / DATABASE_STORAGE_LIMIT_BYTES) * 100)
      : 0;

    if (label) {
      label.textContent =
        `${formatStorageBytes(usedBytes)} of ${formatStorageBytes(DATABASE_STORAGE_LIMIT_BYTES)} used`;
    }

    if (bar) {
      bar.style.width = `${percentUsed.toFixed(1)}%`;
    }

    if (detail) {
      detail.textContent =
        `PDF attachments: ${attachedCount} · ${percentUsed.toFixed(1)}% used`;
    }

    if (detail) {
      detail.textContent =
        `PDF attachments: ${attachedCount} - ${percentUsed.toFixed(1)}% used`;
    }

    usageCard.classList.toggle("warning", percentUsed >= 75 && percentUsed < 90);
    usageCard.classList.toggle("danger", percentUsed >= 90);
  } catch (error) {
    console.warn("Could not calculate storage usage:", error);
    if (label) label.textContent = "Storage usage unavailable.";
    if (bar) bar.style.width = "0%";
    if (detail) detail.textContent = `PDF attachments: ${attachedCount}`;
  }
}

async function getStorageFolderUsageBytes(path) {
  let totalBytes = 0;
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabaseClient.storage
      .from(DOCUMENTS_BUCKET)
      .list(path, {
        limit,
        offset,
        sortBy: {
          column: "name",
          order: "asc"
        }
      });

    if (error) throw error;

    const entries = data || [];

    for (const entry of entries) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      const size = entry.metadata?.size;

      if (typeof size === "number") {
        totalBytes += size;
      } else {
        totalBytes += await getStorageFolderUsageBytes(entryPath);
      }
    }

    if (entries.length < limit) break;
    offset += limit;
  }

  return totalBytes;
}

function setPendingLibraryPdf(file) {
  if (!file || file.type !== "application/pdf") {
    showLibraryMessage("PDF Required", "Please select a PDF file.");
    updateDatabaseUploadStatus("Only PDF files can be added to the database.");
    return;
  }

  pendingLibraryPdf = file;

  const selected = document.getElementById("selectedLibraryPdf");
  if (selected) {
    selected.textContent = `Selected PDF: ${file.name}`;
  }

  if (file.size > DATABASE_DIRECT_UPLOAD_LIMIT_BYTES) {
    updateDatabaseUploadStatus(
      `Selected PDF: ${file.name}. This file is ${formatStorageBytes(file.size)}, so the database record can be saved, but the PDF cannot be uploaded until the file is under ${formatStorageBytes(DATABASE_DIRECT_UPLOAD_LIMIT_BYTES)}.`
    );
  } else {
    updateDatabaseUploadStatus(`Selected PDF: ${file.name}`);
  }

  const fileNameInput = document.getElementById("libFileName");
  const titleInput = document.getElementById("libDisplayTitle");
  const docTypeSelect = document.getElementById("libDocumentType");
  const sectionSelect = document.getElementById("libPacketSection");

  const cleanName = getLibraryPdfDisplayName(file.name);
  const guessedSection = guessPacketSectionForLibrary(file.name);

  if (fileNameInput) {
    fileNameInput.value = cleanName;
  }

  if (docTypeSelect) {
    docTypeSelect.value = guessDocumentTypeForLibrary(file.name);
  }

  if (sectionSelect) {
    sectionSelect.value = guessedSection;
  }

}

function getLibraryPdfDisplayName(fileName = "") {
  return String(fileName || "")
    .replace(/\.pdf$/i, "")
    .trim();
}

function clearLibraryUpload() {
  pendingLibraryPdf = null;

  const upload = document.getElementById("libraryPdfUpload");
  if (upload) upload.value = "";

  const selected = document.getElementById("selectedLibraryPdf");
  if (selected) {
    selected.textContent = "No PDF selected yet.";
  }

  updateDatabaseUploadStatus();
}

function setupLibraryDropZone() {
  const upload = document.getElementById("libraryPdfUpload");
  const dropZone = document.getElementById("libraryDropZone");

  if (upload) {
    upload.addEventListener("change", event => {
      const file = event.target.files[0];
      if (file) setPendingLibraryPdf(file);
    });
  }

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

    const file = Array.from(event.dataTransfer.files)
      .find(file => file.type === "application/pdf");

    if (file) setPendingLibraryPdf(file);
  });
}

function guessDocumentTypeForLibrary(fileName = "") {
  const section = guessPacketSectionForLibrary(fileName);

  if (section === "Datasheets") return "Datasheet";
  if (section === "Shop Drawings") return "Shop Drawing";
  if (section === "Electrical Schematics") return "Electrical Schematics";
  if (section === "Manuals") return "Manual";

  return section;
}

async function addLibraryEntry(entry, options = {}) {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return;

  const { data: existing, error: checkError } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .select("id")
    .or(`file_name.eq.${entry.fileName || ""},display_title.eq.${entry.displayTitle || ""}`);

  if (checkError) {
    console.error("Duplicate check failed:", checkError);
  }

  if (existing && existing.length > 0) {
    if (!options.silent) {
      await showLibraryMessage("Duplicate Entry", `Duplicate entry for "${entry.fileName || entry.displayTitle}" already exists.`);
    }
    return;
  }

  const { error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .insert([toSupabaseDocument(entry)]);

  if (error) {
    console.error("FULL ERROR", JSON.stringify(error, null, 2));
    await showLibraryMessage("Could Not Add Entry", error.message || "Could not add the database entry.");
    return;
  }

  if (entry.id) libraryPDFBlobCache.delete(entry.id);
  await loadLibraryDB();
}

async function removeLibraryDBEntry(id) {
  const item = libraryDB.find(x => x.id === id);

  if (!(await confirmLibraryAction("Remove Entry", "Remove this library entry?", "Remove"))) return;

  if (item && item.storagePath) {
    await supabaseClient.storage
      .from(DOCUMENTS_BUCKET)
      .remove([item.storagePath]);
  }

  const { error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error removing entry:", error);
    await showLibraryMessage("Could Not Remove Entry", "Could not remove this database entry.");
    return;
  }

  await loadLibraryDB();
}

async function removeSelectedLibraryEntries() {
  if (!useRemoteDatabase || typeof supabaseClient === "undefined" || !supabaseClient) {
    await showLibraryMessage("Login Needed", "Log in before removing shared database documents.");
    updateDatabaseStatus("Log in before removing shared database documents.");
    return;
  }

  const selectedIds = Array.from(selectedLibraryPDFIds);

  if (selectedIds.length === 0) {
    await showLibraryMessage("Select Documents", "Select one or more documents to remove.");
    updateDatabaseStatus("Select one or more documents to remove.");
    return;
  }

  const selectedItems = selectedIds
    .map(id => libraryDB.find(item => item.id === id))
    .filter(Boolean);

  if (selectedItems.length === 0) {
    selectedLibraryPDFIds.clear();
    renderLibraryDB();
    updateDatabaseStatus("No selected documents were found.");
    return;
  }

  const attachedCount = selectedItems.filter(item => item.storagePath).length;
  const confirmMessage =
    `Remove ${selectedItems.length} selected document(s) from the library?` +
    (attachedCount > 0 ? ` This will also remove ${attachedCount} attached PDF(s).` : "");

  if (!(await confirmLibraryAction("Remove Documents", confirmMessage, "Remove"))) return;

  updateDatabaseStatus(`Removing ${selectedItems.length} selected document(s)...`);

  const storagePaths = selectedItems
    .map(item => item.storagePath)
    .filter(Boolean);

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabaseClient.storage
      .from(DOCUMENTS_BUCKET)
      .remove(storagePaths);

    if (storageError) {
      console.warn("Some selected PDF attachments could not be removed:", storageError);
    }
  }

  const { error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .delete()
    .in("id", selectedItems.map(item => item.id));

  if (error) {
    console.error("Error removing selected entries:", error);
    await showLibraryMessage("Could Not Remove Documents", "Could not remove the selected documents.");
    updateDatabaseStatus(`Could not remove selected documents: ${error.message || "database error"}`);
    return;
  }

  selectedLibraryPDFIds.clear();
  await loadLibraryDB();
  updateDatabaseStatus(`Removed ${selectedItems.length} selected document(s).`);
}

async function updateLibraryDBItem(id, field, value) {
  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  item[field] = value;

  if (field === "fileName" || field === "displayTitle") {
    item.packetSection = guessPacketSectionForLibrary(item.fileName || item.displayTitle || "");
  }

  const { error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .update(toSupabaseDocument(item))
    .eq("id", id);

  if (error) {
    console.error("Error updating entry:", error);
    await showLibraryMessage("Could Not Update Entry", "Could not update this database entry.");
    return;
  }

  await loadLibraryDB();
}

async function renameLibraryFile(id) {
  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  const currentName = item.attachmentFileName || item.fileName || "";

  const newName = await openDatabaseMessageModal(
    "Rename PDF",
    "Enter the new PDF file name.",
    {
      input: {
        label: "PDF file name",
        value: currentName,
        placeholder: "Example: Brush Machine.pdf"
      },
      confirmLabel: "Rename",
      cancelLabel: "Cancel"
    }
  );
  if (newName === null) return;

  let cleanName = newName.trim();

  if (!cleanName) {
    await showLibraryMessage("File Name Required", "File name cannot be blank.");
    return;
  }

  if (!cleanName.toLowerCase().endsWith(".pdf")) {
    cleanName += ".pdf";
  }

  item.fileName = cleanName;
  item.attachmentFileName = cleanName;

  const { error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .update({
      file_name: cleanName,
      //updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.error("Error renaming file:", error);
    await showLibraryMessage("Could Not Rename File", "Could not rename this file.");
    return;
  }

  await loadLibraryDB();
}

async function attachPDFToLibraryItem(id, file) {
  if (!file) return;

  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  if (file.size > DATABASE_DIRECT_UPLOAD_LIMIT_BYTES) {
    const message =
      `${file.name} is ${formatStorageBytes(file.size)}, which is over the current ${formatStorageBytes(DATABASE_DIRECT_UPLOAD_LIMIT_BYTES)} direct upload limit. ` +
      "Increase the Supabase Storage file size limit for the document-library bucket, or compress/split the PDF before uploading.";
    await showLibraryMessage("PDF Too Large", message);
    updateDatabaseUploadStatus(message);
    return false;
  }

  const safeFileName = file.name.replace(/[^\w.\- ]+/g, "_");
  const storagePath = `${id}/${Date.now()}-${safeFileName}`;

  updateDatabaseUploadStatus(`Uploading PDF: ${file.name}...`);

  const { error: uploadError } = await supabaseClient.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (uploadError) {
    console.error("PDF upload failed:", uploadError);
    const uploadMessage = /maximum allowed size|exceeded/i.test(uploadError.message || "")
      ? `${file.name} could not upload because it is larger than the storage limit currently allowed by Supabase. The file is ${formatStorageBytes(file.size)}.`
      : `Could not upload PDF: ${uploadError.message || "storage error"}`;
    await showLibraryMessage("Upload Failed", uploadMessage);
    updateDatabaseUploadStatus(uploadMessage);
    return false;
  }

  item.storagePath = storagePath;
  item.fileName = item.fileName || file.name;
  item.attachmentFileName = file.name;

  const { error: updateError } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .update({
      file_name: item.fileName,
      storage_path: storagePath,
      //updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error saving PDF path:", updateError);
    await showLibraryMessage("Database Update Failed", "PDF uploaded, but the database did not update.");
    updateDatabaseUploadStatus(`PDF uploaded, but database update failed: ${updateError.message || "database error"}`);
    return false;
  }

  libraryPDFBlobCache.delete(id);
  await loadLibraryDB();
  updateDatabaseUploadStatus(`Uploaded PDF: ${file.name}`);
  return true;
}

async function downloadLibraryPDF(id) {
  const item = libraryDB.find(x => x.id === id);
  if (!item || !item.storagePath) {
    await showLibraryMessage("PDF Not Attached", "PDF attachment not found.");
    updateDatabaseStatus("PDF attachment not found.");
    return;
  }

  updateDatabaseStatus(`Preparing download: ${item.attachmentFileName || item.fileName || "PDF"}...`);

  const { data, error } = await supabaseClient.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(item.storagePath, 60);

  if (error || !data || !data.signedUrl) {
    console.error("Could not create download link:", error);
    await showLibraryMessage("Could Not Download PDF", "Could not download this PDF.");
    updateDatabaseStatus(`Could not download PDF: ${error?.message || "storage error"}`);
    return;
  }

  const response = await fetch(data.signedUrl);
  const blob = await response.blob();

  const fileName = item.attachmentFileName || item.fileName || "download.pdf";

  downloadFile(blob, fileName, "application/pdf");
  updateDatabaseStatus(`Downloaded PDF: ${fileName}`);
}

async function removeAttachmentFromLibraryItem(id) {
  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  if (!(await confirmLibraryAction("Remove Attached PDF", "Remove the attached PDF?", "Remove"))) return;

  if (item.storagePath) {
    const { error: storageError } = await supabaseClient.storage
      .from(DOCUMENTS_BUCKET)
      .remove([item.storagePath]);

    if (storageError) {
      console.warn("Storage file may already be missing:", storageError);
    }
  }

  const { error: updateError } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .update({
      storage_path: ""
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error clearing PDF path:", updateError);
    await showLibraryMessage("Database Update Failed", "PDF removed, but the database did not update.");
    return;
  }

  item.storagePath = "";
  libraryPDFBlobCache.delete(id);

  await loadLibraryDB();
}

function exportLibraryCSV() {
  const headers = [
    "Date",
    "File Name",
    "File Location",
    "Document Type",
    "Packet Section",
    "Category",
    "Notes",
    "Storage Path"
  ];

  const rows = libraryDB.map(i => [
    i.uploadDate,
    i.fileName,
    i.displayTitle,
    i.documentType,
    getLibraryPacketSection(i),
    normalizeLibraryCategory(i.category),
    i.notes,
    i.storagePath
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadFile(csv, "document-library.csv", "text/csv");
}

async function mergeSubmittalIntoLibrary(items) {
  for (const i of items) {
    const entry = {
      fileName: i.fileName || "",
      displayTitle: i.displayTitle || "",
      documentType: i.documentType || "Other",
      packetSection: i.packetSection || guessPacketSectionForLibrary(i.fileName || i.displayTitle || ""),
      category: normalizeLibraryCategory(i.category),
      tocLevel: 0,
      hideParentTOC: !!i.hideParentTOC,
      tocEntries: Array.isArray(i.tocEntries)
        ? i.tocEntries.map(entry => ({ ...entry }))
        : [],
      notes: "",
      storagePath: ""
    };

    const { data, error } = await supabaseClient
      .from(DOCUMENTS_TABLE)
      .insert([toSupabaseDocument(entry)])
      .select()
      .single();

    if (error) {
      console.error("Error merging item into library:", error);
      continue;
    }

    if (i.file && data && data.id) {
      await attachPDFToLibraryItem(data.id, i.file);
    }
  }

  await loadLibraryDB();
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function addLibraryEntryFromForm() {
  const fileName = document.getElementById("libFileName").value.trim();
  const displayTitle = document.getElementById("libDisplayTitle").value.trim();
  const documentType = document.getElementById("libDocumentType").value;
  const packetSection =
    document.getElementById("libPacketSection")?.value ||
    guessPacketSectionForLibrary(fileName || displayTitle || "");
  const category = normalizeLibraryCategory(
    document.getElementById("libCategory")?.value || "Generic"
  );
  const notes = document.getElementById("libNotes").value.trim();

  if (!displayTitle && !fileName && !pendingLibraryPdf) {
    await showLibraryMessage("Entry Info Needed", "Provide a file name, file location, or PDF.");
    return;
  }

  const finalFileName =
    fileName ||
    getLibraryPdfDisplayName(pendingLibraryPdf?.name) ||
    "";

  const entry = {
    fileName: finalFileName,
    displayTitle,
    documentType,
    packetSection,
    category,
    tocLevel: 0,
    hideParentTOC: false,
    tocEntries: [],
    notes,
    storagePath: ""
  };

  updateDatabaseUploadStatus("Adding document to library...");

  const { data, error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .insert([toSupabaseDocument(entry)])
    .select()
    .single();

  if (error) {
    console.error("Error adding entry:", error);
    await showLibraryMessage("Could Not Add Entry", "Could not add this database entry.");
    updateDatabaseUploadStatus(`Could not add document: ${error.message || "database error"}`);
    return;
  }

  const hadPendingLibraryPdf = !!pendingLibraryPdf;
  let attachmentUploaded = false;
  if (pendingLibraryPdf) {
    libraryDB.push(fromSupabaseDocument(data));

    attachmentUploaded = await attachPDFToLibraryItem(data.id, pendingLibraryPdf);
  }

  document.getElementById("libFileName").value = "";
  document.getElementById("libDisplayTitle").value = "";
  document.getElementById("libPacketSection").value = "Datasheets";
  document.getElementById("libCategory").value = "Generic";
  document.getElementById("libNotes").value = "";

  clearLibraryUpload();
  await loadLibraryDB();
  const addedName = finalFileName || displayTitle || "Untitled";
  updateDatabaseUploadStatus(
    hadPendingLibraryPdf && !attachmentUploaded
      ? `Added document record: ${addedName}. The PDF was not attached.`
      : `Added document: ${addedName}`
  );
}

function toggleLibraryPDFSelection(id, checked) {
  if (checked) {
    selectedLibraryPDFIds.add(id);
  } else {
    selectedLibraryPDFIds.delete(id);
  }

  updateLibraryCount(getFilteredLibraryItems().length);
  updateDatabaseStatus(`${selectedLibraryPDFIds.size} document(s) selected.`);
}

async function getLibraryPDFBlob(item) {
  if (!item || !item.storagePath) {
    throw new Error("PDF attachment not found.");
  }

  if (libraryPDFBlobCache.has(item.id)) {
    return libraryPDFBlobCache.get(item.id);
  }

  const { data, error } = await supabaseClient.storage
    .from(DOCUMENTS_BUCKET)
    .download(item.storagePath);

  if (error || !data) {
    console.error("PDF download failed:", error);
    throw new Error("Could not download PDF from storage.");
  }

  libraryPDFBlobCache.set(item.id, data);
  return data;
}

async function saveLibraryPDFToBuilder(item, target) {
  const targetLabel = target === "om" ? "O&M" : "Submittal";

  updateDatabaseStatus(`Adding ${item.fileName || "PDF"} to ${targetLabel} builder...`);
  const blob = await getLibraryPDFBlob(item);

  await saveBuilderHandoffItem(
    target === "om" ? "om" : "submittal",
    {
      source: "database",
      sourceLibraryId: item.id,
      fileName: item.attachmentFileName || item.fileName || "database-file.pdf",
      displayTitle: getLibraryBuilderDisplayTitle(item),
      documentType: item.documentType || "Other",
      packetSection: getLibraryPacketSection(item),
      tocLevel: 0,
      hideParentTOC: !!item.hideParentTOC,
      tocEntries: getLibraryBuilderTOCEntries(item),
      notes: item.notes || ""
    },
    blob
  );
}

function openBuilderTarget(target) {
  window.location.href = target === "om"
    ? "om.html?from=database"
    : "submittal.html?from=database";
}

async function validateLibraryBuilderHandoff() {
  if (typeof saveBuilderHandoffItem !== "function") {
    await showLibraryMessage("Builder Unavailable", "Builder handoff is not available in this browser.");
    updateDatabaseStatus("Builder handoff is not available in this browser.");
    return false;
  }

  return true;
}

async function validateLibraryItemsForBuilder(items = []) {
  const invalidItem = items.find(item => getLibraryHideParentValidationMessage(item));
  if (!invalidItem) return true;

  const message = getLibraryHideParentValidationMessage(invalidItem);
  await showLibraryMessage("Fix Database Levels", message);
  updateDatabaseStatus(message);
  return false;
}

async function addLibraryPDFToBuilder(id, target) {
  const item = libraryDB.find(x => x.id === id);
  const targetLabel = target === "om" ? "O&M" : "Submittal";

  if (!item || !item.storagePath) {
    await showLibraryMessage("PDF Not Attached", "Attach a PDF before adding this document to a builder.");
    updateDatabaseStatus("Attach a PDF before adding it to a builder.");
    return;
  }

  if (!(await validateLibraryBuilderHandoff())) return;
  if (!(await validateLibraryItemsForBuilder([item]))) return;

  try {
    await saveLibraryPDFToBuilder(item, target);
    updateDatabaseStatus(`Opening ${targetLabel} builder...`);
    openBuilderTarget(target);
  } catch (error) {
    console.error("Could not add database PDF to builder:", error);
    await showLibraryMessage("Could Not Add PDF", `Could not add this PDF to the ${targetLabel} builder.`);
    updateDatabaseStatus(`Could not add PDF to ${targetLabel}: ${error.message || "Please try again."}`);
  }
}

async function addSelectedLibraryPDFsToBuilder(target) {
  const targetLabel = target === "om" ? "O&M" : "Submittal";
  const selectedItems = Array.from(selectedLibraryPDFIds)
    .map(id => libraryDB.find(item => item.id === id))
    .filter(item => item && item.storagePath);

  if (selectedItems.length === 0) {
    await showLibraryMessage("Select Attached PDFs", "Select at least one PDF with an attachment.");
    updateDatabaseStatus("Select at least one PDF with an attachment.");
    return;
  }

  if (!(await validateLibraryBuilderHandoff())) return;
  if (!(await validateLibraryItemsForBuilder(selectedItems))) return;

  try {
    for (const [index, item] of selectedItems.entries()) {
      updateDatabaseStatus(
        `Adding ${index + 1} of ${selectedItems.length} selected PDFs to ${targetLabel} builder...`
      );
      await saveLibraryPDFToBuilder(item, target);
    }

    updateDatabaseStatus(`Opening ${targetLabel} builder with ${selectedItems.length} PDF(s)...`);
    openBuilderTarget(target);
  } catch (error) {
    console.error(`Could not add selected database PDFs to ${targetLabel}:`, error);
    await showLibraryMessage("Could Not Add PDFs", `Could not add the selected PDFs to the ${targetLabel} builder.`);
    updateDatabaseStatus(`Could not add selected PDFs to ${targetLabel}: ${error.message || "Please try again."}`);
  }
}

let activePreviewLibraryItem = null;
let selectedLibraryPreviewPages = new Set();
let activeLibraryPreviewPageCount = 0;

function resetLibraryPreviewModalForItem(item) {
  const title = document.getElementById("libraryPreviewTitle");
  const list = document.getElementById("libraryPreviewPageList");
  const status = document.getElementById("libraryPreviewStatus");
  const entryList = document.getElementById("libraryLevelEntryList");
  const hideParentTOC = document.getElementById("libraryHideParentTOC");

  if (title) title.textContent = item?.fileName || item?.displayTitle || "Format Levels";
  if (list) list.innerHTML = `<p class="toc-tree-empty">Loading preview...</p>`;
  if (status) status.textContent = "Loading pages...";
  if (entryList) entryList.innerHTML = `<p class="toc-tree-empty">Loading levels...</p>`;
  if (hideParentTOC) hideParentTOC.checked = !!item?.hideParentTOC;

  clearLibraryLevelForm();
}

async function previewLibraryPDF(id) {
  try {
    const item = libraryDB.find(x => x.id === id);

    if (!item || !item.storagePath) {
      await showLibraryMessage("PDF Not Attached", "No PDF is attached to preview.");
      return;
    }

    activePreviewLibraryItem = item;
    selectedLibraryPreviewPages = new Set();
    activeLibraryPreviewPageCount = 0;

    const modal = document.getElementById("libraryPreviewModal");
    const list = document.getElementById("libraryPreviewPageList");

    resetLibraryPreviewModalForItem(item);
    modal.classList.remove("hidden");

    const blob = await getLibraryPDFBlob(item);
    const bytes = await blob.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    activeLibraryPreviewPageCount = pdf.numPages;

    list.innerHTML = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const pageCard = document.createElement("div");
      const header = document.createElement("label");
      const checkbox = document.createElement("input");
      const label = document.createElement("span");

      pageCard.className = "page-manager-card";
      pageCard.dataset.pageNumber = String(pageNumber);
      header.className = "page-manager-card-header";
      checkbox.type = "checkbox";
      checkbox.value = String(pageNumber);
      label.textContent = `Page ${pageNumber}`;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const updateSelection = checked => {
        checkbox.checked = checked;
        pageCard.classList.toggle("selected", checked);

        if (checked) {
          selectedLibraryPreviewPages.add(pageNumber);
        } else {
          selectedLibraryPreviewPages.delete(pageNumber);
        }

        updateLibraryPreviewStatus();
      };

      checkbox.addEventListener("change", () => {
        updateSelection(checkbox.checked);
      });

      pageCard.addEventListener("click", event => {
        if (event.target === checkbox) return;
        setLibraryLevelSelectedPage(pageNumber);
        updateSelection(!checkbox.checked);
      });

      header.appendChild(checkbox);
      header.appendChild(label);
      pageCard.appendChild(header);
      pageCard.appendChild(canvas);
      list.appendChild(pageCard);

      await page.render({
        canvasContext: context,
        viewport
      }).promise;
    }

    updateLibraryPreviewStatus();
    updateLibraryHideParentTOCControl();
    renderLibraryLevelEntryList();
    updateLibraryLevelParentDropdown();
  } catch (error) {
    console.error("Preview failed:", error);
    await showLibraryMessage("Could Not Preview PDF", "Could not preview this PDF.");
  }
}

function closeLibraryPreviewModal() {
  document.getElementById("libraryPreviewModal").classList.add("hidden");
  activePreviewLibraryItem = null;
  selectedLibraryPreviewPages = new Set();
  activeLibraryPreviewPageCount = 0;
}

function updateLibraryPreviewStatus() {
  const status = document.getElementById("libraryPreviewStatus");
  if (!status) return;

  status.textContent =
    `${selectedLibraryPreviewPages.size} of ${activeLibraryPreviewPageCount} page(s) selected`;
}

function setLibraryLevelSelectedPage(pageNumber) {
  const input = document.getElementById("libraryLevelPageNumber");
  if (input) input.value = String(pageNumber);
}

function normalizeLibraryLevelEntry(entry = {}) {
  const tocLevel = normalizeLibraryTOCLevel(entry.tocLevel);

  return {
    id: entry.id || crypto.randomUUID(),
    title: String(entry.title || "").trim(),
    sourcePage: Number(entry.sourcePage || 1),
    entryType: tocLevel === 0 ? "section" : "subsection",
    tocLevel,
    parentId: tocLevel === 0 ? "" : entry.parentId || "",
    detectedTOCEntry: false
  };
}

function orderLibraryLevelEntries(entries = []) {
  return [...entries]
    .map(normalizeLibraryLevelEntry)
    .sort((a, b) =>
      Number(a.sourcePage || 0) - Number(b.sourcePage || 0) ||
      Number(a.tocLevel || 0) - Number(b.tocLevel || 0)
    );
}

function getLibraryLevelParentTitle(parentId) {
  if (!parentId || !activePreviewLibraryItem) return "N/A";
  if (parentId === DATABASE_PDF_PARENT_TOC_ID) {
    return getLibraryBuilderDisplayTitle(activePreviewLibraryItem);
  }

  const parent = (activePreviewLibraryItem.tocEntries || [])
    .find(entry => entry.id === parentId);
  return parent ? parent.title : "N/A";
}

function cleanInvalidLibraryLevelParents(item) {
  if (!item) return;

  const entries = item.tocEntries || [];
  const validIds = new Set(entries.map(entry => entry.id));

  entries.forEach(entry => {
    const level = normalizeLibraryTOCLevel(entry.tocLevel);

    if (level === 0) {
      entry.parentId = "";
      return;
    }

    const usesVisiblePdfParent =
      level - 1 === 0 &&
      entry.parentId === DATABASE_PDF_PARENT_TOC_ID &&
      !item.hideParentTOC;

    if (usesVisiblePdfParent) return;

    const parent = entries.find(candidate => candidate.id === entry.parentId);
    const expectedParentLevel = level - 1;

    if (!entry.parentId || !validIds.has(entry.parentId) || normalizeLibraryTOCLevel(parent?.tocLevel) !== expectedParentLevel) {
      entry.parentId = "";
    }
  });
}

function getDefaultLibraryLevelParentId(options = [], currentParentId = "") {
  if (currentParentId && options.some(entry => entry.id === currentParentId)) {
    return currentParentId;
  }

  return options.length ? options[options.length - 1].id : "";
}

function updateLibraryLevelParentDropdown(selectedParentId = "") {
  const levelSelect = document.getElementById("libraryLevelValue");
  const parentSelect = document.getElementById("libraryLevelParent");
  const editId = document.getElementById("activeLibraryLevelEntryId")?.value || "";
  const currentParentId = selectedParentId || parentSelect.value || "";

  if (!activePreviewLibraryItem || !levelSelect || !parentSelect) return;

  const level = normalizeLibraryTOCLevel(levelSelect.value);
  parentSelect.innerHTML = "";

  if (level === 0) {
    parentSelect.disabled = true;
    parentSelect.innerHTML = `<option value="">N/A</option>`;
    return;
  }

  const expectedParentLevel = level - 1;
  const options = [];

  if (expectedParentLevel === 0 && !activePreviewLibraryItem.hideParentTOC) {
    options.push({
      id: DATABASE_PDF_PARENT_TOC_ID,
      title: getLibraryBuilderDisplayTitle(activePreviewLibraryItem)
    });
  }

  options.push(...orderLibraryLevelEntries(activePreviewLibraryItem.tocEntries || [])
    .filter(entry =>
      entry.id !== editId &&
      normalizeLibraryTOCLevel(entry.tocLevel) === expectedParentLevel
    ));

  parentSelect.disabled = options.length === 0;
  parentSelect.appendChild(new Option(options.length ? "Select parent" : "No parent available", ""));

  options.forEach(entry => {
    const label = entry.id === DATABASE_PDF_PARENT_TOC_ID
      ? `PDF Name: ${entry.title}`
      : entry.title;
    parentSelect.appendChild(new Option(label, entry.id));
  });

  parentSelect.value = getDefaultLibraryLevelParentId(options, currentParentId);
}

function clearLibraryLevelForm() {
  const fields = {
    activeLibraryLevelEntryId: "",
    libraryLevelPageNumber: "",
    libraryLevelTitle: "",
    libraryLevelValue: "0"
  };

  Object.entries(fields).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value;
  });

  const action = document.getElementById("libraryLevelActionButton");
  if (action) action.textContent = "Add Level";
  updateLibraryLevelParentDropdown();
}

function updateLibraryHideParentTOCControl() {
  const checkbox = document.getElementById("libraryHideParentTOC");
  if (!checkbox || !activePreviewLibraryItem) return;

  checkbox.checked = !!activePreviewLibraryItem.hideParentTOC;
}

async function updateLibraryHideParentTOCFromCheckbox() {
  const checkbox = document.getElementById("libraryHideParentTOC");
  if (!checkbox || !activePreviewLibraryItem) return;

  if (checkbox.checked && !libraryHasLevelZeroEntry(activePreviewLibraryItem)) {
    checkbox.checked = false;
    await showLibraryMessage(
      "Level 0 Required",
      "Add at least one Level 0 entry before hiding the PDF name in the TOC."
    );
    return;
  }

  activePreviewLibraryItem.hideParentTOC = checkbox.checked;
  cleanInvalidLibraryLevelParents(activePreviewLibraryItem);
  await persistActiveLibraryLevelEntries();
  renderLibraryLevelEntryList();
  updateLibraryLevelParentDropdown();
}

async function showLibraryMessage(title, message) {
  await openDatabaseMessageModal(title, message);
}

async function confirmLibraryAction(title, message, confirmLabel = "OK") {
  return (await openDatabaseMessageModal(title, message, {
    confirmLabel,
    cancelLabel: "Cancel"
  })) === true;
}

function renderLibraryLevelEntryList() {
  const list = document.getElementById("libraryLevelEntryList");
  if (!list || !activePreviewLibraryItem) return;

  const entries = orderLibraryLevelEntries(activePreviewLibraryItem.tocEntries || []);
  list.innerHTML = "";

  if (entries.length === 0) {
    list.innerHTML = `<p class="toc-tree-empty">No levels added yet.</p>`;
    return;
  }

  entries.forEach(entry => {
    const row = document.createElement("div");
    row.className = "toc-tree-row";
    row.style.setProperty("--toc-level", String(normalizeLibraryTOCLevel(entry.tocLevel)));
    row.dataset.libraryLevelEntryId = entry.id;

    row.innerHTML = `
      <span class="toc-tree-rail"></span>

      <div>
        <div class="toc-tree-title">
          <span class="toc-tree-level-badge">Level ${normalizeLibraryTOCLevel(entry.tocLevel)}</span>
          ${escapeHTML(entry.title)}
        </div>
        <div class="toc-tree-meta">
          PDF page ${entry.sourcePage} - Parent ${escapeHTML(getLibraryLevelParentTitle(entry.parentId))}
        </div>
      </div>

      <div class="toc-tree-actions">
        <button type="button" onclick="editLibraryLevelEntry('${entry.id}')">Edit</button>
        <button type="button" class="remove-pdf-btn" onclick="removeLibraryLevelEntry('${entry.id}')">Remove</button>
      </div>
    `;

    list.appendChild(row);
  });
}

async function persistActiveLibraryLevelEntries() {
  if (!activePreviewLibraryItem) return;

  const { error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .update(toSupabaseDocument(activePreviewLibraryItem))
    .eq("id", activePreviewLibraryItem.id);

  if (error) {
    console.error("Could not save library levels:", error);
    await showLibraryMessage("Could Not Save Levels", "Could not save formatted levels.");
    return;
  }

  const libraryItem = libraryDB.find(item => item.id === activePreviewLibraryItem.id);
  if (libraryItem) {
    libraryItem.tocEntries = activePreviewLibraryItem.tocEntries || [];
    libraryItem.hideParentTOC = !!activePreviewLibraryItem.hideParentTOC;
  }

  renderLibraryDB();
}

async function saveLibraryLevelEntry() {
  if (!activePreviewLibraryItem) return;

  const entryId = document.getElementById("activeLibraryLevelEntryId")?.value || "";
  const title = document.getElementById("libraryLevelTitle")?.value.trim() || "";
  const pageNumber = Number(document.getElementById("libraryLevelPageNumber")?.value || 0);
  const tocLevel = normalizeLibraryTOCLevel(document.getElementById("libraryLevelValue")?.value);
  const parentId = tocLevel === 0 ? "" : document.getElementById("libraryLevelParent")?.value || "";

  if (!pageNumber || pageNumber < 1) {
    await showLibraryMessage("Page Required", "Select a page.");
    return;
  }

  if (!title) {
    await showLibraryMessage("TOC Name Required", "Enter a TOC name.");
    return;
  }

  if (tocLevel > 0 && !parentId) {
    await showLibraryMessage("Parent Required", `Select a Level ${tocLevel - 1} parent first.`);
    return;
  }

  const entries = activePreviewLibraryItem.tocEntries || [];
  const existing = entries.find(entry => entry.id === entryId);
  const nextEntry = normalizeLibraryLevelEntry({
    id: entryId || crypto.randomUUID(),
    title,
    sourcePage: pageNumber,
    tocLevel,
    parentId
  });

  if (existing) {
    Object.assign(existing, nextEntry);
  } else {
    entries.push(nextEntry);
  }

  activePreviewLibraryItem.tocEntries = orderLibraryLevelEntries(entries);
  cleanInvalidLibraryLevelParents(activePreviewLibraryItem);

  if (getLibraryHideParentValidationMessage(activePreviewLibraryItem)) {
    await showLibraryMessage(
      "Level 0 Required",
      "This PDF is set to hide the PDF name in the TOC, so it needs at least one Level 0 entry."
    );
    return;
  }

  await persistActiveLibraryLevelEntries();
  clearLibraryLevelForm();
  renderLibraryLevelEntryList();
  updateLibraryLevelParentDropdown();
}

function editLibraryLevelEntry(entryId) {
  if (!activePreviewLibraryItem) return;

  const entry = (activePreviewLibraryItem.tocEntries || [])
    .find(candidate => candidate.id === entryId);
  if (!entry) return;

  document.getElementById("activeLibraryLevelEntryId").value = entry.id;
  document.getElementById("libraryLevelPageNumber").value = entry.sourcePage || "";
  document.getElementById("libraryLevelTitle").value = entry.title || "";
  document.getElementById("libraryLevelValue").value = String(normalizeLibraryTOCLevel(entry.tocLevel));
  const action = document.getElementById("libraryLevelActionButton");
  if (action) action.textContent = "Save Level";
  updateLibraryLevelParentDropdown(entry.parentId || "");
}

async function removeLibraryLevelEntry(entryId) {
  if (!activePreviewLibraryItem) return;

  const previousEntries = activePreviewLibraryItem.tocEntries || [];
  const nextEntries = previousEntries
    .filter(entry => entry.id !== entryId)
    .map(entry => {
      if (entry.parentId === entryId) {
        return { ...entry, parentId: "" };
      }
      return entry;
    });

  const nextItem = {
    ...activePreviewLibraryItem,
    tocEntries: nextEntries
  };

  cleanInvalidLibraryLevelParents(nextItem);

  if (getLibraryHideParentValidationMessage(nextItem)) {
    await showLibraryMessage(
      "Level 0 Required",
      "Turn off Hide PDF name in TOC before removing the last Level 0 entry."
    );
    return;
  }

  activePreviewLibraryItem.tocEntries = nextItem.tocEntries;
  await persistActiveLibraryLevelEntries();
  clearLibraryLevelForm();
  renderLibraryLevelEntryList();
  updateLibraryLevelParentDropdown();
}

function setLibraryPreviewPageSelection(pageNumbers) {
  selectedLibraryPreviewPages = new Set(pageNumbers);

  document.querySelectorAll("#libraryPreviewPageList .page-manager-card").forEach(card => {
    const pageNumber = Number(card.dataset.pageNumber);
    const selected = selectedLibraryPreviewPages.has(pageNumber);
    const checkbox = card.querySelector("input[type='checkbox']");

    card.classList.toggle("selected", selected);
    if (checkbox) checkbox.checked = selected;
  });

  updateLibraryPreviewStatus();
}

function selectAllLibraryPreviewPages() {
  const cards = Array.from(
    document.querySelectorAll("#libraryPreviewPageList .page-manager-card")
  );
  setLibraryPreviewPageSelection(
    cards.map(card => Number(card.dataset.pageNumber))
  );
}

function clearLibraryPreviewPageSelection() {
  setLibraryPreviewPageSelection([]);
}

function populateLibraryTypeFilter() {
  const typeFilter = document.getElementById("libraryTypeFilter");
  if (typeFilter) {
    const currentValue = typeFilter.value;
    typeFilter.replaceChildren(
      new Option("All Document Types", ""),
      ...documentTypes.map(type => new Option(type, type))
    );
    typeFilter.value = currentValue;
  }
}

function closeLibraryMergeOrderModal() {
  document
    .getElementById("libraryMergeOrderModal")
    .classList.add("hidden");
}

async function downloadPreviewedLibraryPDF() {
  if (!activePreviewLibraryItem) {
    await showLibraryMessage("No PDF Selected", "No PDF selected.");
    return;
  }

  await downloadLibraryPDF(activePreviewLibraryItem.id);
}

async function extractSelectedLibraryPreviewPages() {
  if (!activePreviewLibraryItem) {
    await showLibraryMessage("No PDF Selected", "No PDF selected.");
    return;
  }

  const selectedPages = Array.from(selectedLibraryPreviewPages).sort((a, b) => a - b);

  if (selectedPages.length === 0) {
    await showLibraryMessage("Select Pages", "Select at least one page to extract.");
    return;
  }

  try {
    const blob = await getLibraryPDFBlob(activePreviewLibraryItem);
    const bytes = await blob.arrayBuffer();
    const sourcePdf = await PDFLib.PDFDocument.load(bytes);
    const extractedPdf = await PDFLib.PDFDocument.create();
    const copiedPages = await extractedPdf.copyPages(
      sourcePdf,
      selectedPages.map(pageNumber => pageNumber - 1)
    );

    copiedPages.forEach(page => extractedPdf.addPage(page));

    const outputBytes = await extractedPdf.save();
    const baseName =
      (activePreviewLibraryItem.attachmentFileName || activePreviewLibraryItem.fileName || "library-pdf")
        .replace(/\.pdf$/i, "");

    downloadFile(outputBytes, `${baseName}-selected-pages.pdf`, "application/pdf");
  } catch (error) {
    console.error("Could not extract selected library pages:", error);
    await showLibraryMessage("Could Not Extract Pages", "The selected pages could not be extracted.");
  }
}

async function deleteSelectedLibraryPreviewPages() {
  if (!activePreviewLibraryItem) {
    await showLibraryMessage("No PDF Selected", "No PDF selected.");
    return;
  }

  const selectedPages = Array.from(selectedLibraryPreviewPages).sort((a, b) => a - b);

  if (selectedPages.length === 0) {
    await showLibraryMessage("Select Pages", "Select at least one page to delete.");
    return;
  }

  try {
    const blob = await getLibraryPDFBlob(activePreviewLibraryItem);
    const bytes = await blob.arrayBuffer();
    const sourcePdf = await PDFLib.PDFDocument.load(bytes);
    const totalPages = sourcePdf.getPageCount();

    if (selectedPages.length >= totalPages) {
      await showLibraryMessage("Cannot Delete All Pages", "A PDF must keep at least one page.");
      return;
    }

    if (!(await confirmLibraryAction(
      "Delete Pages",
      `Delete ${selectedPages.length} selected page(s) from this library PDF?`,
      "Delete"
    ))) {
      return;
    }

    const deletedPageSet = new Set(selectedPages);
    const keptPageIndexes = sourcePdf
      .getPageIndices()
      .filter(pageIndex => !deletedPageSet.has(pageIndex + 1));
    const editedPdf = await PDFLib.PDFDocument.create();
    const copiedPages = await editedPdf.copyPages(sourcePdf, keptPageIndexes);

    copiedPages.forEach(page => editedPdf.addPage(page));

    const editedBytes = await editedPdf.save();
    await replaceLibraryPDFAttachment(
      activePreviewLibraryItem,
      editedBytes,
      activePreviewLibraryItem.attachmentFileName || activePreviewLibraryItem.fileName || "edited-library.pdf"
    );

    selectedLibraryPreviewPages = new Set();
    await previewLibraryPDF(activePreviewLibraryItem.id);
  } catch (error) {
    console.error("Could not delete selected library pages:", error);
    await showLibraryMessage("Could Not Delete Pages", "The selected pages could not be deleted.");
  }
}

async function replaceLibraryPDFAttachment(item, pdfBytes, fileName) {
  if (!item) throw new Error("No library item selected.");

  const cleanFileName = fileName.toLowerCase().endsWith(".pdf")
    ? fileName
    : `${fileName}.pdf`;
  const safeFileName = cleanFileName.replace(/[^\w.\- ]+/g, "_");
  const previousStoragePath = item.storagePath;
  const storagePath = `${item.id}/${Date.now()}-${safeFileName}`;
  const blob = new Blob([pdfBytes], { type: "application/pdf" });

  const { error: uploadError } = await supabaseClient.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, blob, {
      cacheControl: "3600",
      upsert: true
    });

  if (uploadError) {
    throw uploadError;
  }

  const { error: updateError } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .update({
      storage_path: storagePath,
      file_name: item.fileName || cleanFileName
    })
    .eq("id", item.id);

  if (updateError) {
    throw updateError;
  }

  if (previousStoragePath && previousStoragePath !== storagePath) {
    const { error: removeError } = await supabaseClient.storage
      .from(DOCUMENTS_BUCKET)
      .remove([previousStoragePath]);

    if (removeError) {
      console.warn("Previous PDF could not be removed after replacement:", removeError);
    }
  }

  item.storagePath = storagePath;
  item.attachmentFileName = cleanFileName;
  libraryPDFBlobCache.delete(item.id);
  await loadLibraryDB();

  activePreviewLibraryItem =
    libraryDB.find(entry => entry.id === item.id) || item;
}
async function mergeSelectedLibraryPDFs() {
  const selectedItems = Array.from(selectedLibraryPDFIds)
    .map(id => libraryDB.find(item => item.id === id))
    .filter(item => item && item.storagePath);

  if (selectedItems.length === 0) {
    await showLibraryMessage("Select Attached PDFs", "Select at least one PDF with an attachment.");
    updateDatabaseStatus("Select at least one attached PDF before merging.");
    return;
  }

  let fileName = document.getElementById("mergedLibraryFileName").value.trim();

  if (!fileName) {
    fileName = await openDatabaseMessageModal(
      "Merge PDFs",
      "Enter a name for the merged PDF.",
      {
        input: {
          label: "Merged PDF name",
          value: "Merged Library PDFs.pdf",
          placeholder: "Merged Library PDFs.pdf"
        },
        confirmLabel: "Merge",
        cancelLabel: "Cancel"
      }
    );
  }

  if (!fileName) return;

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    fileName += ".pdf";
  }

  try {
    updateDatabaseStatus(`Merging ${selectedItems.length} PDF(s)...`);
    const mergedPdf = await PDFLib.PDFDocument.create();

    for (const [index, item] of selectedItems.entries()) {
      updateDatabaseStatus(
        `Merging PDF ${index + 1} of ${selectedItems.length}: ${item.attachmentFileName || item.fileName || "PDF"}`
      );
      const blob = await getLibraryPDFBlob(item);
      const bytes = await blob.arrayBuffer();

      const sourcePdf = await PDFLib.PDFDocument.load(bytes);
      const copiedPages = await mergedPdf.copyPages(
        sourcePdf,
        sourcePdf.getPageIndices()
      );

      copiedPages.forEach(page => mergedPdf.addPage(page));
    }

    updateDatabaseStatus("Preparing merged PDF download...");
    const mergedBytes = await mergedPdf.save();

    downloadFile(
      mergedBytes,
      fileName,
      "application/pdf"
    );

    updateDatabaseStatus(`Merged ${selectedItems.length} PDF(s) into ${fileName}.`);
  } catch (error) {
    console.error("Could not merge selected PDFs:", error);
    await showLibraryMessage("Could Not Merge PDFs", "Could not merge the selected PDFs.");
    updateDatabaseStatus(`Could not merge PDFs: ${error.message || "Please try again."}`);
  }
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

function openLibraryMergeOrderModal() {
  const selectedItems = Array.from(selectedLibraryPDFIds)
    .map(id => libraryDB.find(item => item.id === id))
    .filter(item => item && item.storagePath);

  if (selectedItems.length === 0) {
    showLibraryMessage("Select Attached PDFs", "Select at least one PDF with an attachment.");
    return;
  }

  const list = document.getElementById("libraryMergeOrderList");
  list.innerHTML = "";

  selectedItems.forEach(item => {
    const row = document.createElement("div");

    row.className = "order-row";
    row.draggable = true;
    row.dataset.id = item.id;

    row.innerHTML = `
      <span class="drag-handle">☰</span>
      <span>${item.fileName || item.displayTitle}</span>
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

  document
    .getElementById("libraryMergeOrderModal")
    .classList.remove("hidden");
}

async function confirmLibraryMergeOrder() {
  const rows = Array.from(
    document.querySelectorAll("#libraryMergeOrderList .order-row")
  );

  const orderedItems = rows
    .map(row =>
      libraryDB.find(item => item.id === row.dataset.id)
    )
    .filter(item => item && item.storagePath);

  if (orderedItems.length === 0) {
    await showLibraryMessage("No PDFs Selected", "No PDFs selected.");
    return;
  }

  let fileName =
    document.getElementById("mergeOrderedFileName").value.trim();

  if (!fileName) {
    fileName = "Merged Library PDFs.pdf";
  }

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    fileName += ".pdf";
  }

  const mergedPdf = await PDFLib.PDFDocument.create();

  for (const item of orderedItems) {
    const blob = await getLibraryPDFBlob(item);
    const bytes = await blob.arrayBuffer();

    const sourcePdf = await PDFLib.PDFDocument.load(bytes);

    const copiedPages = await mergedPdf.copyPages(
      sourcePdf,
      sourcePdf.getPageIndices()
    );

    copiedPages.forEach(page => mergedPdf.addPage(page));
  }

  const mergedBytes = await mergedPdf.save();

  downloadFile(
    mergedBytes,
    fileName,
    "application/pdf"
  );

  closeLibraryMergeOrderModal();
}

window.addEventListener("load", async () => {
  registerDatabaseGhostAutocompleteSource();
  await checkDatabaseLogin();
  populateLibraryTypeFilter();
  await loadLibraryDB();
  setupLibraryDropZone();

  const addBtn = document.getElementById("addLibraryEntryButton");
  if (addBtn) addBtn.addEventListener("click", addLibraryEntryFromForm);

  const exportBtn = document.getElementById("exportLibraryCSV");
  if (exportBtn) exportBtn.addEventListener("click", exportLibraryCSV);

  const searchEl = document.getElementById("librarySearch");
  if (searchEl) searchEl.addEventListener("input", renderLibraryDB);

  const typeFilter = document.getElementById("libraryTypeFilter");
  if (typeFilter) typeFilter.addEventListener("change", renderLibraryDB);

});

document.addEventListener("DOMContentLoaded", () => {
  registerDatabaseGhostAutocompleteSource();
  window.setTimeout(registerDatabaseGhostAutocompleteSource, 0);
});
