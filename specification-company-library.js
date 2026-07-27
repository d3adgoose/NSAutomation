/* Shared Company Knowledge Library for authenticated Specification users. */

const SPEC_COMPANY_DOCUMENTS_TABLE = "documents";
const SPEC_COMPANY_DOCUMENTS_BUCKET = "document-library";
const SPEC_COMPANY_DOCUMENT_TYPE = "Company Knowledge";
const SPEC_COMPANY_MAX_FILE_BYTES = 50 * 1024 * 1024;
let specCompanyKnowledgeItems = [];
let specPendingCompanyKnowledgeFiles = [];

document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("ns-auth-session-changed", loadSpecCompanyKnowledge);
});

function getSpecCompanyKnowledgeModalMarkup() {
  return `<section class="spec-company-library" aria-labelledby="specCompanyKnowledgeHeading">
    <div class="spec-company-library-heading">
      <div>
        <h3 id="specCompanyKnowledgeHeading">Company Knowledge Library</h3>
        <p class="converter-muted">Shared company references stored in the same database as the Document Library.</p>
      </div>
      <div class="spec-company-library-heading-actions">
        <button type="button" class="secondary" onclick="loadSpecCompanyKnowledge()">Refresh</button>
      </div>
    </div>
    <div class="spec-company-library-guidance"><strong>Keep this library specification-focused.</strong><span>Add approved specifications, company standards, standard clauses, and writing examples. Project datasheets belong outside this shared library.</span></div>
    <div class="spec-company-library-layout">
      <aside class="spec-company-library-add">
        <div><strong>Add company reference</strong><p>Upload a reusable specification, standard, manual, or approved example.</p></div>
        <div class="spec-company-library-form">
          <label><span>Title</span><input id="specCompanyKnowledgeTitle" placeholder="Example: BCTA Bus Wash Equipment Specification"></label>
          <label><span>Category</span><select id="specCompanyKnowledgeCategory"><option>Approved Specification</option><option>Company Standard</option><option>Standard Clause</option><option>Writing Example</option><option>Other</option></select></label>
          <label><span>Description</span><textarea id="specCompanyKnowledgeNotes" rows="4" placeholder="What this document should support"></textarea></label>
          <label id="specCompanyKnowledgeDrop" class="spec-company-library-upload"><strong>Drop a specification here</strong><span>or choose a PDF, Word, or Text file</span><input id="specCompanyKnowledgeInput" type="file" accept=".pdf,.docx,.txt" multiple hidden></label>
          <div id="specCompanyKnowledgePending" class="spec-company-upload-pending">No files selected.</div>
          <button id="specCompanyKnowledgeAddButton" type="button" disabled onclick="addPendingSpecCompanyKnowledge()">Add to Company Knowledge</button>
        </div>
        <small>All logged-in users can currently manage these shared files.</small>
      </aside>
      <div class="spec-company-library-browser">
        <div class="spec-company-library-toolbar">
          <input id="specCompanyKnowledgeSearch" type="search" placeholder="Search titles, filenames, descriptions, or categories" oninput="renderSpecCompanyKnowledge()">
          <select id="specCompanyKnowledgeFilter" aria-label="Filter company knowledge by category" onchange="renderSpecCompanyKnowledge()">
            <option value="">All categories</option><option>Approved Specification</option><option>Company Standard</option><option>Standard Clause</option><option>Writing Example</option><option>Other</option>
          </select>
        </div>
        <span id="specCompanyKnowledgeStatus" class="spec-load-status" role="status" aria-live="polite">Loading shared company knowledge...</span>
        <div id="specCompanyKnowledgeList" class="spec-company-knowledge-list"></div>
      </div>
    </div>
  </section>`;
}

function openSpecCompanyKnowledgeModal() {
  const modal = document.getElementById("specModal");
  document.getElementById("specModalTitle").textContent = "Company Knowledge Library";
  document.getElementById("specModalBody").innerHTML = getSpecCompanyKnowledgeModalMarkup();
  const actions = document.getElementById("specModalActions");
  actions.replaceChildren();
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "secondary";
  closeButton.textContent = "Close";
  closeButton.onclick = openSpecLocalAiStatusModal;
  actions.append(closeButton);
  setupSpecCompanyKnowledgeDropZone();
  modal.classList.remove("hidden");
  loadSpecCompanyKnowledge();
}

