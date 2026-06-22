let libraryDB = [];
let pendingLibraryPdf = null;
let selectedLibraryPDFIds = new Set();
let currentUser = null;
let useRemoteDatabase = false;
const libraryPDFBlobCache = new Map();

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

  if (useRemoteDatabase) {
    if (loginBtn) {
      loginBtn.textContent = currentUser.email;
    }

    if (logoutBtn) {
      logoutBtn.classList.remove("hidden");
    }
  } else {
    if (loginBtn) {
      loginBtn.textContent = "Login";
    }

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

  if (loginBtn) {
    loginBtn.textContent = "Login";
  }

  if (logoutBtn) {
    logoutBtn.classList.add("hidden");
  }

  document.getElementById("loginStatus").textContent =
    "Not logged in. Saving locally only.";

  location.reload();
}

async function sendLoginLink() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    alert("Remote login is only available on the Database page.");
    return;
  }

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    alert("Enter your email and password.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("LOGIN ERROR:", error);
    alert(error.message || "Could not log in.");
    return;
  }

  await checkDatabaseLogin();
  closeLoginModal();
  await loadLibraryDB();
}

const DOCUMENTS_TABLE = "documents";
const DOCUMENTS_BUCKET = "document-library";

function guessPacketSectionForLibrary(fileName = "") {
  return guessPacketSectionFromName(fileName);
}

async function loadLibraryDB() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .select("*")
    .order("document_type", { ascending: true })
    .order("display_title", { ascending: true });

  if (error) {
    console.error("Error loading library:", error);
    alert("Could not load library from Supabase.");
    libraryDB = [];
    renderLibraryDB();
    return;
  }

  libraryDB = (data || []).map(fromSupabaseDocument);
  sortLibraryDB();
  renderLibraryDB();
}

function saveLibraryDB() {
  // Supabase saves happen directly in add/update/remove functions now.
  // This stays here so older code does not break.
}

function fromSupabaseDocument(row) {
  return {
    id: row.id,
    uploadDate: row.created_at
      ? new Date(row.created_at).toLocaleDateString()
      : "",
    fileName: row.file_name || "",
    displayTitle: row.display_title || "",
    documentType: row.document_type || "Other",
    packetSection: row.packet_section || "",
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
    packet_section: item.packetSection || guessPacketSectionForLibrary(item.fileName || item.displayTitle || ""),
    manufacturer: item.manufacturer || "",
    model_number: item.modelNumber || "",
    tags: item.tags || "",
    notes: item.notes || "",
    storage_path: item.storagePath || "",
    //updated_at: new Date().toISOString()
  };
}

