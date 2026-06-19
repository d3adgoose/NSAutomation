const PDF_DB_NAME = "SubmittalPDFStorage";
const PDF_STORE_NAME = "pdfFiles";
let pdfDatabasePromise = null;

function openPDFDatabase() {
  if (pdfDatabasePromise) {
    return pdfDatabasePromise;
  }

  pdfDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(PDF_DB_NAME, 1);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
        db.createObjectStore(PDF_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => {
      pdfDatabasePromise = null;
      reject(event.target.error);
    };
  });

  return pdfDatabasePromise;
}

async function savePDFToIndexedDB(id, file) {
  const db = await openPDFDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readwrite");
    const store = tx.objectStore(PDF_STORE_NAME);

    store.put({
      id,
      fileName: file.name,
      file
    });

    tx.oncomplete = () => resolve();
    tx.onerror = event => reject(event.target.error);
  });
}

async function getPDFFromIndexedDB(id) {
  const db = await openPDFDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readonly");
    const store = tx.objectStore(PDF_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject(event.target.error);
  });
}

async function downloadSavedPDF(id, customFileName = "") {
  const record = await getPDFFromIndexedDB(id);

  if (!record || !record.file) {
    alert("PDF attachment not found.");
    return;
  }

  const fileNameToUse = customFileName || record.fileName || "download.pdf";

  downloadFile(record.file, fileNameToUse, "application/pdf");
}

async function deleteSavedPDF(id, refresh = true) {
  const db = await openPDFDatabase();

  const tx = db.transaction(PDF_STORE_NAME, "readwrite");
  const store = tx.objectStore(PDF_STORE_NAME);

  store.delete(id);

  tx.oncomplete = () => {
    if (refresh && typeof refreshAttachmentList === "function") {
      refreshAttachmentList();
    }
  };
}

async function refreshAttachmentList() {
  const tbody = document.getElementById("attachmentTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const db = await openPDFDatabase();

  const tx = db.transaction(PDF_STORE_NAME, "readonly");
  const store = tx.objectStore(PDF_STORE_NAME);
  const request = store.getAll();

  request.onsuccess = () => {
    request.result.forEach(record => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${record.fileName}</td>
        <td>
          <button onclick="downloadSavedPDF('${record.id}')">
            Download
          </button>

          <button onclick="deleteSavedPDF('${record.id}')">
            Delete
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });
  };
}

window.addEventListener("load", () => {
  const upload = document.getElementById("databasePdfUpload");

  if (upload) {
    upload.addEventListener("change", async event => {
      const files = Array.from(event.target.files);

      for (const file of files) {
        await savePDFToIndexedDB(crypto.randomUUID(), file);
      }

      upload.value = "";
      refreshAttachmentList();
    });
  }

  refreshAttachmentList();
});
