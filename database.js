let libraryDB = [];
const LIB_DB_KEY = "submittalLibraryDB";

function loadLibraryDB() {
  try {
    const raw = localStorage.getItem(LIB_DB_KEY);
    libraryDB = raw ? JSON.parse(raw) : [];
  } catch (e) {
    libraryDB = [];
  }

  sortLibraryDB();
  renderLibraryDB();
}

function saveLibraryDB() {
  localStorage.setItem(LIB_DB_KEY, JSON.stringify(libraryDB));
}

function sortLibraryDB() {
  libraryDB.sort((a, b) => {
    if (a.documentType === b.documentType) {
      return a.displayTitle.localeCompare(b.displayTitle);
    }

    return a.documentType.localeCompare(b.documentType);
  });
}

function renderLibraryDB() {
  const tbody = document.getElementById("libraryDBBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const searchEl = document.getElementById("librarySearch");
  const search = searchEl && searchEl.value
    ? searchEl.value.trim().toLowerCase()
    : "";

  const list = search
    ? libraryDB.filter(item => {
        const hay = [
          item.fileName,
          item.displayTitle,
          item.documentType,
          item.notes
        ].join(" ").toLowerCase();

        return hay.includes(search);
      })
    : libraryDB;

  list.forEach(item => {
    const row = document.createElement("tr");

    const docOptions = documentTypes.map(opt => `
      <option value="${opt}" ${opt === item.documentType ? "selected" : ""}>
        ${opt}
      </option>
    `).join("");

    row.innerHTML = `
      <td>
        <button
          class="delete-btn"
          onclick="removeLibraryDBEntry('${item.id}')">
          Remove
        </button>
      </td>

      <td>${item.uploadDate || ""}</td>

      <td>${item.fileName || ""}</td>

      <td>
        <input
          value="${item.displayTitle || ""}"
          onchange="updateLibraryDBItem('${item.id}', 'displayTitle', this.value)"
        />
      </td>

      <td>
        <select onchange="updateLibraryDBItem('${item.id}', 'documentType', this.value)">
          ${docOptions}
        </select>
      </td>

      <td>
        <input
          value="${item.notes || ""}"
          onchange="updateLibraryDBItem('${item.id}', 'notes', this.value)"
        />
      </td>

      <td>
        ${
          item.attachmentId
            ? `
              <button onclick="downloadSavedPDF('${item.attachmentId}')">Download</button>
              <button onclick="removeAttachmentFromLibraryItem('${item.id}')">Remove PDF</button>
            `
            : `
              <label class="attach-pdf-btn">
                Attach PDF
                <input
                  type="file"
                  accept="application/pdf"
                  style="display:none;"
                  onchange="attachPDFToLibraryItem('${item.id}', this.files[0])"
                />
              </label>
            `
        }
      </td>
    `;

    tbody.appendChild(row);
  });
}

function addLibraryEntryFromForm() {
  const fileName = document.getElementById("libFileName").value.trim();
  const displayTitle = document.getElementById("libDisplayTitle").value.trim();
  const documentType = document.getElementById("libDocumentType").value;
  const notes = document.getElementById("libNotes").value.trim();

  if (!displayTitle && !fileName) {
    return alert("Provide at least a file name or display title");
  }

  const entry = {
    id: crypto.randomUUID(),
    uploadDate: new Date().toLocaleDateString(),
    fileName,
    displayTitle,
    documentType,
    notes
  };

  addLibraryEntry(entry);

  document.getElementById("libFileName").value = "";
  document.getElementById("libDisplayTitle").value = "";
  document.getElementById("libNotes").value = "";
}

function addLibraryEntry(entry, options = {}) {
  const exists = libraryDB.find(x =>
    (x.fileName && entry.fileName && x.fileName === entry.fileName) ||
    (
      entry.displayTitle &&
      x.displayTitle &&
      x.displayTitle === entry.displayTitle
    )
  );

  if (exists) {
    if (!options.silent) {
      alert(`Duplicate entry for "${entry.fileName || entry.displayTitle}" already exists.`);
    }

    return;
  }

  libraryDB.push(entry);
  sortLibraryDB();
  saveLibraryDB();
  renderLibraryDB();
}

function removeLibraryDBEntry(id) {
  libraryDB = libraryDB.filter(x => x.id !== id);
  saveLibraryDB();
  renderLibraryDB();
}

function updateLibraryDBItem(id, field, value) {
  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  item[field] = value;
  saveLibraryDB();
  sortLibraryDB();
  renderLibraryDB();
}

async function attachPDFToLibraryItem(id, file) {
  if (!file) return;

  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  const attachmentId = crypto.randomUUID();

  await savePDFToIndexedDB(attachmentId, file);

  item.attachmentId = attachmentId;
  item.attachmentFileName = file.name;

  saveLibraryDB();
  renderLibraryDB();
}

async function removeAttachmentFromLibraryItem(id) {
  const item = libraryDB.find(x => x.id === id);
  if (!item || !item.attachmentId) return;

  await deleteSavedPDF(item.attachmentId, false);

  item.attachmentId = null;
  item.attachmentFileName = "";

  saveLibraryDB();
  renderLibraryDB();
}

function exportLibraryCSV() {
  const headers = [
    "Date",
    "File Name",
    "File Location",
    "Document Type",
    "Notes"
  ];

  const rows = libraryDB.map(i => [
    i.uploadDate,
    i.fileName,
    i.displayTitle,
    i.documentType,
    i.notes
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadFile(csv, "library-db.csv", "text/csv");
}

async function mergeSubmittalIntoLibrary(items) {
  for (const i of items) {
    let attachmentId = null;

    if (i.file && typeof savePDFToIndexedDB === "function") {
      attachmentId = crypto.randomUUID();
      await savePDFToIndexedDB(attachmentId, i.file);
    }

    const entry = {
      id: crypto.randomUUID(),
      uploadDate: new Date().toLocaleDateString(),
      fileName: i.fileName || "",
      displayTitle: "",
      documentType: i.documentType || "Other",
      notes: "",
      attachmentId,
      attachmentFileName: i.fileName || ""
    };

    addLibraryEntry(entry, { silent: true });
  }
}

window.addEventListener("load", () => {
  loadLibraryDB();

  const addBtn = document.getElementById("addLibraryEntryButton");
  if (addBtn) addBtn.addEventListener("click", addLibraryEntryFromForm);

  const exportBtn = document.getElementById("exportLibraryCSV");
  if (exportBtn) exportBtn.addEventListener("click", exportLibraryCSV);

  const searchEl = document.getElementById("librarySearch");
  if (searchEl) searchEl.addEventListener("input", renderLibraryDB);
});