function setupSpecCompanyKnowledgeDropZone() {
  const input = document.getElementById("specCompanyKnowledgeInput");
  const drop = document.getElementById("specCompanyKnowledgeDrop");
  input?.addEventListener("change", event => stageSpecCompanyKnowledgeFiles(event.target.files));
  ["dragenter", "dragover"].forEach(type => drop?.addEventListener(type, event => {
    event.preventDefault();
    drop.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(type => drop?.addEventListener(type, event => {
    event.preventDefault();
    drop.classList.remove("dragover");
  }));
  drop?.addEventListener("drop", event => stageSpecCompanyKnowledgeFiles(event.dataTransfer?.files));
}

function stageSpecCompanyKnowledgeFiles(fileList) {
  specPendingCompanyKnowledgeFiles = Array.from(fileList || []);
  const pending = document.getElementById("specCompanyKnowledgePending");
  const addButton = document.getElementById("specCompanyKnowledgeAddButton");
  const titleInput = document.getElementById("specCompanyKnowledgeTitle");
  if (titleInput && specPendingCompanyKnowledgeFiles.length === 1) {
    titleInput.value = specPendingCompanyKnowledgeFiles[0].name.replace(/\.(pdf|docx|txt)$/i, "");
  } else if (titleInput && specPendingCompanyKnowledgeFiles.length !== 1) {
    titleInput.value = "";
  }
  if (pending) {
    pending.innerHTML = specPendingCompanyKnowledgeFiles.length
      ? `<strong>${specPendingCompanyKnowledgeFiles.length} file${specPendingCompanyKnowledgeFiles.length === 1 ? "" : "s"} ready:</strong><span>${specPendingCompanyKnowledgeFiles.map(file => escapeSpec(file.name)).join(", ")}</span>`
      : "No files selected.";
  }
  if (addButton) addButton.disabled = specPendingCompanyKnowledgeFiles.length === 0;
}

async function addPendingSpecCompanyKnowledge() {
  const files = [...specPendingCompanyKnowledgeFiles];
  if (!files.length) return;
  const metadata = {
    title: String(document.getElementById("specCompanyKnowledgeTitle")?.value || "").trim(),
    category: document.getElementById("specCompanyKnowledgeCategory")?.value || "Other",
    notes: String(document.getElementById("specCompanyKnowledgeNotes")?.value || "").trim()
  };
  const addButton = document.getElementById("specCompanyKnowledgeAddButton");
  if (addButton) addButton.disabled = true;
  for (const file of files) {
    await uploadSpecCompanyKnowledge(file, {
      ...metadata,
      title: files.length === 1 ? metadata.title : ""
    });
  }
  const titleInput = document.getElementById("specCompanyKnowledgeTitle");
  const notesInput = document.getElementById("specCompanyKnowledgeNotes");
  if (titleInput) titleInput.value = "";
  if (notesInput) notesInput.value = "";
  specPendingCompanyKnowledgeFiles = [];
  stageSpecCompanyKnowledgeFiles([]);
}

function setSpecCompanyKnowledgeStatus(message) {
  const status = document.getElementById("specCompanyKnowledgeStatus");
  if (status) status.textContent = message || "";
}

function getSpecCompanyKnowledgeMeta(row = {}) {
  const tagParts = String(row.tags || "").split(";").map(value => value.trim());
  const importedFromDatabase = tagParts.some(value => value.startsWith("original-document-type:"));
  const looksLikeFileLocation = /^[a-z]:[\\/]|^\\\\/i.test(String(row.display_title || ""));
  const originalDocumentType = tagParts.find(value => value.startsWith("original-document-type:"))
    ?.slice("original-document-type:".length) || "";
  const category = tagParts.find(value => value.startsWith("knowledge-category:"))
    ?.slice("knowledge-category:".length) || "Other";
  return {
    id: row.id,
    title: importedFromDatabase || looksLikeFileLocation
      ? row.file_name || row.display_title || "Company reference"
      : row.display_title || row.file_name || "Company reference",
    fileName: row.file_name || "",
    category,
    originalDocumentType,
    notes: row.notes || "",
    storagePath: row.storage_path || "",
    createdAt: row.created_at || ""
  };
}

function getSpecCompanyKnowledgeKind(item) {
  const source = `${item.originalDocumentType || ""} ${item.category || ""} ${item.fileName || ""}`.toLowerCase();
  if (/\bdata\s*sheet\b|\bdatasheet\b/.test(source)) return "Datasheet";
  if (/\bspecification\b|\bspec\s*sheet\b/.test(source)) return "Specification";
  if (/\bo\s*&\s*m\b|\boperation(?:s)?\s+(?:and|&)\s+maintenance\b|\bmanual\b/.test(source)) return "O&M Manual";
  if (/\bdrawing\b|\bshop drawing\b|\bplan\b/.test(source)) return "Drawing";
  if (/\bsubmittal\b/.test(source)) return "Submittal";
  if (/\bwarranty\b/.test(source)) return "Warranty";
  return item.originalDocumentType || item.category || "Reference";
}

async function getSpecCompanyKnowledgeSession() {
  if (!window.supabaseClient) return null;
  const { data } = await window.supabaseClient.auth.getSession().catch(() => ({ data: null }));
  return data?.session || null;
}

async function loadSpecCompanyKnowledge() {
  const session = await getSpecCompanyKnowledgeSession();
  if (!session) {
    specCompanyKnowledgeItems = [];
    renderSpecCompanyKnowledge();
    setSpecCompanyKnowledgeStatus("Log in to view shared company knowledge.");
    return;
  }

  setSpecCompanyKnowledgeStatus("Loading shared company knowledge...");
  const { data, error } = await window.supabaseClient
    .from(SPEC_COMPANY_DOCUMENTS_TABLE)
    .select("id,file_name,display_title,document_type,tags,notes,storage_path,created_at")
    .eq("document_type", SPEC_COMPANY_DOCUMENT_TYPE)
    .order("file_name", { ascending: true });

  if (error) {
    console.error("Could not load company knowledge:", error);
    setSpecCompanyKnowledgeStatus(`Could not load company knowledge: ${error.message}`);
    return;
  }

  specCompanyKnowledgeItems = (data || []).map(getSpecCompanyKnowledgeMeta);
  renderSpecCompanyKnowledge();
  setSpecCompanyKnowledgeStatus(
    `${specCompanyKnowledgeItems.length} shared reference${specCompanyKnowledgeItems.length === 1 ? "" : "s"} available.`
  );
}

function renderSpecCompanyKnowledge() {
  const list = document.getElementById("specCompanyKnowledgeList");
  if (!list) return;
  const search = String(document.getElementById("specCompanyKnowledgeSearch")?.value || "").toLowerCase().trim();
  const category = String(document.getElementById("specCompanyKnowledgeFilter")?.value || "");
  const visible = specCompanyKnowledgeItems.filter(item =>
    (!category || item.category === category) &&
    (!search || [item.title, item.fileName, item.category, item.notes].join(" ").toLowerCase().includes(search))
  );

  list.innerHTML = visible.length
    ? visible.map(item => `<article class="spec-company-knowledge-row">
        <div class="spec-company-knowledge-info">
          <div class="spec-company-knowledge-title"><strong>${escapeSpec(item.title)}</strong><span class="spec-company-kind">${escapeSpec(getSpecCompanyKnowledgeKind(item))}</span></div>
          <span>${escapeSpec(item.category)} &middot; ${escapeSpec(item.fileName)}</span>
          ${item.notes ? `<span>${escapeSpec(item.notes)}</span>` : ""}
        </div>
        <div class="spec-company-knowledge-actions">
          <button type="button" class="secondary" onclick="downloadSpecCompanyKnowledge('${item.id}')">Download</button>
          <button type="button" class="delete-btn" onclick="removeSpecCompanyKnowledge('${item.id}')">Remove</button>
        </div>
      </article>`).join("")
    : `<p class="converter-muted">${search || category ? "No shared references match these filters." : "No company knowledge has been uploaded yet."}</p>`;
}

async function uploadSpecCompanyKnowledge(file, metadata = {}) {
  const input = document.getElementById("specCompanyKnowledgeInput");
  if (!file) return;
  try {
    const session = await getSpecCompanyKnowledgeSession();
    if (!session) return showSpecMessage("Login Required", "Log in before uploading shared company knowledge.");
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      return showSpecMessage("Unsupported File", "Choose a PDF, Word, or Text document.");
    }
    if (file.size > SPEC_COMPANY_MAX_FILE_BYTES) {
      return showSpecMessage("File Too Large", "Company knowledge files must be 50 MB or smaller.");
    }

    const title = String(metadata.title || "").trim() ||
      file.name.replace(/\.[^.]+$/, "");
    const category = metadata.category || "Other";
    const notes = String(metadata.notes || "").trim();
    const id = crypto.randomUUID();
    const safeFileName = file.name.replace(/[^\w.\- ]+/g, "_");
    const storagePath = `company-knowledge/${id}/${Date.now()}-${safeFileName}`;

    setSpecCompanyKnowledgeStatus(`Uploading ${file.name}...`);
    const { error: uploadError } = await window.supabaseClient.storage
      .from(SPEC_COMPANY_DOCUMENTS_BUCKET)
      .upload(storagePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const { error: insertError } = await window.supabaseClient
      .from(SPEC_COMPANY_DOCUMENTS_TABLE)
      .insert([{
        id,
        file_name: file.name,
        display_title: title,
        document_type: SPEC_COMPANY_DOCUMENT_TYPE,
        packet_section: "Appendix",
        manufacturer: "",
        model_number: "",
        tags: `company-knowledge; knowledge-category:${category}`,
        notes,
        storage_path: storagePath
      }]);
    if (insertError) {
      await window.supabaseClient.storage.from(SPEC_COMPANY_DOCUMENTS_BUCKET).remove([storagePath]);
      throw insertError;
    }

    await loadSpecCompanyKnowledge();
    setSpecCompanyKnowledgeStatus(`${file.name} is now available to logged-in company users.`);
  } catch (error) {
    console.error("Company knowledge upload failed:", error);
    setSpecCompanyKnowledgeStatus(`Upload failed: ${error.message || "storage error"}`);
    await showSpecMessage("Upload Failed", error.message || "Could not upload this company reference.");
  } finally {
    if (input) input.value = "";
  }
}

async function getSpecCompanyKnowledgeFile(id) {
  const item = specCompanyKnowledgeItems.find(entry => entry.id === id);
  if (!item?.storagePath) throw new Error("The shared file is not attached.");
  const { data, error } = await window.supabaseClient.storage
    .from(SPEC_COMPANY_DOCUMENTS_BUCKET)
    .download(item.storagePath);
  if (error || !data) throw error || new Error("Could not download the shared file.");
  return { item, file: new File([data], item.fileName, { type: data.type || "application/octet-stream" }) };
}

async function downloadSpecCompanyKnowledge(id) {
  try {
    const { file } = await getSpecCompanyKnowledgeFile(id);
    downloadFile(file, file.name, file.type);
  } catch (error) {
    await showSpecMessage("Download Failed", error.message || "Could not download this company reference.");
  }
}

async function removeSpecCompanyKnowledge(id) {
  const item = specCompanyKnowledgeItems.find(entry => entry.id === id);
  if (!item) return;
  if (!(await showSpecConfirm("Remove Company Knowledge", `Remove ${item.title} for all company users?`, "Remove"))) return;

  const { error: storageError } = await window.supabaseClient.storage
    .from(SPEC_COMPANY_DOCUMENTS_BUCKET)
    .remove([item.storagePath]);
  if (storageError) return showSpecMessage("Remove Failed", storageError.message);

  const { error } = await window.supabaseClient
    .from(SPEC_COMPANY_DOCUMENTS_TABLE)
    .delete()
    .eq("id", id);
  if (error) return showSpecMessage("Remove Failed", error.message);
  await loadSpecCompanyKnowledge();
}
