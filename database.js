let libraryDB = [];
let pendingLibraryPdf = null;
let currentUser = null;
let useRemoteDatabase = false;

async function checkDatabaseLogin() {
  const { data } = await supabaseClient.auth.getUser();

  currentUser = data.user || null;
  useRemoteDatabase = !!currentUser;

  const status = document.getElementById("loginStatus");

  if (status) {
    status.textContent = useRemoteDatabase
      ? `Logged in as ${currentUser.email}`
      : "Not logged in. Saving locally only.";
  }
}

async function sendLoginLink() {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    alert("Enter your work email.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false
    }
  });

  if (error) {
    console.error(error);
    alert("Could not send login link.");
    return;
  }

  document.getElementById("loginStatus").textContent =
    "Login link sent. Check your email.";
}

const DOCUMENTS_TABLE = "documents";
const DOCUMENTS_BUCKET = "document-library";

function guessPacketSectionForLibrary(fileName = "") {
  const name = String(fileName).toLowerCase();

  if (name.includes("revision") || name.includes("remarks")) return "Revision Remarks";
  if (name.includes("cover")) return "Cover Page";
  if (name.includes("table of contents") || name.includes("toc")) return "Table of Contents";
  if (name.includes("warranty")) return "Warranty";
  if (name.includes("safety")) return "Safety Procedures";
  if (name.includes("maintenance")) return "Maintenance";
  if (
    name.includes("sequence of operations") ||
    name.includes("sequence of operation") ||
    name.includes("operations sequence")
  ) return "Sequence of Operations";
  if (
    name.includes("parts list") ||
    name.includes("part list") ||
    name.includes("parts") ||
    name.includes("part")
  ) return "Parts List";
  if (
    name.includes("electrical schematic") ||
    name.includes("electrical schematics") ||
    name.includes("electrical diagram") ||
    name.includes("schematic") ||
    name.includes("diagram")
  ) return "Electrical Schematics";
  if (name.includes("control") || name.includes("panel")) return "Control Panel Components";
  if (
    name.includes("shop drawing") ||
    name.includes("shop drawings") ||
    name.includes("shop") ||
    name.includes("drawing") ||
    name.includes("drawings")
  ) return "Shop Drawings";
  if (name.includes("manual")) return "Manuals";
  if (name.includes("appendix")) return "Appendix";

  return "Datasheets";
}

async function loadLibraryDB() {
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
  if (!item || !item.storagePath) return;

  if (!confirm("Remove the attached PDF?")) return;

  const { error: storageError } = await supabaseClient.storage
    .from(DOCUMENTS_BUCKET)
    .remove([item.storagePath]);

  if (storageError) {
    console.error("Error removing PDF:", storageError);
    alert("Could not remove PDF from storage.");
    return;
  }

  const { error: updateError } = await supabaseClient
    .from(DOCUMENTS_TABLE)
    .update({
      storage_path: "",
      //updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error clearing PDF path:", updateError);
    alert("PDF removed, but database did not update.");
    return;
  }

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

  console.log("Pending PDF when adding:", pendingLibraryPdf);

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

  console.log("Created library row:", data);

  if (pendingLibraryPdf) {
    console.log("Uploading pending PDF:", pendingLibraryPdf.name);

    libraryDB.push(fromSupabaseDocument(data));

    await attachPDFToLibraryItem(data.id, pendingLibraryPdf);
  } else {
    console.warn("No pending PDF found when Add to Library was clicked.");
  }

  document.getElementById("libFileName").value = "";
  document.getElementById("libDisplayTitle").value = "";
  document.getElementById("libNotes").value = "";

  clearLibraryUpload();
  await loadLibraryDB();
}

window.addEventListener("load", async () => {
  await checkDatabaseLogin();
  loadLibraryDB();
  setupLibraryDropZone();

  const addBtn = document.getElementById("addLibraryEntryButton");
  if (addBtn) addBtn.addEventListener("click", addLibraryEntryFromForm);

  const exportBtn = document.getElementById("exportLibraryCSV");
  if (exportBtn) exportBtn.addEventListener("click", exportLibraryCSV);

  const searchEl = document.getElementById("librarySearch");
  if (searchEl) searchEl.addEventListener("input", renderLibraryDB);
});