function sortLibraryDB() {
  libraryDB.sort((a, b) => {
    if ((a.documentType || "") === (b.documentType || "")) {
      return (a.displayTitle || "").localeCompare(b.displayTitle || "");
    }

    return (a.documentType || "").localeCompare(b.documentType || "");
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
          item.packetSection,
          item.manufacturer,
          item.modelNumber,
          item.tags,
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
        <input
          type="checkbox"
          ${selectedLibraryPDFIds.has(item.id) ? "checked" : ""}
          onchange="toggleLibraryPDFSelection('${item.id}', this.checked)"
        />
      </td>

      <td>
        <button
          class="delete-btn"
          onclick="removeLibraryDBEntry('${item.id}')">
          Remove
        </button>
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
        <input
          value="${escapeHTML(item.notes || "")}"
          onchange="updateLibraryDBItem('${item.id}', 'notes', this.value)"
        />
      </td>

      <td>
        ${
          item.storagePath
            ? `
              <div class="table-action-buttons">
                <button onclick="renameLibraryFile('${item.id}')">
                  Rename File
                </button>

                <button onclick="previewLibraryPDF('${item.id}')">
                  Preview
                </button>

                <button onclick="downloadLibraryPDF('${item.id}')">
                  Download
                </button>

                <button
                  class="delete-btn"
                  onclick="removeAttachmentFromLibraryItem('${item.id}')">
                  Remove PDF
                </button>
              </div>

              <div class="attachment-name">
                ${escapeHTML(item.attachmentFileName || item.fileName || "")}
              </div>
            `
            : `
              <label class="attach-pdf-btn">
                Attach PDF
                <input
                type="file"
                accept="application/pdf"
                style="display:none;"
                onchange="attachPDFToLibraryItem('${item.id}', this.files[0]); this.value='';"
              />
              </label>
            `
        }
      </td>
    `;

    tbody.appendChild(row);
  });
}

function setPendingLibraryPdf(file) {
  if (!file || file.type !== "application/pdf") {
    alert("Please select a PDF file.");
    return;
  }

  pendingLibraryPdf = file;

  const selected = document.getElementById("selectedLibraryPdf");
  if (selected) {
    selected.textContent = `Selected PDF: ${file.name}`;
  }

  const fileNameInput = document.getElementById("libFileName");
  const titleInput = document.getElementById("libDisplayTitle");
  const docTypeSelect = document.getElementById("libDocumentType");

  const cleanName = file.name.replace(/\.pdf$/i, "");

  if (fileNameInput && !fileNameInput.value.trim()) {
    fileNameInput.value = file.name;
  }

  if (docTypeSelect) {
    docTypeSelect.value = guessDocumentTypeForLibrary(file.name);
  }
}

function clearLibraryUpload() {
  pendingLibraryPdf = null;

  const upload = document.getElementById("libraryPdfUpload");
  if (upload) upload.value = "";

  const selected = document.getElementById("selectedLibraryPdf");
  if (selected) {
    selected.textContent = "No PDF selected yet.";
  }
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
      alert(`Duplicate entry for "${entry.fileName || entry.displayTitle}" already exists.`);
    }
    return;
  }

  const { error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .insert([toSupabaseDocument(entry)]);

  if (error) {
    console.error("FULL ERROR", JSON.stringify(error, null, 2));

    alert(
      JSON.stringify(error, null, 2)
    );

    return;
  }

  libraryPDFBlobCache.delete(id);
  await loadLibraryDB();
}

async function removeLibraryDBEntry(id) {
  const item = libraryDB.find(x => x.id === id);

  if (!confirm("Remove this library entry?")) return;

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
    alert("Could not remove entry.");
    return;
  }

  await loadLibraryDB();
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
    alert("Could not update entry.");
    return;
  }

  await loadLibraryDB();
}

async function renameLibraryFile(id) {
  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  const currentName = item.attachmentFileName || item.fileName || "";

  const newName = prompt("Enter the new PDF file name:", currentName);
  if (newName === null) return;

  let cleanName = newName.trim();

  if (!cleanName) {
    alert("File name cannot be blank.");
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
    alert("Could not rename file.");
    return;
  }

  await loadLibraryDB();
}

async function attachPDFToLibraryItem(id, file) {
  if (!file) return;

  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  const safeFileName = file.name.replace(/[^\w.\- ]+/g, "_");
  const storagePath = `${id}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (uploadError) {
    console.error("PDF upload failed:", uploadError);
    alert("Could not upload PDF.");
    return;
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
    alert("PDF uploaded, but the database did not update.");
    return;
  }

  libraryPDFBlobCache.delete(id);
  await loadLibraryDB();
}

async function downloadLibraryPDF(id) {
  const item = libraryDB.find(x => x.id === id);
  if (!item || !item.storagePath) {
    alert("PDF attachment not found.");
    return;
  }

  const { data, error } = await supabaseClient.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(item.storagePath, 60);

  if (error || !data || !data.signedUrl) {
    console.error("Could not create download link:", error);
    alert("Could not download PDF.");
    return;
  }

  const response = await fetch(data.signedUrl);
  const blob = await response.blob();

  const fileName = item.attachmentFileName || item.fileName || "download.pdf";

  downloadFile(blob, fileName, "application/pdf");
}

async function removeAttachmentFromLibraryItem(id) {
  const item = libraryDB.find(x => x.id === id);
  if (!item) return;

  if (!confirm("Remove the attached PDF?")) return;

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
    alert("PDF removed, but database did not update.");
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
    "Notes",
    "Storage Path"
  ];

  const rows = libraryDB.map(i => [
    i.uploadDate,
    i.fileName,
    i.displayTitle,
    i.documentType,
    i.packetSection,
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
  const notes = document.getElementById("libNotes").value.trim();

  if (!displayTitle && !fileName && !pendingLibraryPdf) {
    return alert("Provide a file name, file location, or PDF.");
  }

  const finalFileName =
    fileName ||
    pendingLibraryPdf?.name ||
    "";

  const entry = {
    fileName: finalFileName,
    displayTitle,
    documentType,
    packetSection: guessPacketSectionForLibrary(finalFileName || displayTitle || ""),
    notes,
    storagePath: ""
  };

  const { data, error } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .insert([toSupabaseDocument(entry)])
    .select()
    .single();

  if (error) {
    console.error("Error adding entry:", error);
    alert("Could not add entry.");
    return;
  }

  if (pendingLibraryPdf) {
    libraryDB.push(fromSupabaseDocument(data));

    await attachPDFToLibraryItem(data.id, pendingLibraryPdf);
  }

  document.getElementById("libFileName").value = "";
  document.getElementById("libDisplayTitle").value = "";
  document.getElementById("libNotes").value = "";

  clearLibraryUpload();
  await loadLibraryDB();
}

function toggleLibraryPDFSelection(id, checked) {
  if (checked) {
    selectedLibraryPDFIds.add(id);
  } else {
    selectedLibraryPDFIds.delete(id);
  }
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

let activePreviewLibraryItem = null;

async function previewLibraryPDF(id) {
  try {
    const item = libraryDB.find(x => x.id === id);

    if (!item || !item.storagePath) {
      alert("No PDF attached to preview.");
      return;
    }

    activePreviewLibraryItem = item;

    document.getElementById("libraryPreviewTitle").textContent =
      item.fileName || "PDF Preview";

    const modal = document.getElementById("libraryPreviewModal");
    const list = document.getElementById("libraryPreviewPageList");

    list.innerHTML = "Loading preview...";
    modal.classList.remove("hidden");

    const blob = await getLibraryPDFBlob(item);
    const bytes = await blob.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

    list.innerHTML = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.35 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport
      }).promise;

      const pageCard = document.createElement("div");
      pageCard.className = "page-preview-card";

      pageCard.innerHTML = `
        <div class="page-preview-label">Page ${pageNumber}</div>
      `;

      pageCard.appendChild(canvas);
      list.appendChild(pageCard);
    }
  } catch (error) {
    console.error("Preview failed:", error);
    alert("Could not preview PDF.");
  }
}

function closeLibraryPreviewModal() {
  document.getElementById("libraryPreviewModal").classList.add("hidden");
  activePreviewLibraryItem = null;
}

function closeLibraryMergeOrderModal() {
  document
    .getElementById("libraryMergeOrderModal")
    .classList.add("hidden");
}

async function downloadPreviewedLibraryPDF() {
  if (!activePreviewLibraryItem) {
    alert("No PDF selected.");
    return;
  }

  await downloadLibraryPDF(activePreviewLibraryItem.id);
}
async function mergeSelectedLibraryPDFs() {
  const selectedItems = Array.from(selectedLibraryPDFIds)
    .map(id => libraryDB.find(item => item.id === id))
    .filter(item => item && item.storagePath);

  if (selectedItems.length === 0) {
    alert("Select at least one PDF with an attachment.");
    return;
  }

  let fileName = document.getElementById("mergedLibraryFileName").value.trim();

  if (!fileName) {
    fileName = prompt("Enter a name for the merged PDF:", "Merged Library PDFs.pdf");
  }

  if (!fileName) return;

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    fileName += ".pdf";
  }

  const mergedPdf = await PDFLib.PDFDocument.create();

  for (const item of selectedItems) {
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
    alert("Select at least one PDF with an attachment.");
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
    alert("No PDFs selected.");
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
  await checkDatabaseLogin();
  await loadLibraryDB();
  setupLibraryDropZone();

  const addBtn = document.getElementById("addLibraryEntryButton");
  if (addBtn) addBtn.addEventListener("click", addLibraryEntryFromForm);

  const exportBtn = document.getElementById("exportLibraryCSV");
  if (exportBtn) exportBtn.addEventListener("click", exportLibraryCSV);

  const searchEl = document.getElementById("librarySearch");
  if (searchEl) searchEl.addEventListener("input", renderLibraryDB);
});
